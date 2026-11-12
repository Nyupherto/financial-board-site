import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Prevents CSV Formula Injection (DDE / Excel macro execution)
 * by neutralizing cells starting with '=', '+', '-', '@', '\t', or '\r'.
 */
function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

// Export transactions as CSV (scoped to authenticated user & shared records)
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const whereClause = {
      OR: [{ userId: req.user!.id }, { isShared: true }],
    };

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        category: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'desc' },
    });

    const headers = ['Transaction ID', 'Date', 'User Name', 'Category', 'Type', 'Status', 'Amount (BRL)', 'Description', 'Is Shared'];
    const rows = transactions.map((t) => [
      escapeCsvCell(t.id),
      escapeCsvCell(t.dueDate.toISOString().split('T')[0]),
      escapeCsvCell(t.user.name),
      escapeCsvCell(t.category.name),
      escapeCsvCell(t.type),
      escapeCsvCell(t.status),
      escapeCsvCell(centsToDollars(t.amountCents).toFixed(2)),
      escapeCsvCell(t.description),
      escapeCsvCell(t.isShared ? 'Yes' : 'No'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="financeme-transactions.csv"');
    res.status(200).send(csvContent);
  } catch {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export data snapshot as JSON (scoped to authenticated user, passwordHash never selected)
router.get('/export/json', requireAuth, async (req: Request, res: Response) => {
  try {
    const txWhere = {
      OR: [{ userId: req.user!.id }, { isShared: true }],
    };

    const [users, categories, transactions, monthlyRecords, savingsGoals, allocations] = await Promise.all([
      prisma.user.findMany({
        where: { id: req.user!.id },
        select: { id: true, name: true, avatarColor: true },
      }),
      prisma.category.findMany(),
      prisma.transaction.findMany({
        where: txWhere,
        include: { category: true, user: { select: { id: true, name: true } } },
      }),
      prisma.monthlyRecord.findMany({
        where: { OR: [{ userId: req.user!.id }, { userId: null }] },
      }),
      prisma.savingsGoal.findMany({
        where: { userId: req.user!.id },
      }),
      prisma.allocationBucket.findMany(),
    ]);

    const exportData = {
      system: 'Finance.ME',
      exportedAt: new Date().toISOString(),
      users,
      categories,
      transactions: transactions.map((t) => ({ ...t, amountDollars: centsToDollars(t.amountCents) })),
      monthlyRecords,
      savingsGoals,
      allocations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="financeme-backup.json"');
    res.status(200).json(exportData);
  } catch {
    res.status(500).json({ error: 'Failed to export JSON' });
  }
});

export default router;
