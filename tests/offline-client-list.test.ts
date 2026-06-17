import { describe, expect, it } from 'vitest';

import { mergeClientLists } from '../lib/offlineClientList';

describe('offline client list merge', () => {
  it('preserva clientes existentes quando resposta online vem parcial', () => {
    const cached = [
      { id: '1', code: '100', equipe: 1, repre: '10', name: 'Cliente A' },
      { id: '2', code: '200', equipe: 1, repre: '10', name: 'Cliente B' },
    ] as any;

    const onlinePartial = [
      { id: '1', code: '100', equipe: 1, repre: '10', name: 'Cliente A Atualizado' },
    ] as any;

    const merged = mergeClientLists(cached, onlinePartial);

    expect(merged).toHaveLength(2);
    expect(merged.find((c: any) => c.id === '2')?.name).toBe('Cliente B');
    expect(merged.find((c: any) => c.id === '1')?.name).toBe('Cliente A Atualizado');
  });

  it('aceita novos clientes sem duplicar chave composta', () => {
    const cached = [
      { id: '1', code: '100', equipe: 1, repre: '10', name: 'Cliente A' },
    ] as any;

    const online = [
      { id: '1', code: '100', equipe: 1, repre: '10', name: 'Cliente A' },
      { id: '3', code: '300', equipe: 1, repre: '10', name: 'Cliente C' },
    ] as any;

    const merged = mergeClientLists(cached, online);

    expect(merged).toHaveLength(2);
    expect(merged.find((c: any) => c.id === '3')?.name).toBe('Cliente C');
  });
});
