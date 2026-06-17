export const DEFAULT_NETWORK_TIMEOUT_MS = 8000;

type FetchLike = typeof fetch;

export const createTimeoutFetch = (
  timeoutMs: number = DEFAULT_NETWORK_TIMEOUT_MS,
  baseFetch: FetchLike = fetch
): FetchLike => {
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_NETWORK_TIMEOUT_MS;

  const wrappedFetch: FetchLike = async (input, init) => {
    const timeoutController = new AbortController();
    const requestSignal = init?.signal;

    const handleExternalAbort = () => {
      timeoutController.abort();
    };

    if (requestSignal) {
      if (requestSignal.aborted) {
        timeoutController.abort();
      } else {
        requestSignal.addEventListener('abort', handleExternalAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, safeTimeoutMs);

    try {
      return await baseFetch(input, {
        ...init,
        signal: timeoutController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
      if (requestSignal) {
        requestSignal.removeEventListener('abort', handleExternalAbort);
      }
    }
  };

  return wrappedFetch;
};

interface IsLikelyOnlineOptions {
  platformOS?: string;
  navigatorOnLine?: boolean;
  probeUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export const isLikelyOnline = async ({
  platformOS = typeof navigator !== 'undefined' ? 'web' : 'native',
  navigatorOnLine,
  probeUrl,
  timeoutMs = 2500,
  fetchImpl = fetch,
}: IsLikelyOnlineOptions = {}): Promise<boolean> => {
  if (platformOS === 'web') {
    return Boolean(navigatorOnLine);
  }

  const url = String(probeUrl || '').trim();
  if (!url) {
    return false;
  }

  try {
    const timeoutFetch = createTimeoutFetch(timeoutMs, fetchImpl);
    const response = await timeoutFetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
