export interface ParsedFinancialEntry {
  id: string;
  rawLine: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
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

const GROUP_RULES: { groupName: string; keywords: string[]; defaultType?: 'INCOME' | 'EXPENSE' }[] = [
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
 * Parses a Brazilian or standard numeric string into a clean float.
 * Examples:
 * - "2.300" -> 2300
 * - "144,75" -> 144.75
 * - "2.300,50" -> 2300.50
 * - "800" -> 800
 */
export function parseFlexibleNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;

  // Both dot and comma present: e.g., 2.300,50 or 2,300.50
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Brazilian format: 2.300,50
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      // US format: 2,300.50
      return parseFloat(cleaned.replace(/,/g, ''));
    }
  }

  // Only comma present: e.g., 144,75
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      // Could be 2,300 thousand separator, but in Brazil comma is decimal unless exact 000
      if (parts[1] === '000') {
        return parseFloat(cleaned.replace(/,/g, ''));
      }
    }
    return parseFloat(cleaned.replace(',', '.'));
  }

  // Only dot present: e.g., "2.300" (Brazilian thousand) vs "144.75" (decimal)
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    // If dot is followed by exactly 3 digits (like 2.300 or 1.500), treat as thousands in BRL
    if (parts.length >= 2 && parts[parts.length - 1].length === 3) {
      return parseFloat(cleaned.replace(/\./g, ''));
    }
    return parseFloat(cleaned);
  }

  return parseFloat(cleaned);
}

/**
 * Parses multi-line natural text into structured financial entries with automatic
 * semantic type inference (Income vs Expense) and group categorization.
 */
export function parseFinancialText(text: string): ParsedFinancialEntry[] {
  const lines = text.split(/\r?\n/);
  const results: ParsedFinancialEntry[] = [];

  lines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // Match description + separator/sign + numeric value at the end of the line
    // Examples:
    // "Salário: +2.300"
    // "Feira: 800"
    // "Brinde 200"
    // "Bonus 144,75"
    // "Carroceria do carro = 500"
    const match = trimmed.match(/^(.+?)(?:[:=\s]+)\s*([+-])?\s*(?:R\$|\$|€)?\s*([\d.,]+)\s*$/i);

    if (!match) return;

    const rawDesc = match[1].replace(/[:=\-]+$/, '').trim();
    const explicitSign = match[2]; // '+' | '-' | undefined
    const rawNumberStr = match[3];

    const amount = parseFlexibleNumber(rawNumberStr);
    if (!rawDesc || !Number.isFinite(amount) || amount <= 0) return;

    const lowerDesc = rawDesc.toLowerCase();

    // Determine INCOME vs EXPENSE
    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

    if (explicitSign === '+') {
      type = 'INCOME';
    } else if (explicitSign === '-') {
      type = 'EXPENSE';
    } else {
      const isIncomeKeyword = INCOME_KEYWORDS.some((kw) => lowerDesc.includes(kw));
      type = isIncomeKeyword ? 'INCOME' : 'EXPENSE';
    }

    // Determine Group Name
    let groupName = type === 'INCOME' ? 'Renda & Ganhos' : 'Despesas';

    for (const rule of GROUP_RULES) {
      if (rule.keywords.some((kw) => lowerDesc.includes(kw))) {
        groupName = rule.groupName;
        // Only override type if no explicit sign and not already matched as income
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
