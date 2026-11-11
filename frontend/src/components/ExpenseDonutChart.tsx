import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { CategoryBreakdown } from '../types';
import { CurrencyMode, ExchangeRates, formatMoney } from '../utils/currency';

interface ExpenseDonutChartProps {
  categories: CategoryBreakdown[];
  totalExpenses: number;
  currency: CurrencyMode;
  rates: ExchangeRates;
}

export const ExpenseDonutChart: React.FC<ExpenseDonutChartProps> = ({
  categories,
  totalExpenses,
  currency,
  rates,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (categories.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center h-80 text-center">
        <PieIcon className="w-10 h-10 text-slate-600 mb-2" />
        <p className="text-sm font-medium text-slate-400">Nenhuma despesa registrada neste período</p>
        <p className="text-xs text-slate-500 mt-1">Adicione lançamentos na caixa de texto abaixo para ver os grupos.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-400" /> Distribuição de Gastos por Grupo
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Visão percentual do custo por categoria</p>
        </div>
        <span className="text-xs font-mono font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
          Total: {formatMoney(totalExpenses, currency, 2, rates)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Donut Chart */}
        <div className="md:col-span-6 h-64 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="amountDollars"
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {categories.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                    stroke="#090d16"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as CategoryBreakdown;
                    return (
                      <div className="bg-slate-950/95 border border-slate-800 p-2.5 rounded-xl shadow-xl text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: data.color }}
                          />
                          <span className="font-semibold text-slate-100">{data.name}</span>
                        </div>
                        <p className="text-emerald-400 font-mono font-bold">{formatMoney(data.amountDollars, currency, 2, rates)}</p>
                        <p className="text-slate-400 mt-0.5">{data.percentageOfExpenses}% das despesas</p>
                        <p className="text-slate-500 text-[10px]">{data.percentageOfIncome}% da renda total</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text in Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Despesas</span>
            <span className="text-base font-extrabold text-slate-100 font-mono">{formatMoney(totalExpenses, currency, 2, rates)}</span>
          </div>
        </div>

        {/* Legend / Category List */}
        <div className="md:col-span-6 max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {categories.map((cat, idx) => (
            <div
              key={cat.name}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                activeIndex === idx ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-medium text-slate-200 truncate">{cat.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono font-semibold text-slate-100">{formatMoney(cat.amountDollars, currency, 2, rates)}</span>
                <span className="text-slate-400 ml-2 font-mono text-[11px]">{cat.percentageOfExpenses}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
