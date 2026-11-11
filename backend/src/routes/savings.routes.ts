import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { calculateCompoundInterest } from '../math/compoundInterest.js';
import { dollarsToCents, centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

const MAX_SIM_PRINCIPAL = 100_000_000;
const MAX_SIM_CONTRIBUTION = 10_000_000;

// List savings goals with calculated projections
router.get('/savings', requireAuth, async (req: Request, res: Response) => {
  try {
    const whereClause = req.user!.role === 'ADMIN' ? {} : { userId: req.user!.id };

    const goals = await prisma.savingsGoal.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedGoals = goals.map((goal) => {
      const projection = calculateCompoundInterest({
        initialPrincipalCents: goal.initialPrincipalCents,
        monthlyContributionCents: goal.monthlyContributionCents,
        annualInterestRatePercent: goal.annualInterestRateBps / 100,
        horizonMonths: goal.horizonMonths,
        contributionTiming: goal.contributionTiming as any,
      });

      return {
        id: goal.id,
        name: goal.name,
        targetAmountDollars: centsToDollars(goal.targetAmountCents),
        initialPrincipalDollars: centsToDollars(goal.initialPrincipalCents),
        monthlyContributionDollars: centsToDollars(goal.monthlyContributionCents),
        annualInterestRatePercent: goal.annualInterestRateBps / 100,
        horizonMonths: goal.horizonMonths,
        currentBalanceDollars: centsToDollars(goal.currentBalanceCents),
        contributionTiming: goal.contributionTiming,
        isCompleted: goal.isCompleted,
        notes: goal.notes,
        user: goal.user,
        projection: {
          futureValueDollars: centsToDollars(projection.futureValueCents),
          totalPrincipalInvestedDollars: centsToDollars(projection.totalPrincipalInvestedCents),
          totalInterestEarnedDollars: centsToDollars(projection.totalInterestEarnedCents),
          effectiveAnnualRatePercent: projection.effectiveAnnualRatePercent,
          milestones: projection.milestones.map((m) => ({
            targetDollars: centsToDollars(m.targetCents),
            reachedAtMonth: m.reachedAtMonth,
            reachedAtYear: m.reachedAtYear,
          })),
        },
      };
    });

    res.json(enrichedGoals);
  } catch {
    res.status(500).json({ error: 'Failed to fetch savings goals' });
  }
});

// Run 100% Offline Compound Interest Simulation (on-the-fly, authenticated)
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

    const initialPrincipalCents = dollarsToCents(rawPrincipal);
    const monthlyContributionCents = dollarsToCents(rawMonthly);

    const result = calculateCompoundInterest({
      initialPrincipalCents,
      monthlyContributionCents,
      annualInterestRatePercent: annualRate,
      horizonMonths: months,
      contributionTiming: safeTiming,
    });

    const formattedSchedule = result.schedule.map((entry) => ({
      month: entry.month,
      year: entry.year,
      startingBalanceDollars: centsToDollars(entry.startingBalanceCents),
      contributionDollars: centsToDollars(entry.contributionCents),
      interestEarnedDollars: centsToDollars(entry.interestEarnedCents),
      endingBalanceDollars: centsToDollars(entry.endingBalanceCents),
      cumulativePrincipalDollars: centsToDollars(entry.cumulativePrincipalCents),
      cumulativeInterestDollars: centsToDollars(entry.cumulativeInterestCents),
    }));

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
      milestones: result.milestones.map((m) => ({
        targetDollars: centsToDollars(m.targetCents),
        reachedAtMonth: m.reachedAtMonth,
        reachedAtYear: m.reachedAtYear,
      })),
      schedule: formattedSchedule,
    });
  } catch {
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// Create new savings goal
router.post('/savings', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      targetAmountDollars,
      initialPrincipalDollars = 0,
      monthlyContributionDollars = 0,
      annualInterestRatePercent = 8.5,
      horizonMonths = 36,
      contributionTiming = 'END_OF_PERIOD',
      notes,
    } = req.body;

    if (!name || typeof name !== 'string' || targetAmountDollars === undefined) {
      res.status(400).json({ error: 'Name and target amount are required' });
      return;
    }

    const cleanName = name.trim().slice(0, 120);
    if (!cleanName) {
      res.status(400).json({ error: 'Invalid goal name' });
      return;
    }

    const safeTarget = Math.max(0, Math.min(MAX_SIM_PRINCIPAL, Number(targetAmountDollars) || 0));
    const safePrincipal = Math.max(0, Math.min(MAX_SIM_PRINCIPAL, Number(initialPrincipalDollars) || 0));
    const safeContribution = Math.max(0, Math.min(MAX_SIM_CONTRIBUTION, Number(monthlyContributionDollars) || 0));
    const safeRate = Math.max(0, Math.min(100, Number(annualInterestRatePercent) || 0));
    const safeHorizon = Math.max(1, Math.min(600, parseInt(String(horizonMonths), 10) || 36));
    const safeTiming = contributionTiming === 'BEGINNING_OF_PERIOD' ? 'BEGINNING_OF_PERIOD' : 'END_OF_PERIOD';

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: req.user!.id,
        name: cleanName,
        targetAmountCents: dollarsToCents(safeTarget),
        initialPrincipalCents: dollarsToCents(safePrincipal),
        monthlyContributionCents: dollarsToCents(safeContribution),
        annualInterestRateBps: Math.round(safeRate * 100),
        horizonMonths: safeHorizon,
        currentBalanceCents: dollarsToCents(safePrincipal),
        contributionTiming: safeTiming,
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
      },
    });

    res.status(201).json(goal);
  } catch {
    res.status(500).json({ error: 'Failed to create savings goal' });
  }
});

export default router;
