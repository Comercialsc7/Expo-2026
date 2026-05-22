import { describe, expect, it } from 'vitest';

import { inferOfflineRecordKey } from '../lib/offlineRecordKey';

describe('inferOfflineRecordKey', () => {
  it('gera chaves distintas para clients com mesmo code e vendedores diferentes', () => {
    const a = inferOfflineRecordKey('clients', {
      id: null,
      code: '12345',
      equipe: 1,
      repre: '1001',
    });

    const b = inferOfflineRecordKey('clients', {
      id: null,
      code: '12345',
      equipe: 1,
      repre: '2002',
    });

    expect(a).not.toBe(b);
  });

  it('prioriza composição estável para clients mesmo sem id', () => {
    const key = inferOfflineRecordKey('clients', {
      code: 'ABC123',
      equipe: 10,
      repre: '4040',
    });

    expect(key).toBe('ABC123:10:4040');
  });

  it('mantém fallback por id para tabelas gerais', () => {
    const key = inferOfflineRecordKey('products', {
      id: 'prod-1',
      code: 'P001',
      name: 'Produto',
    });

    expect(key).toBe('prod-1');
  });

  it('gera chave composta para relacao_prazo por codcli + diamax', () => {
    const key = inferOfflineRecordKey('relacao_prazo', {
      id: 99,
      codcli: 'C100',
      diamax: 28,
    });

    expect(key).toBe('C100:28:99');
  });
});
