import { describe, it, expect } from 'vitest';
import {
  calculateCompoundInterest,
  calculateAnalyticalFutureValue,
  calculateSavingsGoalEta,
} from '../compoundInterest.js';
import { dollarsToCents, centsToDollars } from '../currency.js';

describe('Financial Math - Offline Compound Interest & Savings Goal Engine', () => {
  it('computes 0% interest scenarios purely on principal and deposits', () => {
    const result = calculateCompoundInterest({
      initialPrincipalCents: dollarsToCents(1000),
      monthlyContributionCents: dollarsToCents(200),
      annualInterestRatePercent: 0,
      horizonMonths: 12,
    });

    expect(result.futureValueCents).toBe(dollarsToCents(3400));
    expect(result.totalPrincipalInvestedCents).toBe(dollarsToCents(3400));
    expect(result.totalInterestEarnedCents).toBe(0);
    expect(result.schedule.length).toBe(12);
    expect(result.schedule[11].endingBalanceCents).toBe(dollarsToCents(3400));
  });

  it('correctly calculates future value with compounding growth (deterministic ledger vs closed-form)', () => {
    const initial = dollarsToCents(10_000);
    const monthly = dollarsToCents(500);
    const rate = 10;
    const months = 60;

    const result = calculateCompoundInterest({
      initialPrincipalCents: initial,
      monthlyContributionCents: monthly,
      annualInterestRatePercent: rate,
      horizonMonths: months,
    });

    const analyticalFV = calculateAnalyticalFutureValue(initial, monthly, rate, months);

    expect(result.totalPrincipalInvestedCents).toBe(dollarsToCents(40_000));

    const discreteDollars = centsToDollars(result.futureValueCents);
    const analyticalDollars = centsToDollars(analyticalFV);

    expect(Math.abs(discreteDollars - analyticalDollars)).toBeLessThan(1.50);
    expect(result.futureValueCents).toBeGreaterThan(result.totalPrincipalInvestedCents);
    expect(result.totalInterestEarnedCents).toBe(result.futureValueCents - result.totalPrincipalInvestedCents);
    expect(result.schedule.length).toBe(60);
  });

  it('calculates how many months to reach a Savings Goal (Meta) with compound interest vs without', () => {
    const eta = calculateSavingsGoalEta({
      currentSavedCents: dollarsToCents(5_000),
      averageMonthlyContributionCents: dollarsToCents(1_000),
      targetAmountCents: dollarsToCents(25_000),
      annualInterestRatePercent: 12,
    });

    // Without interest: (25000 - 5000) / 1000 = 20 months
    expect(eta.monthsToGoalWithoutInterest).toBe(20);
    // With 12% annual compound interest, it reaches $25,000 faster (< 20 months)
    expect(eta.monthsToGoalWithInterest).not.toBeNull();
    expect(eta.monthsToGoalWithInterest!).toBeLessThan(20);
    expect(eta.interestSavedMonths).toBeGreaterThan(0);
  });
});
