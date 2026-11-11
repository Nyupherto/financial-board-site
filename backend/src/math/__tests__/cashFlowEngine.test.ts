import { describe, it, expect } from 'vitest';
import {
  calculateCashFlow,
  compareMonths,
  TransactionItem,
  AllocationBucketRule,
} from '../cashFlowEngine.js';
import { dollarsToCents } from '../currency.js';

describe('Financial Math - Cash Flow & Allocation Balance Engine', () => {
  it('correctly calculates total income, paid, pending, and net remaining cash flow', () => {
    const transactions: TransactionItem[] = [
      {
        id: 'tx-1',
        userId: 'user-admin',
        categoryId: 'cat-salary',
        description: 'Primary Salary',
        amountCents: dollarsToCents(5000), // $5,000.00 Income
        type: 'INCOME',
        status: 'PAID',
      },
      {
        id: 'tx-2',
        userId: 'user-member-1',
        categoryId: 'cat-utilities',
        description: 'Water Bill',
        amountCents: dollarsToCents(70), // $70.00 Paid Expense
        type: 'EXPENSE',
        status: 'PAID',
      },
      {
        id: 'tx-3',
        userId: 'user-admin',
        categoryId: 'cat-housing',
        description: 'Condo Fee',
        amountCents: dollarsToCents(150), // $150.00 Pending Expense
        type: 'EXPENSE',
        status: 'PENDING',
      },
    ];

    const summary = calculateCashFlow(transactions);

    expect(summary.totalIncomeCents).toBe(dollarsToCents(5000));
    expect(summary.totalPaidExpensesCents).toBe(dollarsToCents(70));
    expect(summary.totalPendingExpensesCents).toBe(dollarsToCents(150));
    expect(summary.totalExpensesCents).toBe(dollarsToCents(220));

    // Net remaining = Income - Total Expenses (5000 - 220 = $4,780.00)
    expect(summary.netRemainingCashFlowCents).toBe(dollarsToCents(4780));

    // Net liquid cash on hand = Income - Paid Expenses (5000 - 70 = $4,930.00)
    expect(summary.netLiquidCashOnHandCents).toBe(dollarsToCents(4930));

    expect(summary.paidLiabilitiesCount).toBe(1);
    expect(summary.pendingLiabilitiesCount).toBe(1);
    expect(summary.isDeficit).toBe(false);
  });

  it('correctly allocates cash flow to smart buckets using percentage weights', () => {
    const transactions: TransactionItem[] = [
      {
        id: 'tx-1',
        userId: 'user-admin',
        categoryId: 'cat-salary',
        description: 'Salary',
        amountCents: dollarsToCents(4000),
        type: 'INCOME',
        status: 'PAID',
      },
      {
        id: 'tx-2',
        userId: 'user-admin',
        categoryId: 'cat-expenses',
        description: 'Fixed Living Costs',
        amountCents: dollarsToCents(2000),
        type: 'EXPENSE',
        status: 'PAID',
      },
    ];

    // Net remaining is $2,000.00 (200,000 cents)
    const buckets: AllocationBucketRule[] = [
      { id: 'b-emergency', name: 'Emergency Fund', targetPercentage: 50 }, // 50% -> $1,000
      { id: 'b-investments', name: 'Investments', targetPercentage: 30 }, // 30% -> $600
      { id: 'b-leisure', name: 'Leisure', targetPercentage: 20 }, // 20% -> $400
    ];

    const summary = calculateCashFlow(transactions, buckets);

    expect(summary.allocations.length).toBe(3);
    expect(summary.allocations[0].allocatedAmountCents).toBe(dollarsToCents(1000));
    expect(summary.allocations[1].allocatedAmountCents).toBe(dollarsToCents(600));
    expect(summary.allocations[2].allocatedAmountCents).toBe(dollarsToCents(400));
    expect(summary.unallocatedCashFlowCents).toBe(0);
  });

  it('detects cash flow deficit when expenses exceed income', () => {
    const transactions: TransactionItem[] = [
      {
        id: 'tx-1',
        userId: 'user-1',
        categoryId: 'cat-salary',
        description: 'Part-time Income',
        amountCents: dollarsToCents(1000),
        type: 'INCOME',
        status: 'PAID',
      },
      {
        id: 'tx-2',
        userId: 'user-1',
        categoryId: 'cat-rent',
        description: 'Rent',
        amountCents: dollarsToCents(1200),
        type: 'EXPENSE',
        status: 'PENDING',
      },
    ];

    const summary = calculateCashFlow(transactions);

    expect(summary.netRemainingCashFlowCents).toBe(dollarsToCents(-200));
    expect(summary.isDeficit).toBe(true);
    expect(summary.deficitAmountCents).toBe(dollarsToCents(200));
    expect(summary.savingsRatePercent).toBe(0);
  });

  it('computes month-over-month trends accurately', () => {
    const prevMonth = calculateCashFlow([
      { id: 'tx-p1', userId: 'u1', categoryId: 'c1', description: 'Salary', amountCents: dollarsToCents(4000), type: 'INCOME', status: 'PAID' },
      { id: 'tx-p2', userId: 'u1', categoryId: 'c2', description: 'Bills', amountCents: dollarsToCents(2000), type: 'EXPENSE', status: 'PAID' },
    ]);

    const currMonth = calculateCashFlow([
      { id: 'tx-c1', userId: 'u1', categoryId: 'c1', description: 'Salary + Bonus', amountCents: dollarsToCents(5000), type: 'INCOME', status: 'PAID' },
      { id: 'tx-c2', userId: 'u1', categoryId: 'c2', description: 'Bills', amountCents: dollarsToCents(1800), type: 'EXPENSE', status: 'PAID' },
    ]);

    const delta = compareMonths(currMonth, prevMonth);

    // Income increased from 4000 to 5000 (+1000, +25%)
    expect(delta.incomeDeltaCents).toBe(dollarsToCents(1000));
    expect(delta.incomeGrowthPercent).toBe(25);

    // Expenses decreased from 2000 to 1800 (-200, -10%)
    expect(delta.expenseDeltaCents).toBe(dollarsToCents(-200));
    expect(delta.expenseGrowthPercent).toBe(-10);

    // Net cash flow went from 2000 to 3200 (+1200, +60%)
    expect(delta.netCashFlowDeltaCents).toBe(dollarsToCents(1200));
    expect(delta.netCashFlowGrowthPercent).toBe(60);
  });
});
