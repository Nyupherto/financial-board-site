import React from 'react';
import {
  Users,
  ShieldCheck,
  User,
  Download,
  Calendar,
  Sun,
  Moon,
  Database,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { UserProfile } from '../types';
import { CurrencyMode, getCurrencySymbol } from '../utils/currency';

interface HeaderProps {
  users: UserProfile[];
  activeUserId: string;
  onSelectUser: (userId: string) => void;
  year: number;
  month: number;
  onSelectMonth: (year: number, month: number) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currency: CurrencyMode;
  onExportCsv: () => void;
  onExportJson: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  users,
  activeUserId,
  onSelectUser,
  year,
  month,
  onSelectMonth,
  isDark,
  onToggleTheme,
  currency,
  onExportCsv,
  onExportJson,
  currentUser,
  onLogout,
}) => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const symbol = getCurrencySymbol(currency);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & System */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-black text-lg">
              {symbol}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-lg tracking-tight">FamilyFinance</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SQLite Ativo
                </span>
              </div>
              <p className="text-xs text-slate-400">Banco de Dados em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Month/Year Selector */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <select
            value={`${year}-${month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              onSelectMonth(y, m);
            }}
            className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none cursor-pointer"
          >
            {[-2, -1, 0, 1, 2].map((offset) => {
              const d = new Date(year, month - 1 + offset, 1);
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              return (
                <option key={`${y}-${m}`} value={`${y}-${m}`} className="bg-slate-900 text-slate-200">
                  {monthNames[m - 1]} {y} {offset === 0 ? '(Atual)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Right Actions: Profile Switcher, Export, Theme, Logout */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Multi-User Profile Dropdown */}
          <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5">
            <Users className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={activeUserId}
              onChange={(e) => onSelectUser(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-6"
            >
              <option value="all" className="bg-slate-900 text-emerald-400">
                👨‍👩‍👧‍👦 Visão da Família (Todos)
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                  {u.role === 'ADMIN' ? '👑' : '👤'} {u.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
          </div>

          {/* Current Active Badge */}
          {currentUser && (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: currentUser.avatarColor }}
              />
              <span className="text-slate-300 font-medium">{currentUser.name}</span>
              {currentUser.role === 'ADMIN' ? (
                <span className="flex items-center text-[10px] text-amber-400 font-bold ml-1">
                  <ShieldCheck className="w-3 h-3 mr-0.5" /> Admin
                </span>
              ) : (
                <span className="flex items-center text-[10px] text-blue-400 font-medium ml-1">
                  <User className="w-3 h-3 mr-0.5" /> Membro
                </span>
              )}
            </div>
          )}

          {/* Export CSV & JSON */}
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Exportar transações em CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={onExportJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Backup completo em JSON"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Backup</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="hidden md:flex p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Alternar Tema"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors cursor-pointer"
            title="Sair da Conta"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
};
