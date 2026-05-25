import { describe, expect, it } from 'vitest';

import { buildTierPriceOptions, selectTierPriceOption } from '../lib/escalonadaPricing';

describe('escalonada pricing (produto 64526)', () => {
  const rows64526 = [
    { cod: 64526, faixa: 3, preco: 5.29 },
    { cod: 64526, faixa: 5, preco: 5.19 },
    { cod: 64526, faixa: 10, preco: 5.13 },
    { cod: 64526, faixa: 20, preco: 4.97 },
  ];

  it('seleciona a primeira faixa disponível (faixa 3)', () => {
    const options = buildTierPriceOptions(rows64526, 'CX', 10);
    const selected = selectTierPriceOption(options, 'first');

    expect(selected).not.toBeNull();
    expect(selected?.faixa).toBe(3);
    expect(selected?.unitPrice).toBeCloseTo(5.29, 6);
    expect(selected?.boxPrice).toBeCloseTo(52.9, 6);
  });

  it('seleciona a maior faixa disponível (faixa 20)', () => {
    const options = buildTierPriceOptions(rows64526, 'CX', 10);
    const selected = selectTierPriceOption(options, 'highest');

    expect(selected).not.toBeNull();
    expect(selected?.faixa).toBe(20);
    expect(selected?.unitPrice).toBeCloseTo(4.97, 6);
    expect(selected?.boxPrice).toBeCloseTo(49.7, 6);
  });
});