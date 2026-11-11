/**
 * Safe Financial Currency & Integer Cents Module
 *
 * Implements strict integer-based currency arithmetic (cents) to avoid
 * IEEE 754 floating point precision hazards in financial accounting.
 * e.g., $0.10 + $0.20 === $0.30 (not 0.30000000000000004).
 */

export type Cents = number; // Represents an integer number of cents (1 USD = 100 Cents)

/**
 * Converts a standard decimal currency value (e.g., 50.75) into integer cents (5075).
 * Uses robust rounding to eliminate IEEE 754 input artifacts.
 */
export function dollarsToCents(dollars: number): Cents {
  if (!Number.isFinite(dollars)) {
    throw new TypeError(`Invalid currency amount: ${dollars}`);
  }
  return Math.round(dollars * 100);
}

/**
 * Converts integer cents (e.g., 5075) to a standard decimal float (50.75).
 */
export function centsToDollars(cents: Cents): number {
  if (!Number.isInteger(cents)) {
    throw new TypeError(`Cents must be an integer, received: ${cents}`);
  }
  return cents / 100;
}

/**
 * Formats integer cents into an English financial currency string (e.g., "$5,000.00").
 */
export function formatCurrency(
  cents: Cents,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Safe integer addition for cents.
 */
export function addCents(a: Cents, b: Cents): Cents {
  return Math.round(a) + Math.round(b);
}

/**
 * Safe integer subtraction for cents.
 */
export function subtractCents(a: Cents, b: Cents): Cents {
  return Math.round(a) - Math.round(b);
}

/**
 * Safe integer multiplication by a factor with half-up rounding.
 * e.g. calculating interest: cents * monthlyRate
 */
export function multiplyCentsByRate(cents: Cents, rate: number): Cents {
  if (!Number.isFinite(rate)) {
    throw new TypeError(`Rate must be finite, received: ${rate}`);
  }
  return Math.round(cents * rate);
}

/**
 * Allocates an integer cents amount proportionally across target percentages
 * ensuring the sum of allocated parts matches the original total exactly
 * (Hamilton-Hare largest remainder method) to eliminate fractional cent leakage.
 */
export function distributeCents(
  totalCents: Cents,
  weights: number[]
): Cents[] {
  if (totalCents <= 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const weightSum = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (weightSum === 0) {
    return weights.map(() => 0);
  }

  // First pass: floor allocations and calculate remainders
  const rawAllocations = weights.map((w) => {
    const proportional = (Math.max(0, w) / weightSum) * totalCents;
    const floored = Math.floor(proportional);
    const remainder = proportional - floored;
    return { floored, remainder };
  });

  const allocatedSum = rawAllocations.reduce((sum, item) => sum + item.floored, 0);
  let leftoverCents = totalCents - allocatedSum;

  // Second pass: distribute leftover cents to items with largest fractional remainder
  const sortedIndices = rawAllocations
    .map((item, index) => ({ index, remainder: item.remainder }))
    .sort((a, b) => b.remainder - a.remainder);

  const finalAllocations = rawAllocations.map((item) => item.floored);
  for (let i = 0; i < leftoverCents; i++) {
    const targetIdx = sortedIndices[i % sortedIndices.length].index;
    finalAllocations[targetIdx] += 1;
  }

  return finalAllocations;
}
