import { describe, it, expect } from 'vitest';
import {
  dollarsToCents,
  centsToDollars,
  formatCurrency,
  addCents,
  subtractCents,
  multiplyCentsByRate,
  distributeCents,
} from '../currency.js';

describe('Financial Math - Currency & Integer Cents Core', () => {
  it('converts floating-point dollars to exact integer cents without precision loss', () => {
    // Classic IEEE 754 precision trap: 0.1 + 0.2 = 0.30000000000000004
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(5000.75)).toBe(500075);
    expect(dollarsToCents(0.01)).toBe(1);
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(1234567.89)).toBe(123456789);
  });

  it('converts integer cents back to decimal dollars', () => {
    expect(centsToDollars(500075)).toBe(5000.75);
    expect(centsToDollars(30)).toBe(0.3);
    expect(centsToDollars(1)).toBe(0.01);
  });

  it('formats cents into US currency strings correctly', () => {
    expect(formatCurrency(500075)).toBe('$5,000.75');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(100)).toBe('$1.00');
  });

  it('performs exact addition and subtraction without floating-point artifacts', () => {
    const a = dollarsToCents(70.10);
    const b = dollarsToCents(150.20);
    const sum = addCents(a, b);
    expect(sum).toBe(22030); // $220.30
    expect(subtractCents(sum, a)).toBe(b);
  });

  it('multiplies cents by interest rate with half-up rounding', () => {
    // $1,000.00 at 0.7083% monthly interest rate (8.5% annual / 12)
    const principalCents = 100000;
    const monthlyRate = 0.085 / 12; // 0.00708333...
    const interest = multiplyCentsByRate(principalCents, monthlyRate);
    expect(interest).toBe(708); // $7.08
  });

  it('distributes cents with zero cent loss using Largest Remainder Method', () => {
    // Split $100.00 (10000 cents) in thirds: 33.33%, 33.33%, 33.33%
    const total = 10000;
    const weights = [1, 1, 1];
    const distributed = distributeCents(total, weights);

    expect(distributed).toEqual([3334, 3333, 3333]); // 3334 + 3333 + 3333 = 10000 exactly!
    const totalAllocated = distributed.reduce((a, b) => a + b, 0);
    expect(totalAllocated).toBe(total);
  });
});
