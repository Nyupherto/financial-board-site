import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { dollarsToCents, centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

const GROUP_COLORS = [
  '#ef4444', '#84cc16', '#a855f7', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#ec4899'
];

const MAX_AMOUNT_DOLLARS = 100_000_000;

function normalizeTxType(rawType?: unknown): 'INCOME' | 'EXPENSE' | 'SAVINGS' {
  if (rawType === 'INCOME') return 'INCOME';
  if (rawType === 'SAVINGS') return 'SAVINGS';
  return 'EXPENSE';
}

// List categories / groups
router.get('/categories', requireAuth, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Falha ao buscar grupos.' });
  }
});

// Create a new custom group / category
router.post('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, type = 'EXPENSE', color } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      res.status(400).json({ error: 'Nome de grupo inválido (máx. 60 caracteres).' });
      return;
    }

    const cleanName = name.trim();
    const validType = normalizeTxType(type);

    const existing = await prisma.category.findFirst({
      where: { name: cleanName },
    });

    if (existing) {
      if (existing.type !== validType) {
        const updated = await prisma.category.update({
          where: { id: existing.id },
          data: { type: validType },
        });
        res.json(updated);
        return;
      }
      res.json(existing);
      return;
    }

    const count = await prisma.category.count();
    if (count >= 50) {
      res.status(400).json({ error: 'Limite máximo de grupos atingido.' });
      return;
    }

    const isValidHex = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
    const assignedColor = isValidHex
      ? color
      : validType === 'SAVINGS'
      ? '#8b5cf6'
      : GROUP_COLORS[count % GROUP_COLORS.length];

    const created = await prisma.category.create({
      data: {
        name: cleanName,
        type: validType,
        color: assignedColor,
        icon: validType === 'INCOME' ? 'trending-up' : validType === 'SAVINGS' ? 'target' : 'tag',
        isDefault: false,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Falha ao criar grupo.' });
  }
});

// List transactions with filtering and ownership checks
router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { year, month, userId, status, type } = req.query;

    const where: any = {};

    if (year && month) {
      const y = parseInt(year as string, 10);
      const m = parseInt(month as string, 10);
      if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
        const startDate = new Date(Date.UTC(y, m - 1, 1));
        const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        where.dueDate = { gte: startDate, lte: endDate };
      }
    }

    if (userId && userId !== 'all') {
      if (userId !== req.user!.id) {
        where.userId = userId as string;
        where.isShared = true;
      } else {
        where.userId = req.user!.id;
      }
    } else {
      where.OR = [{ userId: req.user!.id }, { isShared: true }];
    }

    if (status === 'PAID' || status === 'PENDING') {
      where.status = status;
    }

    if (type === 'INCOME' || type === 'EXPENSE' || type === 'SAVINGS') {
      where.type = type;
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
  } catch (error) {
    console.error('Error listing transactions:', error);
    res.status(500).json({ error: 'Falha ao listar lançamentos.' });
  }
});

// Helper to resolve or create a category by ID or Name
async function resolveCategoryId(
  categoryId?: string,
  categoryName?: string,
  type: 'INCOME' | 'EXPENSE' | 'SAVINGS' = 'EXPENSE'
): Promise<string> {
  if (categoryId && typeof categoryId === 'string') {
    const found = await prisma.category.findUnique({ where: { id: categoryId } });
    if (found) return found.id;
  }

  const rawName = typeof categoryName === 'string' ? categoryName.trim().slice(0, 60) : '';
  const defaultName =
    type === 'INCOME'
      ? 'Renda & Ganhos'
      : type === 'SAVINGS'
      ? 'Metas & Savings'
      : 'Despesas';
  const targetName = rawName || defaultName;

  const existing = await prisma.category.findFirst({
    where: { name: targetName },
  });
  if (existing) return existing.id;

  const count = await prisma.category.count();
  const created = await prisma.category.create({
    data: {
      name: targetName,
      type,
      color: type === 'SAVINGS' ? '#8b5cf6' : GROUP_COLORS[count % GROUP_COLORS.length],
      icon: type === 'INCOME' ? 'trending-up' : type === 'SAVINGS' ? 'target' : 'tag',
      isDefault: false,
    },
  });
  return created.id;
}

// Create new single transaction (always bound to authenticated user)
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
      isShared = true,
      notes,
    } = req.body;

    if (typeof description !== 'string' || !description.trim() || description.trim().length > 200) {
      res.status(400).json({ error: 'Descrição inválida (máx. 200 caracteres).' });
      return;
    }

    const numAmount = Math.abs(Number(amountDollars));
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT_DOLLARS) {
      res.status(400).json({ error: 'Valor monetário fora dos limites permitidos.' });
      return;
    }

    const txType = normalizeTxType(type);
    const resolvedCategoryId = await resolveCategoryId(categoryId, categoryName, txType);
    const amountCents = dollarsToCents(numAmount);
    const targetDueDate = dueDate ? new Date(dueDate) : new Date();

    const newTx = await prisma.transaction.create({
      data: {
        userId: req.user!.id,
        categoryId: resolvedCategoryId,
        description: description.trim(),
        amountCents,
        type: txType,
        status: status === 'PENDING' ? 'PENDING' : 'PAID',
        dueDate: Number.isNaN(targetDueDate.getTime()) ? new Date() : targetDueDate,
        paidAt: status === 'PENDING' ? null : new Date(),
        isShared: Boolean(isShared),
        notes: typeof notes === 'string' ? notes.slice(0, 500) : null,
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
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Falha ao criar lançamento.' });
  }
});

// Batch create transactions from Smart Textarea Parser
router.post('/transactions/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { items, dueDate } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      res.status(400).json({ error: 'Lista de itens inválida (máximo de 100 itens por lote).' });
      return;
    }

    const parsedDate = dueDate ? new Date(dueDate) : new Date();
    const targetDueDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const createdItems = [];
    for (const item of items) {
      if (!item || typeof item.description !== 'string') continue;
      const cleanDesc = item.description.trim().slice(0, 200);
      const numAmount = Math.abs(Number(item.amount));
      if (!cleanDesc || !Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT_DOLLARS) {
        continue;
      }

      const txType = normalizeTxType(item.type);
      const resolvedCategoryId = await resolveCategoryId(item.categoryId, item.groupName, txType);
      const amountCents = dollarsToCents(numAmount);

      if (amountCents <= 0) continue;

      const created = await prisma.transaction.create({
        data: {
          userId: req.user!.id,
          categoryId: resolvedCategoryId,
          description: cleanDesc,
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
  } catch (error) {
    console.error('Error creating batch transactions:', error);
    res.status(500).json({ error: 'Falha ao salvar lançamentos em lote.' });
  }
});

// Quick toggle payment status (PAID <-> PENDING) with strict Ownership Verification
router.patch('/transactions/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Lançamento não encontrado.' });
      return;
    }

    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: 'Sem permissão para alterar este lançamento.' });
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
  } catch (error) {
    console.error('Error toggling transaction status:', error);
    res.status(500).json({ error: 'Falha ao atualizar status.' });
  }
});

// Update transaction with strict Ownership Verification
router.put('/transactions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Lançamento não encontrado.' });
      return;
    }

    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: 'Sem permissão para editar este lançamento.' });
      return;
    }

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
    if (typeof description === 'string' && description.trim()) {
      dataToUpdate.description = description.trim().slice(0, 200);
    }
    if (amountDollars !== undefined) {
      const numAmount = Math.abs(Number(amountDollars));
      if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT_DOLLARS) {
        res.status(400).json({ error: 'Valor inválido.' });
        return;
      }
      dataToUpdate.amountCents = dollarsToCents(numAmount);
    }
    if (type === 'INCOME' || type === 'EXPENSE' || type === 'SAVINGS') {
      dataToUpdate.type = type;
    }

    if (categoryId !== undefined || categoryName !== undefined) {
      const resolvedCatId = await resolveCategoryId(
        categoryId,
        categoryName,
        (dataToUpdate.type || existing.type) as 'INCOME' | 'EXPENSE' | 'SAVINGS'
      );
      dataToUpdate.categoryId = resolvedCatId;

      if (type === undefined) {
        const cat = await prisma.category.findUnique({ where: { id: resolvedCatId } });
        if (cat && (cat.type === 'INCOME' || cat.type === 'EXPENSE' || cat.type === 'SAVINGS')) {
          dataToUpdate.type = cat.type;
        }
      }
    }

    if (status === 'PAID' || status === 'PENDING') {
      dataToUpdate.status = status;
      dataToUpdate.paidAt = status === 'PAID' ? new Date() : null;
    }
    if (dueDate !== undefined) {
      const parsedDate = new Date(dueDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        dataToUpdate.dueDate = parsedDate;
      }
    }
    if (isShared !== undefined) dataToUpdate.isShared = Boolean(isShared);
    if (typeof notes === 'string') dataToUpdate.notes = notes.slice(0, 500);

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
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Falha ao atualizar lançamento.' });
  }
});

// Delete transaction with strict Ownership Verification
router.delete('/transactions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Lançamento não encontrado.' });
      return;
    }

    if (existing.userId !== req.user!.id) {
      res.status(403).json({ error: 'Sem permissão para excluir este lançamento.' });
      return;
    }

    await prisma.transaction.delete({ where: { id } });
    res.json({ success: true, message: 'Lançamento excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Falha ao excluir lançamento.' });
  }
});

export default router;
