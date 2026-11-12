/**
 * 100% Offline Deterministic Compound Interest & Savings Goal Engine
 *
 * Implements standard financial engineering formulas for wealth projection,
 * fixed-income growth simulation, month-by-month amortization schedules,
 * and Savings Goal ETA calculation based on historical contribution averages.
 * All computations use integer cents to guarantee deterministic outputs.
 */

import {
  Cents,
  dollarsToCents,
  centsToDollars,
  multiplyCentsByRate,
  addCents,
} from './currency.js';

export interface CompoundInterestInput {
  initialPrincipalCents: Cents; // Initial sum P
  monthlyContributionCents: Cents; // Regular periodic payment PMT
  annualInterestRatePercent: number; // e.g., 10.5 for 10.5% per annum
  horizonMonths: number; // Duration n in months
  compoundingFrequencyPerYear?: number; // Defaults to 12 (monthly compounding)
  contributionTiming?: 'END_OF_PERIOD' | 'BEGINNING_OF_PERIOD'; // Ordinary Annuity vs Annuity Due
}

export interface MonthlyScheduleEntry {
  month: number;
  year: number;
  startingBalanceCents: Cents;
  contributionCents: Cents;
  interestEarnedCents: Cents;
  endingBalanceCents: Cents;
  cumulativePrincipalCents: Cents;
  cumulativeInterestCents: Cents;
}

export interface MilestoneTarget {
  targetCents: Cents;
  reachedAtMonth: number | null;
  reachedAtYear: number | null;
}

export interface CompoundInterestResult {
  futureValueCents: Cents;
  totalPrincipalInvestedCents: Cents;
  totalInterestEarnedCents: Cents;
  nominalAnnualRatePercent: number;
  effectiveMonthlyRatePercent: number;
  effectiveAnnualRatePercent: number;
  horizonMonths: number;
  schedule: MonthlyScheduleEntry[];
  milestones: MilestoneTarget[];
}

export interface SavingsGoalEtaInput {
  currentSavedCents: Cents;
  averageMonthlyContributionCents: Cents;
  targetAmountCents: Cents;
  annualInterestRatePercent: number;
}

export interface SavingsGoalEtaResult {
  isReached: boolean;
  monthsToGoalWithInterest: number | null;
  monthsToGoalWithoutInterest: number | null;
  interestSavedMonths: number;
  projectedFinalBalanceCents: Cents;
  projectedTotalPrincipalCents: Cents;
  projectedTotalInterestCents: Cents;
  effectiveMonthlyRatePercent: number;
  effectiveAnnualRatePercent: number;
  schedule: MonthlyScheduleEntry[];
}

/**
 * Calculates discrete month-by-month compound growth.
 * Uses exact integer cent rounding per period to replicate real-world bank ledger accounting.
 */
export function calculateCompoundInterest(
  input: CompoundInterestInput
): CompoundInterestResult {
  const {
    initialPrincipalCents,
    monthlyContributionCents,
    annualInterestRatePercent,
    horizonMonths,
    compoundingFrequencyPerYear = 12,
    contributionTiming = 'END_OF_PERIOD',
  } = input;

  if (horizonMonths < 0 || !Number.isInteger(horizonMonths)) {
    throw new RangeError(`Horizon months must be a non-negative integer: ${horizonMonths}`);
  }
  if (initialPrincipalCents < 0 || monthlyContributionCents < 0) {
    throw new RangeError('Principal and monthly contribution must be non-negative.');
  }

  // Monthly nominal rate: i = (r / 100) / 12
  const monthlyRate = annualInterestRatePercent / 100 / (compoundingFrequencyPerYear || 12);
  const effectiveAnnualRatePercent =
    (Math.pow(1 + monthlyRate, compoundingFrequencyPerYear) - 1) * 100;

  const schedule: MonthlyScheduleEntry[] = [];
  let currentBalance = initialPrincipalCents;
  let cumulativePrincipal = initialPrincipalCents;
  let cumulativeInterest = 0;

  const defaultMilestones: Cents[] = [
    dollarsToCents(10_000),
    dollarsToCents(25_000),
    dollarsToCents(50_000),
    dollarsToCents(100_000),
    dollarsToCents(250_000),
    dollarsToCents(500_000),
    dollarsToCents(1_000_000),
  ];

  const milestones: MilestoneTarget[] = defaultMilestones.map((targetCents) => ({
    targetCents,
    reachedAtMonth: currentBalance >= targetCents ? 0 : null,
    reachedAtYear: currentBalance >= targetCents ? 0 : null,
  }));

  for (let m = 1; m <= horizonMonths; m++) {
    const startBalance = currentBalance;
    const contribution = monthlyContributionCents;

    let interestEarned = 0;
    let endBalance = startBalance;

    if (contributionTiming === 'BEGINNING_OF_PERIOD') {
      const balanceBeforeInterest = addCents(startBalance, contribution);
      interestEarned = multiplyCentsByRate(balanceBeforeInterest, monthlyRate);
      endBalance = addCents(balanceBeforeInterest, interestEarned);
    } else {
      interestEarned = multiplyCentsByRate(startBalance, monthlyRate);
      endBalance = addCents(addCents(startBalance, interestEarned), contribution);
    }

    cumulativePrincipal = addCents(cumulativePrincipal, contribution);
    cumulativeInterest = addCents(cumulativeInterest, interestEarned);
    currentBalance = endBalance;

    for (const ms of milestones) {
      if (ms.reachedAtMonth === null && currentBalance >= ms.targetCents) {
        ms.reachedAtMonth = m;
        ms.reachedAtYear = Number((m / 12).toFixed(1));
      }
    }

    schedule.push({
      month: m,
      year: Math.floor((m - 1) / 12) + 1,
      startingBalanceCents: startBalance,
      contributionCents: contribution,
      interestEarnedCents: interestEarned,
      endingBalanceCents: endBalance,
      cumulativePrincipalCents: cumulativePrincipal,
      cumulativeInterestCents: cumulativeInterest,
    });
  }

  return {
    futureValueCents: currentBalance,
    totalPrincipalInvestedCents: cumulativePrincipal,
    totalInterestEarnedCents: cumulativeInterest,
    nominalAnnualRatePercent: annualInterestRatePercent,
    effectiveMonthlyRatePercent: Number((monthlyRate * 100).toFixed(4)),
    effectiveAnnualRatePercent: Number(effectiveAnnualRatePercent.toFixed(4)),
    horizonMonths,
    schedule,
    milestones,
  };
}

/**
 * Calculates how many months it takes to reach an individual Savings Goal (Meta)
 * given the current accumulated balance, the historical average monthly contribution,
 * and the internal annual interest rate.
 */
export function calculateSavingsGoalEta(
  input: SavingsGoalEtaInput
): SavingsGoalEtaResult {
  const {
    currentSavedCents,
    averageMonthlyContributionCents,
    targetAmountCents,
    annualInterestRatePercent,
  } = input;

  const safeCurrent = Math.max(0, Math.round(currentSavedCents));
  const safeMonthly = Math.max(0, Math.round(averageMonthlyContributionCents));
  const safeTarget = Math.max(0, Math.round(targetAmountCents));
  const safeAnnualRate = Math.max(0, Math.min(100, Number(annualInterestRatePercent) || 0));

  const monthlyRate = safeAnnualRate / 100 / 12;
  const effectiveAnnualRatePercent = Number(
    ((Math.pow(1 + monthlyRate, 12) - 1) * 100).toFixed(4)
  );
  const effectiveMonthlyRatePercent = Number((monthlyRate * 100).toFixed(4));

  // If target is already reached
  if (safeTarget > 0 && safeCurrent >= safeTarget) {
    const previewSim = calculateCompoundInterest({
      initialPrincipalCents: safeCurrent,
      monthlyContributionCents: safeMonthly,
      annualInterestRatePercent: safeAnnualRate,
      horizonMonths: 12,
    });

    return {
      isReached: true,
      monthsToGoalWithInterest: 0,
      monthsToGoalWithoutInterest: 0,
      interestSavedMonths: 0,
      projectedFinalBalanceCents: safeCurrent,
      projectedTotalPrincipalCents: safeCurrent,
      projectedTotalInterestCents: 0,
      effectiveMonthlyRatePercent,
      effectiveAnnualRatePercent,
      schedule: previewSim.schedule,
    };
  }

  // If no target is set yet, return a 12-month compound projection of current flow
  if (safeTarget <= 0) {
    const previewSim = calculateCompoundInterest({
      initialPrincipalCents: safeCurrent,
      monthlyContributionCents: safeMonthly,
      annualInterestRatePercent: safeAnnualRate,
      horizonMonths: 12,
    });

    return {
      isReached: false,
      monthsToGoalWithInterest: null,
      monthsToGoalWithoutInterest: null,
      interestSavedMonths: 0,
      projectedFinalBalanceCents: previewSim.futureValueCents,
      projectedTotalPrincipalCents: previewSim.totalPrincipalInvestedCents,
      projectedTotalInterestCents: previewSim.totalInterestEarnedCents,
      effectiveMonthlyRatePercent,
      effectiveAnnualRatePercent,
      schedule: previewSim.schedule,
    };
  }

  const remainingCents = safeTarget - safeCurrent;
  const monthsWithoutInterest =
    safeMonthly > 0 ? Math.ceil(remainingCents / safeMonthly) : null;

  // Check if neither contributions nor interest can grow the balance
  const initialMonthlyInterest = multiplyCentsByRate(safeCurrent, monthlyRate);
  if (safeMonthly === 0 && initialMonthlyInterest === 0) {
    return {
      isReached: false,
      monthsToGoalWithInterest: null,
      monthsToGoalWithoutInterest: null,
      interestSavedMonths: 0,
      projectedFinalBalanceCents: safeCurrent,
      projectedTotalPrincipalCents: safeCurrent,
      projectedTotalInterestCents: 0,
      effectiveMonthlyRatePercent,
      effectiveAnnualRatePercent,
      schedule: [],
    };
  }

  // Step month-by-month up to 600 months (50 years) using exact compound interest ledger
  const MAX_HORIZON = 600;
  const schedule: MonthlyScheduleEntry[] = [];
  let balance = safeCurrent;
  let cumulativePrincipal = safeCurrent;
  let cumulativeInterest = 0;
  let reachedMonth: number | null = null;

  for (let m = 1; m <= MAX_HORIZON; m++) {
    const startBalance = balance;
    const interestEarned = multiplyCentsByRate(startBalance, monthlyRate);
    const endBalance = addCents(addCents(startBalance, interestEarned), safeMonthly);

    cumulativePrincipal = addCents(cumulativePrincipal, safeMonthly);
    cumulativeInterest = addCents(cumulativeInterest, interestEarned);
    balance = endBalance;

    schedule.push({
      month: m,
      year: Math.floor((m - 1) / 12) + 1,
      startingBalanceCents: startBalance,
      contributionCents: safeMonthly,
      interestEarnedCents: interestEarned,
      endingBalanceCents: endBalance,
      cumulativePrincipalCents: cumulativePrincipal,
      cumulativeInterestCents: cumulativeInterest,
    });

    if (balance >= safeTarget) {
      reachedMonth = m;
      break;
    }
  }

  const interestSavedMonths =
    reachedMonth !== null && monthsWithoutInterest !== null
      ? Math.max(0, monthsWithoutInterest - reachedMonth)
      : 0;

  return {
    isReached: false,
    monthsToGoalWithInterest: reachedMonth,
    monthsToGoalWithoutInterest: monthsWithoutInterest,
    interestSavedMonths,
    projectedFinalBalanceCents: balance,
    projectedTotalPrincipalCents: cumulativePrincipal,
    projectedTotalInterestCents: cumulativeInterest,
    effectiveMonthlyRatePercent,
    effectiveAnnualRatePercent,
    schedule: schedule.slice(0, Math.min(schedule.length, Math.max(reachedMonth || 24, 12))),
  };
}

/**
 * Closed-form analytical formula for compound interest future value.
 */
export function calculateAnalyticalFutureValue(
  initialPrincipalCents: Cents,
  monthlyContributionCents: Cents,
  annualInterestRatePercent: number,
  horizonMonths: number
): Cents {
  const i = annualInterestRatePercent / 100 / 12;
  const P = centsToDollars(initialPrincipalCents);
  const PMT = centsToDollars(monthlyContributionCents);

  if (i === 0) {
    return dollarsToCents(P + PMT * horizonMonths);
  }

  const compoundFactor = Math.pow(1 + i, horizonMonths);
  const fvPrincipal = P * compoundFactor;
  const fvAnnuity = PMT * ((compoundFactor - 1) / i);

  return dollarsToCents(fvPrincipal + fvAnnuity);
}
