import { describe, expect, it, vi } from 'vitest';

import { withTimeoutFallback } from '../lib/asyncTimeout';

describe('withTimeoutFallback', () => {
  it('retorna valor da tarefa quando conclui antes do timeout', async () => {
    const result = await withTimeoutFallback(Promise.resolve('ok'), 100, 'fallback');
    expect(result).toBe('ok');
  });

  it('retorna fallback quando tarefa demora demais', async () => {
    vi.useFakeTimers();

    const hangingTask = new Promise<string>(() => {
      // Intencionalmente pendente para validar fallback.
    });

    const resultPromise = withTimeoutFallback(hangingTask, 250, 'fallback');

    vi.advanceTimersByTime(250);

    await expect(resultPromise).resolves.toBe('fallback');

    vi.useRealTimers();
  });

  it('normaliza timeout inválido para valor seguro', async () => {
    vi.useFakeTimers();

    const hangingTask = new Promise<number>(() => {
      // Intencionalmente pendente para validar fallback com timeout inválido.
    });

    const resultPromise = withTimeoutFallback(hangingTask, 0, 99);

    vi.advanceTimersByTime(3000);

    await expect(resultPromise).resolves.toBe(99);

    vi.useRealTimers();
  });
});
