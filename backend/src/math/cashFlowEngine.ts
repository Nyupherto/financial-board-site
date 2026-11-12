/**
 * Real-Time Cash Flow & Smart Allocation Balance Engine
 *
 * Implements deterministic double-entry compatible financial balance calculations
 * for personal & family budgets, accounts payable/receivable, paid vs pending liabilities,
 * savings/goal allocations, net remaining liquidity, and bucket allocation rules.
 */

import {
  Cents,
  addCents,
  subtractCents,
  distributeCents,
} from './currency.js';

export type TransactionType = 'INCOME' | 'EXPENSE' | 'SAVINGS';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface TransactionItem {
  id: string;
  userId: string;
  categoryId: string;
  categoryName?: string;
  description: string;
  amountCents: Cents;
  type: TransactionType;
  status: PaymentStatus;
  dueDate?: string;
  paidAt?: string | null;
  isShared?: boolean;
}

export interface AllocationBucketRule {
  id: string;
  name: string;
  targetPercentage?: number;
  allocatedAmountCents?: Cents;
}

export interface BucketAllocationResult {
  bucketId: string;
  bucketName: string;
  allocatedAmountCents: Cents;
  percentageOfNetCashFlow: number;
}

export interface MonthlyBalanceSummary {
  totalIncomeCents: Cents;
  totalExpensesCents: Cents;
  totalPaidExpensesCents: Cents;
  totalPendingExpensesCents: Cents;
  totalSavingsCents: Cents;
  netRemainingCashFlowCents: Cents; // Total Income - Total Expenses - Total Savings
  netLiquidCashOnHandCents: Cents; // Total Income - Total Paid Expenses - Paid Savings
  savingsRatePercent: number; // ((Net Remaining + Total Savings) / Total Income) * 100
  expenseToIncomeRatioPercent: number; // (Total Expenses / Total Income) * 100
  pendingLiabilitiesCount: number;
  paidLiabilitiesCount: number;
  savingsTransactionsCount: number;
  allocations: BucketAllocationResult[];
  unallocatedCashFlowCents: Cents;
  isDeficit: boolean;
  deficitAmountCents: Cents;
}

/**
 * Calculates comprehensive cash flow metrics for a given collection of transactions
 * and optional smart bucket allocation rules.
 */
export function calculateCashFlow(
  transactions: TransactionItem[],
  bucketRules: AllocationBucketRule[] = []
): MonthlyBalanceSummary {
  let totalIncomeCents = 0;
  let totalPaidExpensesCents = 0;
  let totalPendingExpensesCents = 0;
  let totalSavingsCents = 0;
  let paidSavingsCents = 0;
  let pendingCount = 0;
  let paidCount = 0;
  let savingsCount = 0;

  for (const tx of transactions) {
    if (tx.type === 'INCOME') {
      totalIncomeCents = addCents(totalIncomeCents, tx.amountCents);
    } else if (tx.type === 'SAVINGS') {
      totalSavingsCents = addCents(totalSavingsCents, tx.amountCents);
      savingsCount++;
      if (tx.status === 'PAID') {
        paidSavingsCents = addCents(paidSavingsCents, tx.amountCents);
      }
    } else if (tx.type === 'EXPENSE') {
      if (tx.status === 'PAID') {
        totalPaidExpensesCents = addCents(totalPaidExpensesCents, tx.amountCents);
        paidCount++;
      } else {
        totalPendingExpensesCents = addCents(totalPendingExpensesCents, tx.amountCents);
        pendingCount++;
      }
    }
  }

  const totalExpensesCents = addCents(totalPaidExpensesCents, totalPendingExpensesCents);
  const totalOutflowsCents = addCents(totalExpensesCents, totalSavingsCents);
  const netRemainingCashFlowCents = subtractCents(totalIncomeCents, totalOutflowsCents);
  const netLiquidCashOnHandCents = subtractCents(
    subtractCents(totalIncomeCents, totalPaidExpensesCents),
    paidSavingsCents
  );

  const isDeficit = netRemainingCashFlowCents < 0;
  const deficitAmountCents = isDeficit ? Math.abs(netRemainingCashFlowCents) : 0;

  const expenseToIncomeRatioPercent =
    totalIncomeCents > 0
      ? Number(((totalExpensesCents / totalIncomeCents) * 100).toFixed(2))
      : totalExpensesCents > 0
      ? 100
      : 0;

  const totalSavedOrRemaining = addCents(Math.max(0, netRemainingCashFlowCents), totalSavingsCents);
  const savingsRatePercent =
    totalIncomeCents > 0
      ? Number(((totalSavedOrRemaining / totalIncomeCents) * 100).toFixed(2))
      : 0;

  // Process Smart Bucket Allocations
  const allocations: BucketAllocationResult[] = [];
  let unallocatedCashFlowCents = Math.max(0, netRemainingCashFlowCents);

  if (bucketRules.length > 0 && netRemainingCashFlowCents > 0) {
    const hasFixed = bucketRules.some((b) => b.allocatedAmountCents !== undefined);

    if (hasFixed) {
      let allocatedTotal = 0;
      for (const bucket of bucketRules) {
        const assigned = Math.min(
          bucket.allocatedAmountCents ?? 0,
          Math.max(0, netRemainingCashFlowCents - allocatedTotal)
        );
        allocatedTotal += assigned;
        allocations.push({
          bucketId: bucket.id,
          bucketName: bucket.name,
          allocatedAmountCents: assigned,
          percentageOfNetCashFlow:
            netRemainingCashFlowCents > 0
              ? Number(((assigned / netRemainingCashFlowCents) * 100).toFixed(2))
              : 0,
        });
      }
      unallocatedCashFlowCents = subtractCents(netRemainingCashFlowCents, allocatedTotal);
    } else {
      const weights = bucketRules.map((b) => b.targetPercentage ?? 0);
      const distributed = distributeCents(netRemainingCashFlowCents, weights);

      for (let i = 0; i < bucketRules.length; i++) {
        const allocated = distributed[i];
        allocations.push({
          bucketId: bucketRules[i].id,
          bucketName: bucketRules[i].name,
          allocatedAmountCents: allocated,
          percentageOfNetCashFlow:
            netRemainingCashFlowCents > 0
              ? Number(((allocated / netRemainingCashFlowCents) * 100).toFixed(2))
              : 0,
        });
      }
      unallocatedCashFlowCents = 0;
    }
  }

  return {
    totalIncomeCents,
    totalExpensesCents,
    totalPaidExpensesCents,
    totalPendingExpensesCents,
    totalSavingsCents,
    netRemainingCashFlowCents,
    netLiquidCashOnHandCents,
    savingsRatePercent,
    expenseToIncomeRatioPercent,
    pendingLiabilitiesCount: pendingCount,
    paidLiabilitiesCount: paidCount,
    savingsTransactionsCount: savingsCount,
    allocations,
    unallocatedCashFlowCents,
    isDeficit,
    deficitAmountCents,
  };
}

/**
 * Calculates Month-over-Month historical comparison metrics.
 */
export interface MonthOverMonthDelta {
  incomeDeltaCents: Cents;
  incomeGrowthPercent: number;
  expenseDeltaCents: Cents;
  expenseGrowthPercent: number;
  netCashFlowDeltaCents: Cents;
  netCashFlowGrowthPercent: number;
}

export function compareMonths(
  current: MonthlyBalanceSummary,
  previous: MonthlyBalanceSummary
): MonthOverMonthDelta {
  const incomeDeltaCents = subtractCents(current.totalIncomeCents, previous.totalIncomeCents);
  const incomeGrowthPercent =
    previous.totalIncomeCents > 0
      ? Number(((incomeDeltaCents / previous.totalIncomeCents) * 100).toFixed(2))
      : 0;

  const expenseDeltaCents = subtractCents(current.totalExpensesCents, previous.totalExpensesCents);
  const expenseGrowthPercent =
    previous.totalExpensesCents > 0
      ? Number(((expenseDeltaCents / previous.totalExpensesCents) * 100).toFixed(2))
      : 0;

  const netCashFlowDeltaCents = subtractCents(
    current.netRemainingCashFlowCents,
    previous.netRemainingCashFlowCents
  );
  const netCashFlowGrowthPercent =
    previous.netRemainingCashFlowCents !== 0
      ? Number(((netCashFlowDeltaCents / Math.abs(previous.netRemainingCashFlowCents)) * 100).toFixed(2))
      : 0;

  return {
    incomeDeltaCents,
    incomeGrowthPercent,
    expenseDeltaCents,
    expenseGrowthPercent,
    netCashFlowDeltaCents,
    netCashFlowGrowthPercent,
  };
}
