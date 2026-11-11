import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { calculateCompoundInterest } from '../math/compoundInterest.js';
import { dollarsToCents, centsToDollars } from '../math/currency.js';

const router = Router();
const prisma = new PrismaClient();

// List savings goals with calculated projections
router.get('/savings', requireAuth, async (req: Request, res: Response) => {
  try {
    const goals = await prisma.savingsGoal.findMany({
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
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch savings goals', details: error.message });
  }
});

// Run 100% Offline Compound Interest Simulation (on-the-fly)
router.post('/savings/simulate', async (req: Request, res: Response) => {
  try {
    const {
      initialPrincipalDollars = 10000,
      monthlyContributionDollars = 500,
      annualInterestRatePercent = 10,
      horizonMonths = 60,
      contributionTiming = 'END_OF_PERIOD',
    } = req.body;

    const initialPrincipalCents = dollarsToCents(Number(initialPrincipalDollars));
    const monthlyContributionCents = dollarsToCents(Number(monthlyContributionDollars));
    const annualRate = Number(annualInterestRatePercent);
    const months = Math.max(1, Math.min(600, parseInt(horizonMonths, 10))); // clamp up to 50 years

    const result = calculateCompoundInterest({
      initialPrincipalCents,
      monthlyContributionCents,
      annualInterestRatePercent: annualRate,
      horizonMonths: months,
      contributionTiming: contributionTiming as any,
    });

    // Format schedule for frontend charts and table
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
  } catch (error: any) {
    res.status(500).json({ error: 'Simulation failed', details: error.message });
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

    if (!name || targetAmountDollars === undefined) {
      res.status(400).json({ error: 'Name and target amount are required' });
      return;
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: req.user!.id,
        name,
        targetAmountCents: dollarsToCents(Number(targetAmountDollars)),
        initialPrincipalCents: dollarsToCents(Number(initialPrincipalDollars)),
        monthlyContributionCents: dollarsToCents(Number(monthlyContributionDollars)),
        annualInterestRateBps: Math.round(Number(annualInterestRatePercent) * 100),
        horizonMonths: parseInt(horizonMonths, 10),
        currentBalanceCents: dollarsToCents(Number(initialPrincipalDollars)),
        contributionTiming,
        notes: notes || null,
      },
    });

    res.status(201).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create savings goal', details: error.message });
  }
});

export default router;
