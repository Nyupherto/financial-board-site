import {
  UserProfile,
  DashboardSummary,
  CashFlowHistoryItem,
  Transaction,
  Category,
  EntryType,
  SavingsOverviewResponse,
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
  // Auth & Profiles
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

  forgotPassword: async (data: {
    email: string;
    name: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    return request<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  createCategory: (data: { name: string; type?: EntryType; color?: string }) =>
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
    type: EntryType;
    status: 'PAID' | 'PENDING';
    categoryId?: string;
    categoryName?: string;
    dueDate: string;
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
      type: EntryType;
      groupName: string;
      status?: 'PAID' | 'PENDING';
    }[];
    dueDate: string;
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
      type?: EntryType;
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

  // Savings & Individual Goals (Metas)
  getSavingsOverview: (params: {
    annualInterestRate: number;
    year: number;
    month: number;
    userId?: string;
  }) => {
    const q = new URLSearchParams({
      annualInterestRate: params.annualInterestRate.toString(),
      year: params.year.toString(),
      month: params.month.toString(),
    });
    if (params.userId && params.userId !== 'all') {
      q.append('userId', params.userId);
    }
    return request<SavingsOverviewResponse>(`/savings/overview?${q.toString()}`);
  },

  updateSavingsTarget: (data: { groupName: string; targetAmountDollars: number }) =>
    request<{ id: string; groupName: string; targetAmountDollars: number }>('/savings/target', {
      method: 'PUT',
      body: JSON.stringify(data),
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
    a.download = `financeme-transactions-${new Date().toISOString().split('T')[0]}.csv`;
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
    a.download = `financeme-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};
