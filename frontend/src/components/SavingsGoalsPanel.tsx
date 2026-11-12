import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Target,
  TrendingUp,
  Clock,
  Sparkles,
  CheckCircle2,
  Edit3,
  Check,
  Plus,
  Percent,
} from 'lucide-react';
import { SavingsOverviewResponse } from '../types';
import { api } from '../services/api';
import {
  CurrencyMode,
  ExchangeRates,
  formatMoney,
  convertFromBrl,
  convertToBrl,
  getCurrencySymbol,
} from '../utils/currency';
import { parseFlexibleNumber } from '../utils/smartParser';

interface SavingsGoalsPanelProps {
  savingsOverview: SavingsOverviewResponse | null;
  currency: CurrencyMode;
  rates: ExchangeRates;
  annualInterestRate: number;
  onChangeInterestRate: (rate: number) => void;
  onRefresh: () => void;
}

function formatMonthsDuration(months: number | null): string {
  if (months === null) return 'Defina aportes e meta';
  if (months === 0) return 'Meta atingida!';
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
  if (remMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'} (${months}m)`;
  return `${years}a e ${remMonths}m (${months} meses)`;
}

export const SavingsGoalsPanel: React.FC<SavingsGoalsPanelProps> = ({
  savingsOverview,
  currency,
  rates,
  annualInterestRate,
  onChangeInterestRate,
  onRefresh,
}) => {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState<string>('');
  const [newGoalName, setNewGoalName] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');
  const [isCreatingGoal, setIsCreatingGoal] = useState<boolean>(false);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);

  const symbol = getCurrencySymbol(currency);

  const handleSaveTarget = async (groupName: string) => {
    const parsedInDisplayCurrency = parseFlexibleNumber(targetInput);
    if (!Number.isFinite(parsedInDisplayCurrency) || parsedInDisplayCurrency < 0) {
      setEditingGroup(null);
      return;
    }

    try {
      setSavingTarget(true);
      const targetBrl = convertToBrl(parsedInDisplayCurrency, currency, rates);
      await api.updateSavingsTarget({
        groupName,
        targetAmountDollars: targetBrl,
      });
      setEditingGroup(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to update goal target:', err);
    } finally {
      setSavingTarget(false);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;
    try {
      setSavingTarget(true);
      const parsedTarget = parseFlexibleNumber(newGoalTarget);
      const targetBrl = parsedTarget > 0 ? convertToBrl(parsedTarget, currency, rates) : 0;

      await api.createCategory({
        name: newGoalName.trim(),
        type: 'SAVINGS',
      });

      if (targetBrl > 0) {
        await api.updateSavingsTarget({
          groupName: newGoalName.trim(),
          targetAmountDollars: targetBrl,
        });
      }

      setNewGoalName('');
      setNewGoalTarget('');
      setIsCreatingGoal(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to create savings goal:', err);
    } finally {
      setSavingTarget(false);
    }
  };

  if (!savingsOverview) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Top Header + Internal Interest Rate Inline Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-400">
            <Target className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Metas Individuais (Savings) & Projeção com Juros Compostos
            </h2>
            <p className="text-xs text-slate-400">
              Calcula o fluxo investido nos últimos meses, a média mensal de entrada e o tempo exato para bater cada meta com juros
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Inline Interest Rate Box */}
          <div className="flex items-center gap-2 bg-slate-950 border border-violet-500/30 rounded-xl px-3 py-1.5">
            <Percent className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-slate-300 font-medium">Juros Interno:</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={annualInterestRate}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChangeInterestRate(Number.isFinite(val) && val >= 0 ? Math.min(100, val) : 0);
              }}
              className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right font-mono font-bold text-violet-300 text-xs focus:outline-none focus:border-violet-500"
            />
            <span className="text-xs font-mono text-violet-400 font-bold">% a.a.</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingGoal(!isCreatingGoal)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Meta (Savings)
          </button>
        </div>
      </div>

      {/* Optional Quick New Goal Form */}
      {isCreatingGoal && (
        <form
          onSubmit={handleCreateGoal}
          className="p-4 rounded-2xl bg-slate-950/90 border border-violet-500/30 flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="w-full sm:flex-1">
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Nome do Grupo de Meta (Savings)
            </label>
            <input
              type="text"
              placeholder="Ex: Reserva de Emergência, Comprar Carro, Viagem..."
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="w-full sm:w-56">
            <label className="block text-[11px] font-semibold text-violet-300 mb-1">
              Valor da Meta Individual ({symbol}) — aceita k/kk
            </label>
            <input
              type="text"
              placeholder="Ex: 50k ou 10000"
              value={newGoalTarget}
              onChange={(e) => setNewGoalTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsCreatingGoal(false)}
              className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingTarget}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer"
            >
              Criar Meta
            </button>
          </div>
        </form>
      )}

      {/* Top Overview Row: Overall Savings Metrics + Recent Months Inflow Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Summary Metrics for Savings */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Total Acumulado em Savings
            </span>
            <div className="text-xl font-black text-violet-400 mt-1 font-mono">
              {formatMoney(savingsOverview.totalInvestedDollars, currency, 2, rates)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Soma dos lançamentos alocados em grupos de Meta
            </p>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Média de Entrada Mensal
            </span>
            <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
              {formatMoney(savingsOverview.averageMonthlyContributionDollars, currency, 2, rates)}
              <span className="text-xs font-normal text-slate-400">/mês</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Baseada em {savingsOverview.activeMonthsCount || 1}{' '}
              {savingsOverview.activeMonthsCount === 1 ? 'mês ativo' : 'meses com aportes'}
            </p>
          </div>
        </div>

        {/* Last 6 Months Savings Flow Chart */}
        <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" /> Fluxo de Entrada em Savings (Últimos 6 Meses)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Aportes reais registrados no banco
            </span>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsOverview.monthlyFlow} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => {
                    const conv = convertFromBrl(v, currency, rates);
                    return Math.abs(conv) >= 1000
                      ? `${symbol}${(conv / 1000).toFixed(0)}k`
                      : `${symbol}${Math.round(conv)}`;
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs shadow-xl">
                          <p className="font-bold text-slate-200">{d.label}</p>
                          <p className="text-violet-400 font-mono font-bold">
                            Investido: {formatMoney(d.amountDollars, currency, 2, rates)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amountDollars" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Individual Savings Goal Cards */}
      <div className="space-y-4">
        {savingsOverview.goals.map((goal) => {
          const isEditing = editingGroup === goal.groupName;
          const displayedTarget = convertFromBrl(goal.targetAmountDollars, currency, rates);

          return (
            <div
              key={goal.groupName}
              className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4 hover:border-violet-500/30 transition-all"
            >
              {/* Goal Header & Target Editor */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-100">{goal.groupName}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        {goal.txCount} {goal.txCount === 1 ? 'lançamento' : 'lançamentos'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Média de entrada:{' '}
                      <strong className="text-emerald-400 font-mono">
                        {formatMoney(goal.averageMonthlyContributionDollars, currency, 2, rates)}/mês
                      </strong>{' '}
                      • Juros composto aplicado:{' '}
                      <strong className="text-violet-300 font-mono">
                        {annualInterestRate.toFixed(1)}% a.a. ({goal.effectiveMonthlyRatePercent}% a.m.)
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Meta Individual Value & Edit Button */}
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-400 font-semibold">Meta Individual:</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex: 50k"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTarget(goal.groupName);
                          if (e.key === 'Escape') setEditingGroup(null);
                        }}
                        autoFocus
                        className="w-28 bg-slate-950 border border-violet-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-100 text-right focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTarget(goal.groupName)}
                        disabled={savingTarget}
                        className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer"
                        title="Salvar Meta"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGroup(goal.groupName);
                        setTargetInput(displayedTarget > 0 ? displayedTarget.toFixed(2) : '');
                      }}
                      className="flex items-center gap-1.5 font-mono font-bold text-sm text-violet-300 hover:text-violet-200 cursor-pointer"
                      title="Clique para definir ou alterar o valor da Meta (aceita k / kk)"
                    >
                      <span>
                        {goal.targetAmountDollars > 0
                          ? formatMoney(goal.targetAmountDollars, currency, 2, rates)
                          : 'Definir Valor da Meta'}
                      </span>
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {goal.targetAmountDollars > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">
                      Progresso atual:{' '}
                      <strong className="text-slate-100 font-mono">
                        {formatMoney(goal.totalInvestedDollars, currency, 2, rates)}
                      </strong>{' '}
                      de{' '}
                      <strong className="text-slate-300 font-mono">
                        {formatMoney(goal.targetAmountDollars, currency, 2, rates)}
                      </strong>
                    </span>
                    <span className="font-mono font-bold text-violet-400">{goal.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, goal.progressPercent)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Metrics + Compound Growth Curve */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-1">
                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Card 1: Tempo Estimado com Juros */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-violet-400">
                      <Clock className="w-3.5 h-3.5" /> Tempo p/ Bater a Meta
                    </div>
                    <div className="text-sm font-black text-slate-100 mt-1.5 font-mono">
                      {goal.isReached ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Meta Batida!
                        </span>
                      ) : (
                        formatMonthsDuration(goal.monthsToGoalWithInterest)
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {goal.monthsToGoalWithoutInterest !== null && !goal.isReached
                        ? `Sem juros: ${formatMonthsDuration(goal.monthsToGoalWithoutInterest)}`
                        : 'Seguindo a média mensal'}
                    </div>
                  </div>

                  {/* Card 2: Ganho em Juros Compostos */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5" /> Juros Acumulados
                    </div>
                    <div className="text-sm font-black text-emerald-400 mt-1.5 font-mono">
                      +{formatMoney(goal.projectedTotalInterestDollars, currency, 2, rates)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {goal.interestSavedMonths > 0
                        ? `Antecipa a meta em ${goal.interestSavedMonths} ${goal.interestSavedMonths === 1 ? 'mês' : 'meses'}`
                        : `Rendimento a ${annualInterestRate.toFixed(1)}% a.a.`}
                    </div>
                  </div>

                  {/* Card 3: Saldo Final Projetado */}
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan-400">
                      <TrendingUp className="w-3.5 h-3.5" /> Evolução Projetada
                    </div>
                    <div className="text-sm font-black text-cyan-300 mt-1.5 font-mono">
                      {formatMoney(goal.projectedFinalBalanceDollars, currency, 2, rates)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Do bolso: {formatMoney(goal.projectedTotalPrincipalDollars, currency, 0, rates)}
                    </div>
                  </div>
                </div>

                {/* Mini Evolution Curve Chart */}
                <div className="lg:col-span-6 h-36 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5">
                  {goal.schedule.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 px-4">
                      Adicione um lançamento em <strong>"{goal.groupName}"</strong> e defina o valor da Meta para visualizar a curva de evolução com juros compostos.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={goal.schedule} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${goal.groupName}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="month"
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          tickFormatter={(m) => `${m}m`}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={10}
                          tickLine={false}
                          tickFormatter={(v) => {
                            const conv = convertFromBrl(v, currency, rates);
                            return Math.abs(conv) >= 1000
                              ? `${symbol}${(conv / 1000).toFixed(0)}k`
                              : `${symbol}${Math.round(conv)}`;
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs shadow-xl space-y-0.5">
                                  <p className="font-bold text-slate-200">Mês {d.month}</p>
                                  <p className="text-violet-300 font-mono font-bold">
                                    Total c/ Juros: {formatMoney(d.endingBalanceDollars, currency, 2, rates)}
                                  </p>
                                  <p className="text-cyan-300 font-mono">
                                    Aportado: {formatMoney(d.cumulativePrincipalDollars, currency, 2, rates)}
                                  </p>
                                  <p className="text-emerald-400 font-mono">
                                    Juros: +{formatMoney(d.cumulativeInterestDollars, currency, 2, rates)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativePrincipalDollars"
                          stroke="#38bdf8"
                          fillOpacity={0}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                        />
                        <Area
                          type="monotone"
                          dataKey="endingBalanceDollars"
                          stroke="#8b5cf6"
                          fill={`url(#grad-${goal.groupName})`}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
