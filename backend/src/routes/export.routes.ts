import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

// Export all transactions as CSV
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        category: true,
        user: true,
      },
      orderBy: { dueDate: 'desc' },
    });

    const headers = ['Transaction ID', 'Date', 'User Name', 'User Email', 'Category', 'Type', 'Status', 'Amount (USD)', 'Description', 'Is Shared'];
    const rows = transactions.map((t) => [
      `"${t.id}"`,
      `"${t.dueDate.toISOString().split('T')[0]}"`,
      `"${t.user.name}"`,
      `"${t.user.email}"`,
      `"${t.category.name}"`,
      `"${t.type}"`,
      `"${t.status}"`,
      `"${centsToDollars(t.amountCents).toFixed(2)}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.isShared ? 'Yes' : 'No'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="family-financial-transactions.csv"');
    res.status(200).send(csvContent);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export CSV', details: error.message });
  }
});

// Export complete data snapshot as JSON
router.get('/export/json', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [users, categories, transactions, monthlyRecords, savingsGoals, allocations] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, avatarColor: true } }),
      prisma.category.findMany(),
      prisma.transaction.findMany({ include: { category: true, user: { select: { id: true, name: true } } } }),
      prisma.monthlyRecord.findMany(),
      prisma.savingsGoal.findMany(),
      prisma.allocationBucket.findMany(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      familyBaseCount: users.length,
      users,
      categories,
      transactions: transactions.map((t) => ({ ...t, amountDollars: centsToDollars(t.amountCents) })),
      monthlyRecords,
      savingsGoals,
      allocations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="family-financial-backup.json"');
    res.status(200).json(exportData);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to export JSON', details: error.message });
  }
});

export default router;
