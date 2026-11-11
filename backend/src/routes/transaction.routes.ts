import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { dollarsToCents, centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

const GROUP_COLORS = [
  '#ef4444', '#84cc16', '#a855f7', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#ec4899'
];

// List categories / groups
router.get('/categories', requireAuth, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create a new custom group / category
router.post('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, type = 'EXPENSE', color } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'O nome do grupo é obrigatório.' });
      return;
    }

    const cleanName = name.trim();
    const existing = await prisma.category.findFirst({
      where: { name: cleanName },
    });

    if (existing) {
      res.json(existing);
      return;
    }

    const count = await prisma.category.count();
    const assignedColor = color || GROUP_COLORS[count % GROUP_COLORS.length];

    const created = await prisma.category.create({
      data: {
        name: cleanName,
        type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        color: assignedColor,
        icon: type === 'INCOME' ? 'trending-up' : 'tag',
        isDefault: false,
      },
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao criar grupo.', details: error.message });
  }
});

// List transactions with filtering
router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { year, month, userId, status, type } = req.query;

    const where: any = {};

    if (year && month) {
      const y = parseInt(year as string, 10);
      const m = parseInt(month as string, 10);
      const startDate = new Date(Date.UTC(y, m - 1, 1));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      where.dueDate = { gte: startDate, lte: endDate };
    }

    if (userId && userId !== 'all') {
      where.userId = userId as string;
    }

    if (status && status !== 'ALL') {
      where.status = status as string;
    }

    if (type && type !== 'ALL') {
      where.type = type as string;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = transactions.map((tx) => ({
      ...tx,
      amountDollars: centsToDollars(tx.amountCents),
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list transactions', details: error.message });
  }
});

// Helper to resolve or create a category by ID or Name
async function resolveCategoryId(categoryId?: string, categoryName?: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): Promise<string> {
  if (categoryId) {
    const found = await prisma.category.findUnique({ where: { id: categoryId } });
    if (found) return found.id;
  }

  const targetName = (categoryName || (type === 'INCOME' ? 'Renda & Ganhos' : 'Despesas')).trim();
  const existing = await prisma.category.findFirst({
    where: { name: targetName },
  });
  if (existing) return existing.id;

  const count = await prisma.category.count();
  const created = await prisma.category.create({
    data: {
      name: targetName,
      type,
      color: GROUP_COLORS[count % GROUP_COLORS.length],
      icon: type === 'INCOME' ? 'trending-up' : 'tag',
      isDefault: false,
    },
  });
  return created.id;
}

// Create new single transaction
router.post('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      description,
      amountDollars,
      type = 'EXPENSE',
      status = 'PAID',
      categoryId,
      categoryName,
      dueDate,
      userId,
      isShared = true,
      notes,
    } = req.body;

    if (!description || amountDollars === undefined) {
      res.status(400).json({ error: 'Descrição e valor são obrigatórios.' });
      return;
    }

    const txType: 'INCOME' | 'EXPENSE' = type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const resolvedCategoryId = await resolveCategoryId(categoryId, categoryName, txType);
    const targetUserId = req.user?.role === 'ADMIN' && userId ? userId : req.user!.id;
    const amountCents = dollarsToCents(Math.abs(Number(amountDollars)));
    const targetDueDate = dueDate ? new Date(dueDate) : new Date();

    const newTx = await prisma.transaction.create({
      data: {
        userId: targetUserId,
        categoryId: resolvedCategoryId,
        description: description.trim(),
        amountCents,
        type: txType,
        status: status as 'PAID' | 'PENDING',
        dueDate: targetDueDate,
        paidAt: status === 'PAID' ? new Date() : null,
        isShared: Boolean(isShared),
        notes: notes || null,
      },
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    res.status(201).json({
      ...newTx,
      amountDollars: centsToDollars(newTx.amountCents),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
});

// Batch create transactions from Smart Textarea Parser
router.post('/transactions/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items, dueDate, userId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Nenhum item válido para lançamento.' });
      return;
    }

    const targetUserId = req.user?.role === 'ADMIN' && userId ? userId : req.user!.id;
    const targetDueDate = dueDate ? new Date(dueDate) : new Date();

    const createdItems = [];
    for (const item of items) {
      const txType: 'INCOME' | 'EXPENSE' = item.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const resolvedCategoryId = await resolveCategoryId(item.categoryId, item.groupName, txType);
      const amountCents = dollarsToCents(Math.abs(Number(item.amount)));

      if (!item.description || amountCents <= 0) continue;

      const created = await prisma.transaction.create({
        data: {
          userId: targetUserId,
          categoryId: resolvedCategoryId,
          description: item.description.trim(),
          amountCents,
          type: txType,
          status: item.status === 'PENDING' ? 'PENDING' : 'PAID',
          dueDate: targetDueDate,
          paidAt: item.status === 'PENDING' ? null : new Date(),
          isShared: true,
        },
        include: {
          category: true,
          user: { select: { id: true, name: true, avatarColor: true } },
        },
      });

      createdItems.push({
        ...created,
        amountDollars: centsToDollars(created.amountCents),
      });
    }

    res.status(201).json(createdItems);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao salvar lançamentos em lote.', details: error.message });
  }
});

// Quick toggle payment status (PAID <-> PENDING)
router.patch('/transactions/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const nextStatus = existing.status === 'PAID' ? 'PENDING' : 'PAID';
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: nextStatus,
        paidAt: nextStatus === 'PAID' ? new Date() : null,
      },
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    res.json({
      ...updated,
      amountDollars: centsToDollars(updated.amountCents),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update transaction status', details: error.message });
  }
});

// Update transaction (Group reallocation, value increase/decrease, type change, description)
router.put('/transactions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      description,
      amountDollars,
      categoryId,
      categoryName,
      type,
      status,
      dueDate,
      isShared,
      notes,
    } = req.body;

    const dataToUpdate: any = {};
    if (description !== undefined) dataToUpdate.description = description.trim();
    if (amountDollars !== undefined) {
      dataToUpdate.amountCents = dollarsToCents(Math.max(0, Math.abs(Number(amountDollars))));
    }
    if (type !== undefined) {
      dataToUpdate.type = type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    }

    if (categoryId !== undefined || categoryName !== undefined) {
      const resolvedCatId = await resolveCategoryId(
        categoryId,
        categoryName,
        dataToUpdate.type || 'EXPENSE'
      );
      dataToUpdate.categoryId = resolvedCatId;

      // If category has a specific type (e.g. Ganhos com a Oficina is INCOME) and type wasn't explicitly overridden, sync it
      if (type === undefined) {
        const cat = await prisma.category.findUnique({ where: { id: resolvedCatId } });
        if (cat) {
          dataToUpdate.type = cat.type;
        }
      }
    }

    if (status !== undefined) {
      dataToUpdate.status = status;
      dataToUpdate.paidAt = status === 'PAID' ? new Date() : null;
    }
    if (dueDate !== undefined) dataToUpdate.dueDate = new Date(dueDate);
    if (isShared !== undefined) dataToUpdate.isShared = Boolean(isShared);
    if (notes !== undefined) dataToUpdate.notes = notes;

    const updated = await prisma.transaction.update({
      where: { id },
      data: dataToUpdate,
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    res.json({
      ...updated,
      amountDollars: centsToDollars(updated.amountCents),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update transaction', details: error.message });
  }
});

// Delete transaction
router.delete('/transactions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.transaction.delete({ where: { id } });
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
