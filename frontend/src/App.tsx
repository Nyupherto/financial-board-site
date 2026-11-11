import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { ExpenseDonutChart } from './components/ExpenseDonutChart';
import { CashFlowHistoryChart } from './components/CashFlowHistoryChart';
import { SmartAllocations } from './components/SmartAllocations';
import { CompoundInterestSimulator } from './components/CompoundInterestSimulator';
import { TransactionLedger } from './components/TransactionLedger';
import { CurrencySidebar } from './components/CurrencySidebar';
import { AuthScreen } from './components/AuthScreen';
import {
  UserProfile,
  DashboardSummary,
  CashFlowHistoryItem,
  Transaction,
  Category,
} from './types';
import { api, getAuthToken } from './services/api';
import { CurrencyMode, ExchangeRates, DEFAULT_RATES } from './utils/currency';

export const App: React.FC = () => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(true);

  // Currency Mode: BRL (R$), USD ($), EUR (€)
  const [currency, setCurrency] = useState<CurrencyMode>(() => {
    const saved = localStorage.getItem('fb_currency');
    if (saved === 'USD' || saved === 'EUR' || saved === 'BRL') return saved;
    return 'BRL';
  });

  // Manual Exchange Rates (Base: 1 Real = 1.00)
  const [rates, setRates] = useState<ExchangeRates>(() => {
    try {
      const saved = localStorage.getItem('fb_exchange_rates');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          usd: Number(parsed.usd) > 0 ? Number(parsed.usd) : DEFAULT_RATES.usd,
          eur: Number(parsed.eur) > 0 ? Number(parsed.eur) : DEFAULT_RATES.eur,
        };
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_RATES;
  });

  // Date state
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Family users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>('all');

  // Dashboard Data state
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [history, setHistory] = useState<CashFlowHistoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Theme Sync
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleSelectCurrency = (next: CurrencyMode) => {
    setCurrency(next);
    localStorage.setItem('fb_currency', next);
  };

  const handleChangeRates = (nextRates: ExchangeRates) => {
    setRates(nextRates);
    localStorage.setItem('fb_exchange_rates', JSON.stringify(nextRates));
  };

  // Check initial authentication
  useEffect(() => {
    async function checkAuth() {
      const token = getAuthToken();
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const user = await api.getCurrentUser();
        setCurrentUser(user);
        const userList = await api.getUsers();
        setUsers(userList);
      } catch {
        api.logout();
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // Fetch Dashboard Data
  const fetchData = async () => {
    if (!currentUser) return;
    try {
      const [sumData, histData, txData, catData, userList] = await Promise.all([
        api.getSummary(year, month, activeUserId),
        api.getHistory(activeUserId, year, month),
        api.getTransactions(year, month, activeUserId),
        api.getCategories(),
        api.getUsers(),
      ]);

      setSummary(sumData);
      setHistory(histData);
      setTransactions(txData);
      setCategories(catData);
      setUsers(userList);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, year, month, activeUserId]);

  const handleSelectUser = (newUserId: string) => {
    setActiveUserId(newUserId);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setSummary(null);
    setTransactions([]);
  };

  const handleAuthSuccess = async (user: UserProfile) => {
    setCurrentUser(user);
    const userList = await api.getUsers();
    setUsers(userList);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-emerald-400 font-semibold text-sm">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          Conectando ao banco de dados...
        </div>
      </div>
    );
  }

  // Require login / registration
  if (!currentUser) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors`}>
      {/* Top Navigation Bar (Currency toggle removed from top as requested) */}
      <Header
        users={users}
        activeUserId={activeUserId}
        onSelectUser={handleSelectUser}
        year={year}
        month={month}
        onSelectMonth={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        currency={currency}
        onExportCsv={api.exportCsv}
        onExportJson={api.exportJson}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content + Right Currency Panel */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left/Center Main Dashboard Area (9 cols) */}
          <div className="xl:col-span-9 space-y-6">
            {/* Real-Time Balance Cards */}
            {summary && (
              <SummaryCards
                summary={summary.summary}
                mom={summary.monthOverMonth}
                currency={currency}
                rates={rates}
              />
            )}

            {/* Accounts Ledger & Smart Group Manager */}
            <TransactionLedger
              transactions={transactions}
              categories={categories}
              users={users}
              onRefresh={fetchData}
              year={year}
              month={month}
              currency={currency}
              rates={rates}
            />

            {/* Visual Charts: Donut Breakdown + 12-Month History */}
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5">
                  <ExpenseDonutChart
                    categories={summary.categoryBreakdown}
                    totalExpenses={summary.summary.totalExpensesDollars}
                    currency={currency}
                    rates={rates}
                  />
                </div>
                <div className="lg:col-span-7">
                  <CashFlowHistoryChart
                    data={history}
                    currency={currency}
                    rates={rates}
                  />
                </div>
              </div>
            )}

            {/* Smart Allocation Buckets */}
            {summary && (
              <SmartAllocations
                allocations={summary.allocations}
                netCashFlow={summary.summary.netRemainingCashFlowDollars}
                currency={currency}
                rates={rates}
              />
            )}

            {/* Dedicated Savings & Offline Compound Interest Engine */}
            <CompoundInterestSimulator
              currency={currency}
              rates={rates}
            />
          </div>

          {/* Right Area: Currency Switcher (BRL / USD / EUR) & Manual Exchange Rate Converter (3 cols) */}
          <aside className="xl:col-span-3 xl:sticky xl:top-20">
            <CurrencySidebar
              currency={currency}
              onSelectCurrency={handleSelectCurrency}
              rates={rates}
              onChangeRates={handleChangeRates}
            />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-12 py-6 px-4 text-center text-xs text-slate-500">
        <p>Family Financial Management System • Zero-Float Integer Cents SQLite • 100% Offline Financial Math</p>
      </footer>
    </div>
  );
};

export default App;
