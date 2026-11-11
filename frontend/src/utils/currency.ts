export type CurrencyMode = 'BRL' | 'USD' | 'EUR';

export interface ExchangeRates {
  usd: number; // Value of 1 USD in BRL (Base: 1 Real = 1.00)
  eur: number; // Value of 1 EUR in BRL (Base: 1 Real = 1.00)
}

export const DEFAULT_RATES: ExchangeRates = {
  usd: 5.5,
  eur: 6.0,
};

/**
 * Converts a base BRL amount into the active target currency using manual exchange rates.
 * Base is always 1 Real (BRL) = 1.
 * Example: If 1 EUR = 6 BRL, then 600 BRL = 100 EUR.
 */
export function convertFromBrl(
  amountBrl: number,
  currency: CurrencyMode,
  rates: ExchangeRates = DEFAULT_RATES
): number {
  const safeVal = Number.isFinite(amountBrl) ? amountBrl : 0;
  if (currency === 'BRL') return safeVal;
  if (currency === 'USD') {
    const rate = rates.usd > 0 ? rates.usd : 1;
    return safeVal / rate;
  }
  if (currency === 'EUR') {
    const rate = rates.eur > 0 ? rates.eur : 1;
    return safeVal / rate;
  }
  return safeVal;
}

/**
 * Converts an input amount from the active currency back to base BRL.
 */
export function convertToBrl(
  amountInActiveCurrency: number,
  currency: CurrencyMode,
  rates: ExchangeRates = DEFAULT_RATES
): number {
  const safeVal = Number.isFinite(amountInActiveCurrency) ? amountInActiveCurrency : 0;
  if (currency === 'BRL') return safeVal;
  if (currency === 'USD') {
    const rate = rates.usd > 0 ? rates.usd : 1;
    return safeVal * rate;
  }
  if (currency === 'EUR') {
    const rate = rates.eur > 0 ? rates.eur : 1;
    return safeVal * rate;
  }
  return safeVal;
}

/**
 * Formats a base BRL monetary value into the selected currency (BRL, USD, EUR)
 * applying the manual exchange rate calculation dynamically.
 */
export function formatMoney(
  valueBrl: number,
  currency: CurrencyMode = 'BRL',
  maximumFractionDigits: number = 2,
  rates: ExchangeRates = DEFAULT_RATES
): string {
  const converted = convertFromBrl(valueBrl, currency, rates);

  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
      maximumFractionDigits,
    }).format(converted);
  }

  if (currency === 'EUR') {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
      maximumFractionDigits,
    }).format(converted);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
    maximumFractionDigits,
  }).format(converted);
}

export function getCurrencySymbol(currency: CurrencyMode): string {
  if (currency === 'BRL') return 'R$';
  if (currency === 'EUR') return '€';
  return '$';
}
