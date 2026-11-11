export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  avatarColor: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
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
  type: 'INCOME' | 'EXPENSE';
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
    netRemainingCashFlowDollars: number;
    netLiquidCashOnHandDollars: number;
    savingsRatePercent: number;
    expenseToIncomeRatioPercent: number;
    pendingLiabilitiesCount: number;
    paidLiabilitiesCount: number;
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
  paid: number;
  pending: number;
  netCashFlow: number;
}

export interface SimulationResult {
  summary: {
    futureValueDollars: number;
    totalPrincipalInvestedDollars: number;
    totalInterestEarnedDollars: number;
    nominalAnnualRatePercent: number;
    effectiveAnnualRatePercent: number;
    horizonMonths: number;
    horizonYears: number;
  };
  milestones: {
    targetDollars: number;
    reachedAtMonth: number | null;
    reachedAtYear: number | null;
  }[];
  schedule: {
    month: number;
    year: number;
    startingBalanceDollars: number;
    contributionDollars: number;
    interestEarnedDollars: number;
    endingBalanceDollars: number;
    cumulativePrincipalDollars: number;
    cumulativeInterestDollars: number;
  }[];
}
