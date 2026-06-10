import { describe, expect, it } from 'vitest';
import { calculateSpins, MAX_SPINS } from '../lib/spinRewards';

describe('calculateSpins', () => {
  it('retorna 0 giros para pedido online de R$ 1.000,00', () => {
    expect(calculateSpins(1000)).toBe(0);
  });

  it('retorna 0 giros para pedido offline de R$ 1.000,00', () => {
    expect(calculateSpins(1000)).toBe(0);
  });

  it('retorna 4 giros para pedido online de R$ 12.120,00', () => {
    expect(calculateSpins(12120)).toBe(4);
  });

  it('retorna 4 giros para pedido offline de R$ 12.120,00', () => {
    expect(calculateSpins(12120)).toBe(4);
  });

  it('limita o total ao máximo de 5 giros', () => {
    expect(calculateSpins(100000)).toBe(MAX_SPINS);
  });

  it('limita o total ao máximo de 10 giros para cliente com pauta completa', () => {
    expect(calculateSpins(100000, 10)).toBe(10);
  });
});