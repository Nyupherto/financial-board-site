import React from 'react';
import { Layers, Sparkles, Umbrella, Compass } from 'lucide-react';
import { BucketAllocation } from '../types';
import { CurrencyMode, ExchangeRates, formatMoney } from '../utils/currency';

interface SmartAllocationsProps {
  allocations: BucketAllocation[];
  netCashFlow: number;
  currency: CurrencyMode;
  rates: ExchangeRates;
}

export const SmartAllocations: React.FC<SmartAllocationsProps> = ({
  allocations,
  netCashFlow,
  currency,
  rates,
}) => {
  if (allocations.length === 0 || netCashFlow <= 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-base font-bold text-slate-100">Divisão Inteligente de Sobras</h3>
        </div>
        <p className="text-xs text-slate-400">
          {netCashFlow <= 0
            ? 'Sem sobra líquida no mês para alocação automática.'
            : 'Quando houver sobra líquida, ela será distribuída automaticamente.'}
        </p>
      </div>
    );
  }

  const getBucketIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('emergency') || lower.includes('reserva')) return <Umbrella className="w-4 h-4 text-emerald-400" />;
    if (lower.includes('invest') || lower.includes('wealth')) return <Sparkles className="w-4 h-4 text-cyan-400" />;
    return <Compass className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" /> Divisão Inteligente de Sobras
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Distribuição automática da sobra líquida do mês ({formatMoney(netCashFlow, currency, 2, rates)})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {allocations.map((bucket) => (
          <div
            key={bucket.bucketId}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                {getBucketIcon(bucket.bucketName)}
                {bucket.bucketName}
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {bucket.percentageOfNetCashFlow}%
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-100">
              {formatMoney(bucket.allocatedAmountDollars, currency, 2, rates)}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, bucket.percentageOfNetCashFlow)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
