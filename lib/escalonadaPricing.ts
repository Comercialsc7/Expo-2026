export interface EscalonadaRow {
  cod: string | number;
  faixa: string | number;
  preco: string | number;
}

export interface TierPriceOption {
  emb: string;
  qtdeEmb: number;
  faixa: number;
  unitPrice: number;
  boxPrice: number;
}

function toNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  const normalized = String(value).replace(',', '.');
  return Number(normalized);
}

export function buildTierPriceOptions(
  rows: EscalonadaRow[],
  emb: string,
  qtdeEmb: number
): TierPriceOption[] {
  const safeQtdeEmb = Math.max(1, Number(qtdeEmb) || 1);

  return (rows || [])
    .map((row) => {
      const faixa = toNumber(row.faixa);
      const unitPrice = toNumber(row.preco);

      if (!Number.isFinite(faixa) || !Number.isFinite(unitPrice) || faixa <= 0 || unitPrice < 0) {
        return null;
      }

      return {
        emb,
        qtdeEmb: safeQtdeEmb,
        faixa,
        unitPrice,
        boxPrice: unitPrice * safeQtdeEmb,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a as TierPriceOption).faixa - (b as TierPriceOption).faixa) as TierPriceOption[];
}

export function selectTierPriceOption(
  options: TierPriceOption[],
  selector: 'first' | 'highest' | number
): TierPriceOption | null {
  if (!options || options.length === 0) {
    return null;
  }

  if (selector === 'first') {
    return options[0];
  }

  if (selector === 'highest') {
    return options[options.length - 1];
  }

  return options.find((option) => option.faixa === selector) || null;
}