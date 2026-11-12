import { EntryType } from '../types';

export interface ParsedFinancialEntry {
  id: string;
  rawLine: string;
  description: string;
  amount: number;
  type: EntryType;
  groupName: string;
  status: 'PAID' | 'PENDING';
}

const INCOME_KEYWORDS = [
  'salario',
  'salário',
  'bonus',
  'bônus',
  'brinde',
  'ganho',
  'ganhos',
  'receita',
  'rendimento',
  'dividendo',
  'dividendos',
  'pix recebido',
  'venda',
  'freelance',
  'freela',
  'premio',
  'prêmio',
  'reembolso',
  'comissao',
  'comissão',
  'adiantamento',
  'aposentadoria',
  'pensão',
  'pensao',
  'lucro',
];

const SAVINGS_KEYWORDS = [
  'meta',
  'savings',
  'poupança',
  'poupanca',
  'reserva',
  'investimento',
  'investir',
  'caixinha',
  'cofre',
  'aporte',
  'guardar',
  'objetivo',
];

const GROUP_RULES: { groupName: string; keywords: string[]; defaultType?: EntryType }[] = [
  {
    groupName: 'Metas & Savings',
    keywords: SAVINGS_KEYWORDS,
    defaultType: 'SAVINGS',
  },
  {
    groupName: 'Mantimento',
    keywords: [
      'feira',
      'mercado',
      'supermercado',
      'mantimento',
      'mantimentos',
      'padaria',
      'açougue',
      'acougue',
      'hortifruti',
      'sacolão',
      'sacolao',
      'comida',
      'alimentação',
      'alimentacao',
      'rancho',
      'atacadão',
      'atacadao',
    ],
    defaultType: 'EXPENSE',
  },
  {
    groupName: 'Despesas com Carro',
    keywords: [
      'carro',
      'carroceria',
      'gasolina',
      'combustível',
      'combustivel',
      'etanol',
      'diesel',
      'pneu',
      'ipva',
      'mecânico',
      'mecanico',
      'estacionamento',
      'pedágio',
      'pedagio',
      'seguro auto',
      'óleo',
      'oleo',
      'parachoque',
      'embreagem',
      'freio',
    ],
    defaultType: 'EXPENSE',
  },
  {
    groupName: 'Lazer',
    keywords: [
      'lazer',
      'cinema',
      'viagem',
      'passeio',
      'restaurante',
      'lanche',
      'pizza',
      'hamburguer',
      'bar',
      'festa',
      'show',
      'jogo',
      'game',
      'netflix',
      'spotify',
      'streaming',
      'ingresso',
      'shopping',
      'praia',
      'hotel',
    ],
    defaultType: 'EXPENSE',
  },
  {
    groupName: 'Moradia & Contas',
    keywords: [
      'aluguel',
      'condomínio',
      'condominio',
      'luz',
      'energia',
      'água',
      'agua',
      'internet',
      'fibra',
      'gás',
      'gas',
      'iptu',
      'telefone',
      'celular',
      'faxina',
    ],
    defaultType: 'EXPENSE',
  },
  {
    groupName: 'Ganhos com a Oficina',
    keywords: ['ganhos com a oficina', 'ganho oficina', 'serviço oficina', 'servico oficina'],
    defaultType: 'INCOME',
  },
];

/**
 * Parses a Brazilian or standard numeric string with optional 'k' / 'K' multipliers
 * (where each 'k'/'K' multiplies by 1,000) into a clean float.
 * Examples:
 * - "3k" or "3K" -> 3000
 * - "3kk" or "3KK" -> 3000000
 * - "1.5k" or "1,5k" -> 1500
 * - "2.300" -> 2300
 * - "144,75" -> 144.75
 * - "2.300,50" -> 2300.50
 * - "800" -> 800
 */
export function parseFlexibleNumber(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // Count trailing 'k' or 'K' multipliers (e.g., "3k" -> 1, "3kk" -> 2)
  const kMatch = trimmed.match(/(k+)\s*$/i);
  const kCount = kMatch ? kMatch[1].length : 0;
  const multiplier = Math.pow(1000, kCount);

  const withoutK = kCount > 0 ? trimmed.slice(0, trimmed.length - kMatch![0].length) : trimmed;
  const cleaned = withoutK.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;

  let baseValue = 0;

  // Both dot and comma present: e.g., 2.300,50 or 2,300.50
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      baseValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      baseValue = parseFloat(cleaned.replace(/,/g, ''));
    }
  } else if (cleaned.includes(',')) {
    // Only comma present: e.g., 144,75 or 1,5k
    const parts = cleaned.split(',');
    if (kCount === 0 && parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[1] === '000') {
      baseValue = parseFloat(cleaned.replace(/,/g, ''));
    } else {
      baseValue = parseFloat(cleaned.replace(',', '.'));
    }
  } else if (cleaned.includes('.')) {
    // Only dot present: e.g., "2.300" (Brazilian thousand) vs "1.5k" or "144.75" (decimal)
    const parts = cleaned.split('.');
    if (kCount === 0 && parts.length >= 2 && parts[parts.length - 1].length === 3) {
      baseValue = parseFloat(cleaned.replace(/\./g, ''));
    } else {
      baseValue = parseFloat(cleaned);
    }
  } else {
    baseValue = parseFloat(cleaned);
  }

  if (!Number.isFinite(baseValue)) return 0;
  return baseValue * multiplier;
}

/**
 * Parses multi-line natural text into structured financial entries with automatic
 * semantic type inference (INCOME vs EXPENSE vs SAVINGS) and group categorization.
 */
export function parseFinancialText(text: string): ParsedFinancialEntry[] {
  const lines = text.split(/\r?\n/);
  const results: ParsedFinancialEntry[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // Match description + separator/sign + numeric value with optional 'k'/'kk' suffix at the end of the line
    // Examples:
    // "Salário: +2.300"
    // "Salário: 3k"
    // "Patrimônio: 3kk"
    // "Meta Viagem: 1.5k"
    // "Feira: 800"
    // "Bonus 144,75"
    // "Carroceria do carro = 500"
    const match = trimmed.match(/^(.+?)(?:[:=\s]+)\s*([+-])?\s*(?:R\$|\$|€)?\s*([\d.,]+\s*k*)\s*$/i);

    if (!match) return;

    const rawDesc = match[1].replace(/[:=\-]+$/, '').trim();
    const explicitSign = match[2]; // '+' | '-' | undefined
    const rawNumberStr = match[3];

    const amount = parseFlexibleNumber(rawNumberStr);
    if (!rawDesc || !Number.isFinite(amount) || amount <= 0) return;

    const lowerDesc = rawDesc.toLowerCase();

    // Determine INCOME vs EXPENSE vs SAVINGS
    let type: EntryType = 'EXPENSE';
    const isSavingsKeyword = SAVINGS_KEYWORDS.some((kw) => lowerDesc.includes(kw));
    const isIncomeKeyword = INCOME_KEYWORDS.some((kw) => lowerDesc.includes(kw));

    if (isSavingsKeyword) {
      type = 'SAVINGS';
    } else if (explicitSign === '+') {
      type = 'INCOME';
    } else if (explicitSign === '-') {
      type = 'EXPENSE';
    } else if (isIncomeKeyword) {
      type = 'INCOME';
    }

    // Determine Group Name
    let groupName =
      type === 'SAVINGS'
        ? 'Metas & Savings'
        : type === 'INCOME'
        ? 'Renda & Ganhos'
        : 'Despesas';

    for (const rule of GROUP_RULES) {
      if (rule.keywords.some((kw) => lowerDesc.includes(kw))) {
        groupName = rule.groupName;
        break;
      }
    }

    results.push({
      id: `parsed-${index}-${Date.now()}`,
      rawLine: trimmed,
      description: rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1),
      amount,
      type,
      groupName,
      status: 'PAID',
    });
  });

  return results;
}
