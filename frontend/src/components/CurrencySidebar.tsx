import React from 'react';
import { Coins, DollarSign, Euro, ArrowRightLeft, Percent } from 'lucide-react';
import { CurrencyMode, ExchangeRates } from '../utils/currency';

interface CurrencySidebarProps {
  currency: CurrencyMode;
  onSelectCurrency: (c: CurrencyMode) => void;
  rates: ExchangeRates;
  onChangeRates: (rates: ExchangeRates) => void;
  annualInterestRate: number;
  onChangeInterestRate: (rate: number) => void;
}

export const CurrencySidebar: React.FC<CurrencySidebarProps> = ({
  currency,
  onSelectCurrency,
  rates,
  onChangeRates,
  annualInterestRate,
  onChangeInterestRate,
}) => {
  const monthlyEquivalent = (((Math.pow(1 + (annualInterestRate || 0) / 100 / 12, 1) - 1) * 100)).toFixed(2);

  return (
    <div className="space-y-3">
      {/* Box 1: Seletor de Moeda Visualizada (BRL / USD / EUR) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-emerald-400" /> Moeda Visualizada
          </span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            Base: R$ 1,00
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onSelectCurrency('BRL')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
              currency === 'BRL'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className="text-sm font-black">R$</span>
            <span className="text-[10px]">Real</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectCurrency('USD')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
              currency === 'USD'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className="text-sm font-black">$</span>
            <span className="text-[10px]">Dólar</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectCurrency('EUR')}
            className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
              currency === 'EUR'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <span className="text-sm font-black">€</span>
            <span className="text-[10px]">Euro</span>
          </button>
        </div>
      </div>

      {/* Box 2: Conversor Manual Dólar (USD -> BRL) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-emerald-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Cotação Dólar (USD)</h4>
              <p className="text-[10px] text-slate-400">1 Dólar equivale a quantos Reais?</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-emerald-500 transition-colors">
          <span className="text-xs font-mono text-slate-400 shrink-0">1 USD = R$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={rates.usd || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeRates({
                ...rates,
                usd: Number.isFinite(val) && val > 0 ? val : 0,
              });
            }}
            placeholder="5.50"
            className="w-full bg-transparent text-right text-sm font-mono font-bold text-emerald-400 focus:outline-none"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Base: R$ 1,00</span>
          <span>1 R$ = $ {rates.usd > 0 ? (1 / rates.usd).toFixed(4) : '0.0000'}</span>
        </div>
      </div>

      {/* Box 3: Conversor Manual Euro (EUR -> BRL) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-cyan-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Euro className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Cotação Euro (EUR)</h4>
              <p className="text-[10px] text-slate-400">1 Euro equivale a quantos Reais?</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-cyan-500 transition-colors">
          <span className="text-xs font-mono text-slate-400 shrink-0">1 EUR = R$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={rates.eur || ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChangeRates({
                ...rates,
                eur: Number.isFinite(val) && val > 0 ? val : 0,
              });
            }}
            placeholder="6.00"
            className="w-full bg-transparent text-right text-sm font-mono font-bold text-cyan-400 focus:outline-none"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Base: R$ 1,00</span>
          <span>1 R$ = € {rates.eur > 0 ? (1 / rates.eur).toFixed(4) : '0.0000'}</span>
        </div>
      </div>

      {/* Box 4: Taxa de Juros Interna (Metas / Savings) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-violet-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Percent className="w-3.5 h-3.5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Juros Interno (Savings)</h4>
              <p className="text-[10px] text-slate-400">Taxa anual aplicada às suas Metas</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:border-violet-500 transition-colors">
          <span className="text-xs font-mono text-slate-400 shrink-0">Taxa (% a.a.)</span>
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
            placeholder="10.0"
            className="w-full bg-transparent text-right text-sm font-mono font-bold text-violet-400 focus:outline-none"
          />
          <span className="text-xs font-mono text-violet-400 font-bold">%</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Juros Compostos</span>
          <span>~ {monthlyEquivalent}% ao mês</span>
        </div>
      </div>

      {/* Status info */}
      <div className="px-3 py-2 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
        <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          Visualizando em{' '}
          <strong className="text-slate-200">
            {currency === 'BRL'
              ? 'Real (R$ 1,00)'
              : currency === 'USD'
              ? `Dólar (R$ ${rates.usd.toFixed(2)})`
              : `Euro (R$ ${rates.eur.toFixed(2)})`}
          </strong>
        </span>
      </div>
    </div>
  );
};
