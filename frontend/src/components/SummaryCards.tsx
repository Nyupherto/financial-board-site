import React from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  PiggyBank,
  AlertTriangle,
} from 'lucide-react';
import { DashboardSummary } from '../types';
import { CurrencyMode, ExchangeRates, formatMoney } from '../utils/currency';

interface SummaryCardsProps {
  summary: DashboardSummary['summary'];
  mom: DashboardSummary['monthOverMonth'];
  currency: CurrencyMode;
  rates: ExchangeRates;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, mom, currency, rates }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Income */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Renda Total</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-100">
          {formatMoney(summary.totalIncomeDollars, currency, 2, rates)}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          {mom.incomeGrowthPercent >= 0 ? (
            <span className="text-emerald-400 font-semibold flex items-center">
              +{mom.incomeGrowthPercent}% MoM
            </span>
          ) : (
            <span className="text-rose-400 font-semibold flex items-center">
              {mom.incomeGrowthPercent}% MoM
            </span>
          )}
          <span className="text-slate-500">vs mês anterior</span>
        </div>
      </div>

      {/* 2. Total Paid Expenses */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contas Pagas</span>
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-slate-100">
          {formatMoney(summary.totalPaidDollars, currency, 2, rates)}
        </div>
        <div className="mt-2.5 text-xs text-slate-400 flex items-center justify-between">
          <span>{summary.paidLiabilitiesCount} contas quitadas</span>
          <span className="text-slate-500 font-mono">
            {summary.totalIncomeDollars > 0
              ? `${((summary.totalPaidDollars / summary.totalIncomeDollars) * 100).toFixed(0)}% da renda`
              : ''}
          </span>
        </div>
      </div>

      {/* 3. Total Pending Liabilities */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contas Pendentes</span>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold tracking-tight text-amber-400">
          {formatMoney(summary.totalPendingDollars, currency, 2, rates)}
        </div>
        <div className="mt-2.5 text-xs text-slate-400 flex items-center justify-between">
          <span>{summary.pendingLiabilitiesCount} aguardando pagamento</span>
          {summary.pendingLiabilitiesCount > 0 && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              Pendente
            </span>
          )}
        </div>
      </div>

      {/* 4. Net Remaining Cash Flow */}
      <div className={`border rounded-2xl p-5 shadow-sm transition-all ${
        summary.isDeficit
          ? 'bg-rose-950/20 border-rose-800/60'
          : 'bg-emerald-950/20 border-emerald-800/60'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Fluxo de Caixa Líquido (Sobra)
          </span>
          <div className={`p-2 rounded-xl ${
            summary.isDeficit ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {summary.isDeficit ? <AlertTriangle className="w-4 h-4" /> : <PiggyBank className="w-4 h-4" />}
          </div>
        </div>
        <div className={`text-2xl font-extrabold tracking-tight ${
          summary.isDeficit ? 'text-rose-400' : 'text-emerald-400'
        }`}>
          {formatMoney(summary.netRemainingCashFlowDollars, currency, 2, rates)}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Taxa Poupança: <strong className="text-slate-200">{summary.savingsRatePercent}%</strong>
          </span>
          <span className="text-slate-400">
            Disponível: <strong className="text-cyan-300">{formatMoney(summary.netLiquidCashOnHandDollars, currency, 2, rates)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
