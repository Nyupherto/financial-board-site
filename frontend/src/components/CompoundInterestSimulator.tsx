import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Sliders,
  Award,
  ChevronDown,
  ChevronUp,
  Calculator,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { SimulationResult } from '../types';
import { CurrencyMode, ExchangeRates, convertFromBrl, formatMoney, getCurrencySymbol } from '../utils/currency';

interface CompoundInterestSimulatorProps {
  currency: CurrencyMode;
  rates: ExchangeRates;
}

export const CompoundInterestSimulator: React.FC<CompoundInterestSimulatorProps> = ({ currency, rates }) => {
  // Input parameters (Starts at 0 - no fake pre-filled numbers)
  const [initialPrincipal, setInitialPrincipal] = useState<number>(0);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(0);
  const [annualRate, setAnnualRate] = useState<number>(10);
  const [horizonYears, setHorizonYears] = useState<number>(5);
  const [contributionTiming, setContributionTiming] = useState<'END_OF_PERIOD' | 'BEGINNING_OF_PERIOD'>('END_OF_PERIOD');

  // Simulation result state
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);

  const runSimulation = async () => {
    try {
      const data = await api.simulateSavings({
        initialPrincipalDollars: initialPrincipal,
        monthlyContributionDollars: monthlyContribution,
        annualInterestRatePercent: annualRate,
        horizonMonths: horizonYears * 12,
        contributionTiming,
      });
      setResult(data);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [initialPrincipal, monthlyContribution, annualRate, horizonYears, contributionTiming]);

  const symbol = getCurrencySymbol(currency);
  const chartData = result?.schedule.filter((_, idx) => (idx + 1) % 6 === 0 || idx === (result?.schedule.length || 0) - 1) || [];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Calculator className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                Simulador de Juros Compostos & Acumulação de Patrimônio
              </h2>
              <p className="text-xs text-slate-400">
                Motor 100% offline de matemática financeira determinística
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-semibold self-start md:self-auto">
          <Sparkles className="w-3.5 h-3.5" /> Matemática Offline Local
        </div>
      </div>

      {/* Main Grid: Controls + Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Parametric Controls */}
        <div className="lg:col-span-5 space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            <Sliders className="w-4 h-4 text-cyan-400" /> Parâmetros de Investimento (Base R$)
          </div>

          {/* Initial Principal */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Investimento Inicial (P)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={initialPrincipal}
                  onChange={(e) => setInitialPrincipal(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right font-mono font-bold text-cyan-300 text-xs focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  ({formatMoney(initialPrincipal, currency, 0, rates)})
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100000"
              step="500"
              value={initialPrincipal}
              onChange={(e) => setInitialPrincipal(Number(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Monthly Contribution */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Aporte Mensal (PMT)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value)))}
                  className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right font-mono font-bold text-emerald-300 text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  ({formatMoney(monthlyContribution, currency, 0, rates)})
                </span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="10000"
              step="50"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Annual Interest Rate */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Taxa de Juros Anual (i)</span>
              <span className="font-mono font-bold text-amber-300">{annualRate.toFixed(1)}% a.a.</span>
            </div>
            <input
              type="range"
              min="1"
              max="25"
              step="0.25"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Time Horizon */}
          <div>
            <div className="flex justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span>Horizonte de Tempo (n)</span>
              <span className="font-mono font-bold text-indigo-300">{horizonYears} Anos ({horizonYears * 12} meses)</span>
            </div>
            <input
              type="range"
              min="1"
              max="35"
              step="1"
              value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              className="w-full accent-indigo-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Timing Toggle */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Momento do Depósito Mensal</span>
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setContributionTiming('END_OF_PERIOD')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  contributionTiming === 'END_OF_PERIOD' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                Fim do Mês
              </button>
              <button
                type="button"
                onClick={() => setContributionTiming('BEGINNING_OF_PERIOD')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  contributionTiming === 'BEGINNING_OF_PERIOD' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                }`}
              >
                Início do Mês
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Key Outputs & Growth Curve Chart */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {result && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valor Futuro (FV)</span>
                <div className="text-xl sm:text-2xl font-black text-cyan-400 mt-1 font-mono">
                  {formatMoney(result.summary.futureValueDollars, currency, 2, rates)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Taxa Efetiva: <strong>{result.summary.effectiveAnnualRatePercent}% a.a.</strong>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Investido</span>
                <div className="text-xl sm:text-2xl font-bold text-slate-200 mt-1 font-mono">
                  {formatMoney(result.summary.totalPrincipalInvestedDollars, currency, 2, rates)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {result.summary.futureValueDollars > 0
                    ? `${((result.summary.totalPrincipalInvestedDollars / result.summary.futureValueDollars) * 100).toFixed(0)}% do patrimônio final`
                    : '0% do patrimônio'}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-emerald-900/40 p-4 rounded-xl bg-emerald-950/10">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Juros Acumulados</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
                  {formatMoney(result.summary.totalInterestEarnedDollars, currency, 2, rates)}
                </div>
                <div className="text-[11px] text-emerald-500/80 mt-1 font-semibold">
                  Rendimento composto
                </div>
              </div>
            </div>
          )}

          {/* Growth Curve Chart */}
          <div className="h-56 sm:h-64 w-full bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorEnding" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(y) => `Ano ${y}`}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(v) => {
                    const conv = convertFromBrl(v, currency, rates);
                    return Math.abs(conv) >= 1000
                      ? `${symbol}${(conv / 1000).toFixed(0)}k`
                      : `${symbol}${Math.round(conv)}`;
                  }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-slate-200">Ano {d.year} (Mês {d.month})</p>
                          <p className="text-emerald-400 font-mono font-bold">Patrimônio: {formatMoney(d.endingBalanceDollars, currency, 2, rates)}</p>
                          <p className="text-cyan-300 font-mono">Investido: {formatMoney(d.cumulativePrincipalDollars, currency, 2, rates)}</p>
                          <p className="text-amber-300 font-mono">Juros: {formatMoney(d.cumulativeInterestDollars, currency, 2, rates)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="cumulativePrincipalDollars"
                  name="Principal Investido"
                  stroke="#38bdf8"
                  fillOpacity={1}
                  fill="url(#colorPrincipal)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="endingBalanceDollars"
                  name="Patrimônio Total (FV)"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorEnding)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Financial Milestone Cards */}
      {result && (
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Metas de Patrimônio da Família
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {result.milestones.map((m) => (
              <div
                key={m.targetDollars}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  m.reachedAtMonth !== null
                    ? 'bg-slate-950/80 border-emerald-500/40 text-slate-200 shadow-sm shadow-emerald-500/5'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-xs font-bold font-mono">{formatMoney(m.targetDollars, currency, 0, rates)}</div>
                <div className="text-[10px] mt-1">
                  {m.reachedAtMonth !== null ? (
                    <span className="text-emerald-400 font-semibold">
                      Ano {m.reachedAtYear} ({m.reachedAtMonth}º mês)
                    </span>
                  ) : (
                    <span className="text-slate-600">Além de {horizonYears}a</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable Amortization Schedule */}
      <div className="mt-5">
        <button
          onClick={() => setShowSchedule(!showSchedule)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showSchedule ? 'Ocultar' : 'Inspecionar'} Tabela Mês a Mês do Rendimento
        </button>

        {showSchedule && result && (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900 sticky top-0 text-[10px] text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Mês</th>
                  <th className="py-2 px-3">Ano</th>
                  <th className="py-2 px-3">Saldo Inicial</th>
                  <th className="py-2 px-3">Depósito</th>
                  <th className="py-2 px-3">Juros Mês</th>
                  <th className="py-2 px-3">Saldo Final</th>
                  <th className="py-2 px-3">Total Juros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {result.schedule.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-900/50">
                    <td className="py-2 px-3 text-slate-400 font-sans">{row.month}</td>
                    <td className="py-2 px-3 text-slate-400 font-sans">{row.year}</td>
                    <td className="py-2 px-3">{formatMoney(row.startingBalanceDollars, currency, 2, rates)}</td>
                    <td className="py-2 px-3 text-cyan-300">+{formatMoney(row.contributionDollars, currency, 2, rates)}</td>
                    <td className="py-2 px-3 text-emerald-400">+{formatMoney(row.interestEarnedDollars, currency, 2, rates)}</td>
                    <td className="py-2 px-3 font-bold text-slate-100">{formatMoney(row.endingBalanceDollars, currency, 2, rates)}</td>
                    <td className="py-2 px-3 text-amber-300">{formatMoney(row.cumulativeInterestDollars, currency, 2, rates)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
