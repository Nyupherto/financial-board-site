import {
  UserProfile,
  DashboardSummary,
  CashFlowHistoryItem,
  Transaction,
  Category,
  SimulationResult,
} from '../types';

const API_BASE = '/api';

let token = localStorage.getItem('fb_auth_token') || '';

export const setAuthToken = (newToken: string) => {
  token = newToken;
  localStorage.setItem('fb_auth_token', newToken);
};

export const clearAuthToken = () => {
  token = '';
  localStorage.removeItem('fb_auth_token');
};

export const getAuthToken = () => token;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth & Family Profiles
  getUsers: () => request<UserProfile[]>('/auth/users'),

  login: async (email: string, password: string) => {
    const res = await request<{ token: string; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  register: async (data: {
    name: string;
    email: string;
    confirmEmail: string;
    password: string;
    confirmPassword: string;
  }) => {
    const res = await request<{ token: string; user: UserProfile }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAuthToken(res.token);
    return res;
  },

  switchProfile: async (userId: string) => {
    const res = await request<{ token: string; user: UserProfile }>('/auth/switch-profile', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setAuthToken(res.token);
    return res;
  },

  getCurrentUser: () => request<UserProfile>('/auth/me'),

  logout: () => {
    clearAuthToken();
  },

  // Dashboard & Metrics
  getSummary: (year: number, month: number, userId?: string) => {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });
    if (userId && userId !== 'all') {
      params.append('userId', userId);
    }
    return request<DashboardSummary>(`/dashboard/summary?${params.toString()}`);
  },

  getHistory: (userId?: string, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (userId && userId !== 'all') {
      params.append('userId', userId);
    }
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    return request<CashFlowHistoryItem[]>(`/dashboard/history?${params.toString()}`);
  },

  // Categories / Groups
  getCategories: () => request<Category[]>('/categories'),

  createCategory: (data: { name: string; type?: 'INCOME' | 'EXPENSE'; color?: string }) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Transactions
  getTransactions: (year: number, month: number, userId?: string, status = 'ALL', type = 'ALL') => {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      status,
      type,
    });
    if (userId && userId !== 'all') {
      params.append('userId', userId);
    }
    return request<Transaction[]>(`/transactions?${params.toString()}`);
  },

  createTransaction: (data: {
    description: string;
    amountDollars: number;
    type: 'INCOME' | 'EXPENSE';
    status: 'PAID' | 'PENDING';
    categoryId?: string;
    categoryName?: string;
    dueDate: string;
    userId?: string;
    isShared?: boolean;
    notes?: string;
  }) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createTransactionsBatch: (data: {
    items: {
      description: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
      groupName: string;
      status?: 'PAID' | 'PENDING';
    }[];
    dueDate: string;
    userId?: string;
  }) =>
    request<Transaction[]>('/transactions/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTransaction: (
    id: string,
    data: {
      description?: string;
      amountDollars?: number;
      categoryId?: string;
      categoryName?: string;
      type?: 'INCOME' | 'EXPENSE';
      status?: 'PAID' | 'PENDING';
    }
  ) =>
    request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleTransactionStatus: (id: string) =>
    request<Transaction>(`/transactions/${id}/status`, {
      method: 'PATCH',
    }),

  deleteTransaction: (id: string) =>
    request<{ success: boolean }>(`/transactions/${id}`, {
      method: 'DELETE',
    }),

  // Offline Compound Interest Simulation
  simulateSavings: (params: {
    initialPrincipalDollars: number;
    monthlyContributionDollars: number;
    annualInterestRatePercent: number;
    horizonMonths: number;
    contributionTiming?: 'END_OF_PERIOD' | 'BEGINNING_OF_PERIOD';
  }) =>
    request<SimulationResult>('/savings/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // Data Export URL triggers
  exportCsv: async () => {
    const res = await fetch(`${API_BASE}/export/csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-financial-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  exportJson: async () => {
    const res = await fetch(`${API_BASE}/export/json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family-financial-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
