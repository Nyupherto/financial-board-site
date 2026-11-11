import { describe, it, expect } from 'vitest';
import {
  calculateCompoundInterest,
  calculateAnalyticalFutureValue,
} from '../compoundInterest.js';
import { dollarsToCents, centsToDollars } from '../currency.js';

describe('Financial Math - Offline Compound Interest Engine', () => {
  it('computes 0% interest scenarios purely on principal and deposits', () => {
    const result = calculateCompoundInterest({
      initialPrincipalCents: dollarsToCents(1000), // $1,000
      monthlyContributionCents: dollarsToCents(200), // $200
      annualInterestRatePercent: 0,
      horizonMonths: 12,
    });

    // 1000 + 12 * 200 = 3400 ($3,400.00)
    expect(result.futureValueCents).toBe(dollarsToCents(3400));
    expect(result.totalPrincipalInvestedCents).toBe(dollarsToCents(3400));
    expect(result.totalInterestEarnedCents).toBe(0);
    expect(result.schedule.length).toBe(12);
    expect(result.schedule[11].endingBalanceCents).toBe(dollarsToCents(3400));
  });

  it('correctly calculates future value with compounding growth (deterministic ledger vs closed-form)', () => {
    // $10,000 initial, $500 monthly, 10% annual interest, 5 years (60 months)
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

    // Total invested: $10,000 + 60 * $500 = $40,000
    expect(result.totalPrincipalInvestedCents).toBe(dollarsToCents(40_000));

    // Expected analytical FV for 10% nominal over 5 years is approx $55,420
    const discreteDollars = centsToDollars(result.futureValueCents);
    const analyticalDollars = centsToDollars(analyticalFV);

    // Difference between discrete rounding per month and continuous/analytical should be under $1.50 across 60 months
    expect(Math.abs(discreteDollars - analyticalDollars)).toBeLessThan(1.50);

    // Future value must exceed principal invested
    expect(result.futureValueCents).toBeGreaterThan(result.totalPrincipalInvestedCents);
    expect(result.totalInterestEarnedCents).toBe(result.futureValueCents - result.totalPrincipalInvestedCents);
    expect(result.schedule.length).toBe(60);

    // Last month schedule check
    const last = result.schedule[59];
    expect(last.month).toBe(60);
    expect(last.endingBalanceCents).toBe(result.futureValueCents);
  });

  it('tracks financial milestones correctly', () => {
    // $5,000 initial, $1,500 monthly, 12% annual
    const result = calculateCompoundInterest({
      initialPrincipalCents: dollarsToCents(5_000),
      monthlyContributionCents: dollarsToCents(1_500),
      annualInterestRatePercent: 12,
      horizonMonths: 24,
    });

    // Milestone for $10,000: reached in month 4 ($5k + 4 * $1.5k + interest > $10k)
    const milestone10k = result.milestones.find((m) => m.targetCents === dollarsToCents(10_000));
    expect(milestone10k).toBeDefined();
    expect(milestone10k?.reachedAtMonth).toBe(4);

    // Milestone for $25,000: reached in month 13
    const milestone25k = result.milestones.find((m) => m.targetCents === dollarsToCents(25_000));
    expect(milestone25k).toBeDefined();
    expect(milestone25k?.reachedAtMonth).toBe(13);
  });
});
