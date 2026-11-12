import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { calculateCompoundInterest, calculateSavingsGoalEta } from '../math/compoundInterest.js';
import { dollarsToCents, centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

const MAX_SIM_PRINCIPAL = 100_000_000;
const MAX_SIM_CONTRIBUTION = 10_000_000;

/**
 * GET /api/savings/overview
 * Computes real-time Savings & Individual Goals (Metas) from actual SAVINGS transactions
 * across the recent months, calculates the average monthly contribution flow,
 * and applies the internal compound interest engine to project the exact time to reach each goal.
 */
router.get('/savings/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const rawRate = Number(req.query.annualInterestRate);
    const annualInterestRatePercent = Number.isFinite(rawRate)
      ? Math.max(0, Math.min(100, rawRate))
      : 10;

    const now = new Date();
    const rawYear = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
    const rawMonth = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
    const currentYear = Number.isFinite(rawYear) && rawYear >= 1970 && rawYear <= 2100 ? rawYear : now.getFullYear();
    const currentMonth = Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1;

    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const isFamilyView = !requestedUserId || requestedUserId === 'all';

    const txUserScope = isFamilyView
      ? { OR: [{ userId: req.user!.id }, { isShared: true }] }
      : requestedUserId === req.user!.id
      ? { userId: req.user!.id }
      : { userId: requestedUserId, isShared: true };

    // Fetch all SAVINGS categories, user's configured SavingsGoal targets, and all SAVINGS transactions
    const [savingsCategories, savedGoals, savingsTransactions] = await Promise.all([
      prisma.category.findMany({
        where: { type: 'SAVINGS' },
        orderBy: { name: 'asc' },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: req.user!.id },
      }),
      prisma.transaction.findMany({
        where: {
          type: 'SAVINGS',
          ...txUserScope,
        },
        include: {
          category: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // Map target amounts by group name
    const targetMap = new Map<string, { id: string; targetAmountCents: number }>();
    for (const g of savedGoals) {
      targetMap.set(g.name.toLowerCase(), {
        id: g.id,
        targetAmountCents: g.targetAmountCents,
      });
    }

    // Build 6-month historical flow of Savings contributions
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyFlow: { year: number; month: number; label: string; amountCents: number; amountDollars: number }[] = [];

    for (let offset = 5; offset >= 0; offset--) {
      let y = currentYear;
      let m = currentMonth - offset;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      monthlyFlow.push({
        year: y,
        month: m,
        label: `${monthNames[m - 1]}/${String(y).slice(-2)}`,
        amountCents: 0,
        amountDollars: 0,
      });
    }

    // Aggregate transactions by group and by month (YYYY-MM)
    const groupMap = new Map<
      string,
      {
        groupName: string;
        color: string;
        totalInvestedCents: number;
        monthlyTotals: Map<string, number>;
        txCount: number;
      }
    >();

    // Initialize with existing SAVINGS categories
    for (const cat of savingsCategories) {
      groupMap.set(cat.name, {
        groupName: cat.name,
        color: cat.color || '#8b5cf6',
        totalInvestedCents: 0,
        monthlyTotals: new Map(),
        txCount: 0,
      });
    }

    // Ensure at least default "Metas & Savings" group is shown
    if (groupMap.size === 0) {
      groupMap.set('Metas & Savings', {
        groupName: 'Metas & Savings',
        color: '#8b5cf6',
        totalInvestedCents: 0,
        monthlyTotals: new Map(),
        txCount: 0,
      });
    }

    const overallMonthlyTotals = new Map<string, number>();
    let overallTotalInvestedCents = 0;

    for (const tx of savingsTransactions) {
      const gName = tx.category?.name || 'Metas & Savings';
      const gColor = tx.category?.color || '#8b5cf6';
      const d = tx.dueDate;
      const ymKey = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;

      overallTotalInvestedCents += tx.amountCents;
      overallMonthlyTotals.set(ymKey, (overallMonthlyTotals.get(ymKey) || 0) + tx.amountCents);

      const flowSlot = monthlyFlow.find(
        (f) => f.year === d.getUTCFullYear() && f.month === d.getUTCMonth() + 1
      );
      if (flowSlot) {
        flowSlot.amountCents += tx.amountCents;
        flowSlot.amountDollars = centsToDollars(flowSlot.amountCents);
      }

      const entry = groupMap.get(gName) || {
        groupName: gName,
        color: gColor,
        totalInvestedCents: 0,
        monthlyTotals: new Map<string, number>(),
        txCount: 0,
      };

      entry.totalInvestedCents += tx.amountCents;
      entry.txCount += 1;
      entry.monthlyTotals.set(ymKey, (entry.monthlyTotals.get(ymKey) || 0) + tx.amountCents);
      groupMap.set(gName, entry);
    }

    // Compute per-group projections using the Compound Interest Engine
    const goals = Array.from(groupMap.values()).map((g) => {
      const activeMonthsCount = Math.max(1, g.monthlyTotals.size);
      const averageMonthlyCents =
        g.totalInvestedCents > 0 ? Math.round(g.totalInvestedCents / activeMonthsCount) : 0;

      const targetInfo = targetMap.get(g.groupName.toLowerCase());
      const targetAmountCents = targetInfo ? targetInfo.targetAmountCents : 0;

      const eta = calculateSavingsGoalEta({
        currentSavedCents: g.totalInvestedCents,
        averageMonthlyContributionCents: averageMonthlyCents,
        targetAmountCents,
        annualInterestRatePercent,
      });

      const progressPercent =
        targetAmountCents > 0
          ? Math.min(100, Number(((g.totalInvestedCents / targetAmountCents) * 100).toFixed(1)))
          : 0;

      return {
        groupName: g.groupName,
        color: g.color,
        txCount: g.txCount,
        activeMonthsCount: g.monthlyTotals.size,
        totalInvestedDollars: centsToDollars(g.totalInvestedCents),
        averageMonthlyContributionDollars: centsToDollars(averageMonthlyCents),
        targetAmountDollars: centsToDollars(targetAmountCents),
        progressPercent,
        isReached: eta.isReached,
        monthsToGoalWithInterest: eta.monthsToGoalWithInterest,
        monthsToGoalWithoutInterest: eta.monthsToGoalWithoutInterest,
        interestSavedMonths: eta.interestSavedMonths,
        projectedFinalBalanceDollars: centsToDollars(eta.projectedFinalBalanceCents),
        projectedTotalPrincipalDollars: centsToDollars(eta.projectedTotalPrincipalCents),
        projectedTotalInterestDollars: centsToDollars(eta.projectedTotalInterestCents),
        effectiveMonthlyRatePercent: eta.effectiveMonthlyRatePercent,
        effectiveAnnualRatePercent: eta.effectiveAnnualRatePercent,
        schedule: eta.schedule.map((s) => ({
          month: s.month,
          year: s.year,
          endingBalanceDollars: centsToDollars(s.endingBalanceCents),
          cumulativePrincipalDollars: centsToDollars(s.cumulativePrincipalCents),
          cumulativeInterestDollars: centsToDollars(s.cumulativeInterestCents),
        })),
      };
    });

    const overallActiveMonths = Math.max(1, overallMonthlyTotals.size);
    const overallAverageMonthlyCents =
      overallTotalInvestedCents > 0
        ? Math.round(overallTotalInvestedCents / overallActiveMonths)
        : 0;

    res.json({
      annualInterestRatePercent,
      totalInvestedDollars: centsToDollars(overallTotalInvestedCents),
      averageMonthlyContributionDollars: centsToDollars(overallAverageMonthlyCents),
      activeMonthsCount: overallMonthlyTotals.size,
      monthlyFlow,
      goals,
    });
  } catch (error) {
    console.error('Error computing savings overview:', error);
    res.status(500).json({ error: 'Falha ao calcular fluxo de metas e savings.' });
  }
});

/**
 * PUT /api/savings/target
 * Sets or updates the individual target amount (Meta Individual) for a Savings group.
 */
router.put('/savings/target', requireAuth, async (req: Request, res: Response) => {
  try {
    const { groupName, targetAmountDollars } = req.body;
    if (typeof groupName !== 'string' || !groupName.trim() || groupName.trim().length > 60) {
      res.status(400).json({ error: 'Nome do grupo de meta inválido.' });
      return;
    }

    const cleanName = groupName.trim();
    const safeTarget = Math.max(0, Math.min(MAX_SIM_PRINCIPAL, Number(targetAmountDollars) || 0));
    const targetAmountCents = dollarsToCents(safeTarget);

    // Ensure category exists as SAVINGS
    const existingCat = await prisma.category.findFirst({
      where: { name: cleanName },
    });

    if (!existingCat) {
      await prisma.category.create({
        data: {
          name: cleanName,
          type: 'SAVINGS',
          color: '#8b5cf6',
          icon: 'target',
          isDefault: false,
        },
      });
    }

    const existingGoal = await prisma.savingsGoal.findFirst({
      where: {
        userId: req.user!.id,
        name: cleanName,
      },
    });

    if (existingGoal) {
      const updated = await prisma.savingsGoal.update({
        where: { id: existingGoal.id },
        data: { targetAmountCents },
      });
      res.json({
        id: updated.id,
        groupName: updated.name,
        targetAmountDollars: centsToDollars(updated.targetAmountCents),
      });
      return;
    }

    const created = await prisma.savingsGoal.create({
      data: {
        userId: req.user!.id,
        name: cleanName,
        targetAmountCents,
        initialPrincipalCents: 0,
        monthlyContributionCents: 0,
        annualInterestRateBps: 1000,
        horizonMonths: 12,
      },
    });

    res.status(201).json({
      id: created.id,
      groupName: created.name,
      targetAmountDollars: centsToDollars(created.targetAmountCents),
    });
  } catch (error) {
    console.error('Error updating savings target:', error);
    res.status(500).json({ error: 'Falha ao salvar meta individual.' });
  }
});

// Run 100% Offline Compound Interest Simulation (authenticated)
router.post('/savings/simulate', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      initialPrincipalDollars = 0,
      monthlyContributionDollars = 0,
      annualInterestRatePercent = 10,
      horizonMonths = 60,
      contributionTiming = 'END_OF_PERIOD',
    } = req.body;

    const rawPrincipal = Math.max(0, Math.min(MAX_SIM_PRINCIPAL, Number(initialPrincipalDollars) || 0));
    const rawMonthly = Math.max(0, Math.min(MAX_SIM_CONTRIBUTION, Number(monthlyContributionDollars) || 0));
    const annualRate = Math.max(0, Math.min(100, Number(annualInterestRatePercent) || 0));
    const months = Math.max(1, Math.min(600, parseInt(String(horizonMonths), 10) || 60));
    const safeTiming = contributionTiming === 'BEGINNING_OF_PERIOD' ? 'BEGINNING_OF_PERIOD' : 'END_OF_PERIOD';

    const result = calculateCompoundInterest({
      initialPrincipalCents: dollarsToCents(rawPrincipal),
      monthlyContributionCents: dollarsToCents(rawMonthly),
      annualInterestRatePercent: annualRate,
      horizonMonths: months,
      contributionTiming: safeTiming,
    });

    res.json({
      summary: {
        futureValueDollars: centsToDollars(result.futureValueCents),
        totalPrincipalInvestedDollars: centsToDollars(result.totalPrincipalInvestedCents),
        totalInterestEarnedDollars: centsToDollars(result.totalInterestEarnedCents),
        nominalAnnualRatePercent: result.nominalAnnualRatePercent,
        effectiveAnnualRatePercent: result.effectiveAnnualRatePercent,
        horizonMonths: result.horizonMonths,
        horizonYears: Number((result.horizonMonths / 12).toFixed(1)),
      },
      schedule: result.schedule.map((entry) => ({
        month: entry.month,
        year: entry.year,
        startingBalanceDollars: centsToDollars(entry.startingBalanceCents),
        contributionDollars: centsToDollars(entry.contributionCents),
        interestEarnedDollars: centsToDollars(entry.interestEarnedCents),
        endingBalanceDollars: centsToDollars(entry.endingBalanceCents),
        cumulativePrincipalDollars: centsToDollars(entry.cumulativePrincipalCents),
        cumulativeInterestDollars: centsToDollars(entry.cumulativeInterestCents),
      })),
    });
  } catch {
    res.status(500).json({ error: 'Simulation failed' });
  }
});

export default router;
