import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { calculateCashFlow, compareMonths, TransactionItem, AllocationBucketRule } from '../math/cashFlowEngine.js';
import { centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_BUCKET_RULES: AllocationBucketRule[] = [
  { id: 'bucket-emergency', name: 'Reserva de Emergência', targetPercentage: 40 },
  { id: 'bucket-investments', name: 'Investimentos & Patrimônio', targetPercentage: 40 },
  { id: 'bucket-leisure', name: 'Lazer & Qualidade de Vida', targetPercentage: 20 },
];

function buildUserScopeFilter(reqUser: { id: string }, requestedUserId?: string) {
  const isFamilyView = !requestedUserId || requestedUserId === 'all';

  if (isFamilyView) {
    return {
      OR: [{ userId: reqUser.id }, { isShared: true }],
    };
  }

  if (requestedUserId === reqUser.id) {
    return { userId: requestedUserId };
  }

  return {
    userId: requestedUserId,
    isShared: true,
  };
}

// Get monthly dashboard summary & real-time balance
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const rawYear = req.query.year ? parseInt(req.query.year as string, 10) : currentDate.getFullYear();
    const rawMonth = req.query.month ? parseInt(req.query.month as string, 10) : currentDate.getMonth() + 1;

    const year = Number.isFinite(rawYear) && rawYear >= 1970 && rawYear <= 2100 ? rawYear : currentDate.getFullYear();
    const month = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : currentDate.getMonth() + 1;
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    const isFamilyView = !requestedUserId || requestedUserId === 'all';
    const userScope = buildUserScopeFilter(req.user!, requestedUserId);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const whereClause: any = {
      dueDate: {
        gte: startDate,
        lte: endDate,
      },
      ...userScope,
    };

    const rawTransactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const txItems: TransactionItem[] = rawTransactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      categoryId: tx.categoryId,
      categoryName: tx.category.name,
      description: tx.description,
      amountCents: tx.amountCents,
      type: tx.type as 'INCOME' | 'EXPENSE' | 'SAVINGS',
      status: tx.status as 'PAID' | 'PENDING',
      dueDate: tx.dueDate.toISOString(),
      paidAt: tx.paidAt?.toISOString() ?? null,
      isShared: tx.isShared,
    }));

    const monthlyRecord = await prisma.monthlyRecord.findFirst({
      where: { year, month, userId: null },
      include: { allocations: true },
    });

    const customRules = monthlyRecord?.allocations.map((a) => ({
      id: a.id,
      name: a.bucketName,
      targetPercentage: a.targetPercentage ?? undefined,
      allocatedAmountCents: a.allocatedAmountCents,
    })) ?? [];

    const bucketRules = customRules.length > 0 ? customRules : DEFAULT_BUCKET_RULES;
    const cashFlow = calculateCashFlow(txItems, bucketRules);

    // Compute Category Breakdown for Donut Chart (Expenses + Savings allocations)
    const expenseCategoriesMap = new Map<string, { name: string; amountCents: number; color: string; count: number }>();
    for (const tx of rawTransactions) {
      if (tx.type === 'EXPENSE') {
        const cat = tx.category;
        const current = expenseCategoriesMap.get(cat.id) || {
          name: cat.name,
          amountCents: 0,
          color: cat.color,
          count: 0,
        };
        current.amountCents += tx.amountCents;
        current.count += 1;
        expenseCategoriesMap.set(cat.id, current);
      }
    }

    const categoryBreakdown = Array.from(expenseCategoriesMap.values()).map((cat) => ({
      name: cat.name,
      amountDollars: centsToDollars(cat.amountCents),
      amountCents: cat.amountCents,
      color: cat.color,
      count: cat.count,
      percentageOfExpenses:
        cashFlow.totalExpensesCents > 0
          ? Number(((cat.amountCents / cashFlow.totalExpensesCents) * 100).toFixed(1))
          : 0,
      percentageOfIncome:
        cashFlow.totalIncomeCents > 0
          ? Number(((cat.amountCents / cashFlow.totalIncomeCents) * 100).toFixed(1))
          : 0,
    }));

    // Compute Previous Month for Month-over-Month Delta
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth <= 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const prevStartDate = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
    const prevEndDate = new Date(Date.UTC(prevYear, prevMonth, 0, 23, 59, 59, 999));

    const prevTransactions = await prisma.transaction.findMany({
      where: {
        dueDate: { gte: prevStartDate, lte: prevEndDate },
        ...userScope,
      },
    });

    const prevTxItems: TransactionItem[] = prevTransactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      categoryId: tx.categoryId,
      description: tx.description,
      amountCents: tx.amountCents,
      type: tx.type as 'INCOME' | 'EXPENSE' | 'SAVINGS',
      status: tx.status as 'PAID' | 'PENDING',
    }));

    const prevCashFlow = calculateCashFlow(prevTxItems);
    const momDelta = compareMonths(cashFlow, prevCashFlow);

    res.json({
      period: { year, month },
      isFamilyView,
      summary: {
        totalIncomeDollars: centsToDollars(cashFlow.totalIncomeCents),
        totalExpensesDollars: centsToDollars(cashFlow.totalExpensesCents),
        totalPaidDollars: centsToDollars(cashFlow.totalPaidExpensesCents),
        totalPendingDollars: centsToDollars(cashFlow.totalPendingExpensesCents),
        totalSavingsDollars: centsToDollars(cashFlow.totalSavingsCents),
        netRemainingCashFlowDollars: centsToDollars(cashFlow.netRemainingCashFlowCents),
        netLiquidCashOnHandDollars: centsToDollars(cashFlow.netLiquidCashOnHandCents),
        savingsRatePercent: cashFlow.savingsRatePercent,
        expenseToIncomeRatioPercent: cashFlow.expenseToIncomeRatioPercent,
        pendingLiabilitiesCount: cashFlow.pendingLiabilitiesCount,
        paidLiabilitiesCount: cashFlow.paidLiabilitiesCount,
        savingsTransactionsCount: cashFlow.savingsTransactionsCount,
        isDeficit: cashFlow.isDeficit,
        deficitAmountDollars: centsToDollars(cashFlow.deficitAmountCents),
      },
      allocations: cashFlow.allocations.map((a) => ({
        ...a,
        allocatedAmountDollars: centsToDollars(a.allocatedAmountCents),
      })),
      categoryBreakdown,
      monthOverMonth: {
        incomeGrowthPercent: momDelta.incomeGrowthPercent,
        expenseGrowthPercent: momDelta.expenseGrowthPercent,
        netCashFlowGrowthPercent: momDelta.netCashFlowGrowthPercent,
      },
    });
  } catch {
    res.status(500).json({ error: 'Failed to compute dashboard summary' });
  }
});

// Get 12-month historical cash flow trend computed directly from real transactions
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const userScope = buildUserScopeFilter(req.user!, requestedUserId);

    const totalTxCount = await prisma.transaction.count({
      where: userScope,
    });

    if (totalTxCount === 0) {
      res.json([]);
      return;
    }

    const now = new Date();
    const rawYear = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const rawMonth = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    const currentYear = Number.isFinite(rawYear) && rawYear >= 1970 && rawYear <= 2100 ? rawYear : now.getFullYear();
    const currentMonth = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1;
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const historyList = [];
    for (let offset = 11; offset >= 0; offset--) {
      let y = currentYear;
      let m = currentMonth - offset;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }

      const startDate = new Date(Date.UTC(y, m - 1, 1));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

      const monthTxs = await prisma.transaction.findMany({
        where: {
          dueDate: { gte: startDate, lte: endDate },
          ...userScope,
        },
      });

      const txItems: TransactionItem[] = monthTxs.map((t) => ({
        id: t.id,
        userId: t.userId,
        categoryId: t.categoryId,
        description: t.description,
        amountCents: t.amountCents,
        type: t.type as 'INCOME' | 'EXPENSE' | 'SAVINGS',
        status: t.status as 'PAID' | 'PENDING',
      }));

      const cf = calculateCashFlow(txItems);
      historyList.push({
        year: y,
        month: m,
        periodLabel: `${monthNames[m - 1]}/${String(y).slice(-2)}`,
        income: centsToDollars(cf.totalIncomeCents),
        expenses: centsToDollars(cf.totalExpensesCents),
        savings: centsToDollars(cf.totalSavingsCents),
        paid: centsToDollars(cf.totalPaidExpensesCents),
        pending: centsToDollars(cf.totalPendingExpensesCents),
        netCashFlow: centsToDollars(cf.netRemainingCashFlowCents),
      });
    }

    res.json(historyList);
  } catch {
    res.status(500).json({ error: 'Failed to fetch cash flow history' });
  }
});

export default router;
