export type EntryType = 'INCOME' | 'EXPENSE' | 'SAVINGS';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export interface Category {
  id: string;
  name: string;
  type: EntryType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  monthlyRecordId?: string;
  userId: string;
  categoryId: string;
  description: string;
  amountCents: number;
  amountDollars: number;
  type: EntryType;
  status: 'PAID' | 'PENDING';
  dueDate: string;
  paidAt?: string | null;
  isShared: boolean;
  notes?: string | null;
  category: Category;
  user: {
    id: string;
    name: string;
    avatarColor: string;
  };
}

export interface CategoryBreakdown {
  name: string;
  amountDollars: number;
  amountCents: number;
  color: string;
  count: number;
  percentageOfExpenses: number;
  percentageOfIncome: number;
}

export interface BucketAllocation {
  bucketId: string;
  bucketName: string;
  allocatedAmountDollars: number;
  percentageOfNetCashFlow: number;
}

export interface DashboardSummary {
  period: { year: number; month: number };
  isFamilyView: boolean;
  summary: {
    totalIncomeDollars: number;
    totalExpensesDollars: number;
    totalPaidDollars: number;
    totalPendingDollars: number;
    totalSavingsDollars?: number;
    netRemainingCashFlowDollars: number;
    netLiquidCashOnHandDollars: number;
    savingsRatePercent: number;
    expenseToIncomeRatioPercent: number;
    pendingLiabilitiesCount: number;
    paidLiabilitiesCount: number;
    savingsTransactionsCount?: number;
    isDeficit: boolean;
    deficitAmountDollars: number;
  };
  allocations: BucketAllocation[];
  categoryBreakdown: CategoryBreakdown[];
  monthOverMonth: {
    incomeGrowthPercent: number;
    expenseGrowthPercent: number;
    netCashFlowGrowthPercent: number;
  };
}

export interface CashFlowHistoryItem {
  year: number;
  month: number;
  periodLabel: string;
  income: number;
  expenses: number;
  savings?: number;
  paid: number;
  pending: number;
  netCashFlow: number;
}

export interface SavingsGoalProjectionItem {
  groupName: string;
  color: string;
  txCount: number;
  activeMonthsCount: number;
  totalInvestedDollars: number;
  averageMonthlyContributionDollars: number;
  targetAmountDollars: number;
  progressPercent: number;
  isReached: boolean;
  monthsToGoalWithInterest: number | null;
  monthsToGoalWithoutInterest: number | null;
  interestSavedMonths: number;
  projectedFinalBalanceDollars: number;
  projectedTotalPrincipalDollars: number;
  projectedTotalInterestDollars: number;
  effectiveMonthlyRatePercent: number;
  effectiveAnnualRatePercent: number;
  schedule: {
    month: number;
    year: number;
    endingBalanceDollars: number;
    cumulativePrincipalDollars: number;
    cumulativeInterestDollars: number;
  }[];
}

export interface SavingsOverviewResponse {
  annualInterestRatePercent: number;
  totalInvestedDollars: number;
  averageMonthlyContributionDollars: number;
  activeMonthsCount: number;
  monthlyFlow: {
    year: number;
    month: number;
    label: string;
    amountCents: number;
    amountDollars: number;
  }[];
  goals: SavingsGoalProjectionItem[];
}
