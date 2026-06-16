import { describe, expect, it } from 'vitest';
import { resolveFinalPrice } from '../lib/priceAdjustment';

describe('price adjustment resolution', () => {
  it('aplica preço ajustado retornado pelo backend', () => {
    const result = resolveFinalPrice(100, [{ adjusted_price: 112.5 }]);
    expect(result).toBe(112.5);
  });

  it('mantém preço base quando backend não retorna preço válido', () => {
    const result = resolveFinalPrice(89.9, [{ adjusted_price: null }]);
    expect(result).toBe(89.9);
  });
});
