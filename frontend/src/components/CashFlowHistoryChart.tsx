import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { CashFlowHistoryItem } from '../types';
import { CurrencyMode, ExchangeRates, convertFromBrl, formatMoney, getCurrencySymbol } from '../utils/currency';

interface CashFlowHistoryChartProps {
  data: CashFlowHistoryItem[];
  currency: CurrencyMode;
  rates: ExchangeRates;
}

export const CashFlowHistoryChart: React.FC<CashFlowHistoryChartProps> = ({ data, currency, rates }) => {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" /> Histórico de Fluxo de Caixa (12 Meses)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Receitas vs Despesas vs Sobra Líquida</p>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
            Aguardando lançamentos para construir o histórico mensal.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="periodLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickFormatter={(v) => {
                  const conv = convertFromBrl(v, currency, rates);
                  return Math.abs(conv) >= 1000
                    ? `${symbol}${(conv / 1000).toFixed(1)}k`
                    : `${symbol}${Math.round(conv)}`;
                }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[170px]">
                        <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">{label}</p>
                        {payload.map((item: any) => (
                          <div key={item.name} className="flex items-center justify-between gap-3">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.name}:
                            </span>
                            <span className="font-mono font-bold text-slate-100">
                              {formatMoney(item.value, currency, 2, rates)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />
              <Bar
                dataKey="income"
                name="Receitas"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="expenses"
                name="Despesas"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                type="monotone"
                dataKey="netCashFlow"
                name="Sobra Líquida"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ r: 3, fill: '#06b6d4' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
