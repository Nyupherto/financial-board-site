/**
 * 100% Offline Deterministic Compound Interest & Savings Engine
 *
 * Implements standard financial engineering formulas for wealth projection,
 * fixed-income growth simulation, and month-by-month amortization schedules.
 * All computations use integer cents to guarantee deterministic outputs.
 */

import {
  Cents,
  dollarsToCents,
  centsToDollars,
  multiplyCentsByRate,
  addCents,
  subtractCents,
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
    ((Math.pow(1 + monthlyRate, compoundingFrequencyPerYear) - 1) * 100);

  const schedule: MonthlyScheduleEntry[] = [];
  let currentBalance = initialPrincipalCents;
  let cumulativePrincipal = initialPrincipalCents;
  let cumulativeInterest = 0;

  // Track standard financial milestone thresholds ($10k, $25k, $50k, $100k, $250k, $500k, $1M)
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
      // Annuity Due: contribution earns interest in the current month
      const balanceBeforeInterest = addCents(startBalance, contribution);
      interestEarned = multiplyCentsByRate(balanceBeforeInterest, monthlyRate);
      endBalance = addCents(balanceBeforeInterest, interestEarned);
    } else {
      // Ordinary Annuity (End of Period): interest earned on starting balance, contribution added at month-end
      interestEarned = multiplyCentsByRate(startBalance, monthlyRate);
      endBalance = addCents(addCents(startBalance, interestEarned), contribution);
    }

    cumulativePrincipal = addCents(cumulativePrincipal, contribution);
    cumulativeInterest = addCents(cumulativeInterest, interestEarned);
    currentBalance = endBalance;

    // Check milestones
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
    effectiveMonthlyRatePercent: monthlyRate * 100,
    effectiveAnnualRatePercent: Number(effectiveAnnualRatePercent.toFixed(4)),
    horizonMonths,
    schedule,
    milestones,
  };
}

/**
 * Closed-form analytical formula for compound interest future value.
 * Used for cross-validation against discrete ledger simulation:
 * FV = P * (1 + i)^n + PMT * [((1 + i)^n - 1) / i]
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
