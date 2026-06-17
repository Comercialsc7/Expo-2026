import { describe, expect, it, vi } from 'vitest';

import { createTimeoutFetch, isLikelyOnline } from '../lib/network';

describe('network resilience helpers', () => {
  it('aborta requests lentas via timeout', async () => {
    const baseFetch = vi.fn((_input: any, init?: RequestInit) => {
      return new Promise<any>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => reject(new Error('aborted by timeout')), { once: true });
        }
      });
    });

    const timeoutFetch = createTimeoutFetch(15, baseFetch as any);

    await expect(timeoutFetch('https://example.com')).rejects.toThrow('aborted by timeout');
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('mantém resposta quando request conclui antes do timeout', async () => {
    const baseFetch = vi.fn(async () => ({ ok: true, status: 200 }));
    const timeoutFetch = createTimeoutFetch(250, baseFetch as any);

    const response = await timeoutFetch('https://example.com');

    expect(response.ok).toBe(true);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('usa navigator.onLine no web', async () => {
    await expect(
      isLikelyOnline({
        platformOS: 'web',
        navigatorOnLine: true,
      })
    ).resolves.toBe(true);

    await expect(
      isLikelyOnline({
        platformOS: 'web',
        navigatorOnLine: false,
      })
    ).resolves.toBe(false);
  });

  it('retorna false em native sem URL de probe', async () => {
    await expect(
      isLikelyOnline({
        platformOS: 'android',
        probeUrl: '',
      })
    ).resolves.toBe(false);
  });

  it('retorna true em native quando probe responde ok', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));

    await expect(
      isLikelyOnline({
        platformOS: 'android',
        probeUrl: 'https://example.com',
        timeoutMs: 50,
        fetchImpl: fetchImpl as any,
      })
    ).resolves.toBe(true);
  });

  it('retorna false em native quando probe falha', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(
      isLikelyOnline({
        platformOS: 'android',
        probeUrl: 'https://example.com',
        timeoutMs: 50,
        fetchImpl: fetchImpl as any,
      })
    ).resolves.toBe(false);
  });
});
