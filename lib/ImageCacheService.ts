/**
 * ImageCacheService
 *
 * Persiste imagens remotas em disco local (expo-file-system) com índice SQLite.
 * Em aparelhos fracos, evita piscadas de imagem e garante exibição offline estável.
 *
 * Estratégia:
 *  1. Primeira chamada para uma URL baixa o arquivo e salva o caminho local no SQLite.
 *  2. Chamadas subsequentes retornam imediatamente o caminho local sem rede.
 *  3. Fila com concorrência limitada (2 workers) para não sobrecarregar o aparelho.
 *  4. Imagens que falharam 3× são marcadas como "failed" — sem retry infinito.
 *  5. LRU leve: quando > MAX_CACHED_IMAGES, remove as mais antigas.
 *  6. No web/PWA, usa localStorage como índice sem salvar arquivos (sem FileSystem).
 */

import { Platform } from 'react-native';
import OfflineSQLiteService from './OfflineSQLiteService';
import { createTimeoutFetch, DEFAULT_NETWORK_TIMEOUT_MS } from './network';

const IS_WEB = Platform.OS === 'web';

// Importado dinamicamente para evitar erro no web onde o módulo não existe.
type FSType = typeof import('expo-file-system');
let _fs: FSType | null = null;
const getFS = async (): Promise<FSType | null> => {
  if (IS_WEB) return null;
  if (_fs) return _fs;
  try {
    _fs = await import('expo-file-system');
    return _fs;
  } catch {
    return null;
  }
};

interface CacheEntry {
  remote_url: string;
  local_uri: string;
  status: 'ok' | 'downloading' | 'failed';
  cached_at: string;
  retry_count: number;
}

const TABLE = 'image_cache';
const MAX_CACHED_IMAGES = 300;
const MAX_RETRY = 3;
const CONCURRENCY = 2;
const DOWNLOAD_TIMEOUT_MS = 15000;
const WEB_STORE_KEY = '__image_cache_web__';

// Fila de download em memória.
type QueueEntry = { url: string; resolve: (uri: string) => void; reject: (err: Error) => void };
const _queue: QueueEntry[] = [];
let _activeWorkers = 0;

// Cache de mapeamento em memória para evitar I/O repetido em telas com muitos itens.
const _memoryMap = new Map<string, string>();

class ImageCacheService {
  private static _initialized = false;

  // ---------- INIT ----------

  static async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    if (!IS_WEB) {
      // Garante que o diretório de cache existe.
      const fs = await getFS();
      if (fs) {
        const dir = await this._getCacheDir(fs);
        const info = await fs.getInfoAsync(dir);
        if (!info.exists) {
          await fs.makeDirectoryAsync(dir, { intermediates: true });
        }
      }
    }
  }

  private static async _getCacheDir(fs: FSType): Promise<string> {
    return `${fs.cacheDirectory}img_cache/`;
  }

  // ---------- PUBLIC API ----------

  /**
   * Retorna a URI local para a imagem.
   * Se não estiver cacheada, dispara o download em background e retorna a URL remota
   * para que a UI não trave esperando.
   */
  static async resolveUri(remoteUrl: string): Promise<string> {
    const safe = String(remoteUrl || '').trim();
    if (!safe) return safe;

    await this.init();

    // 1. Verifica memória primeiro (zero I/O).
    const cached = _memoryMap.get(safe);
    if (cached) return cached;

    // 2. Verifica índice persistente.
    const entry = await this._loadEntry(safe);
    if (entry?.status === 'ok') {
      const localUri = entry.local_uri;
      // No web, o local_uri já é a URL remota (sem FileSystem real).
      if (IS_WEB) {
        _memoryMap.set(safe, localUri);
        return localUri;
      }
      // Verifica se o arquivo ainda existe em disco.
      const fs = await getFS();
      if (fs) {
        const info = await fs.getInfoAsync(localUri);
        if (info.exists) {
          _memoryMap.set(safe, localUri);
          return localUri;
        }
      }
      // Arquivo sumiu: remove entrada e baixa novamente.
      await this._deleteEntry(safe);
    }

    if (entry?.status === 'failed' && (entry.retry_count ?? 0) >= MAX_RETRY) {
      return safe; // URL remota como fallback final.
    }

    // 3. Enfileira download em background e retorna URL remota imediatamente.
    this._enqueue(safe);
    return safe;
  }

  /**
   * Baixa a imagem e aguarda o resultado (útil para pré-aquecimento durante sync).
   * Se já estiver em cache, retorna o local_uri imediatamente.
   */
  static async prefetch(remoteUrl: string): Promise<string> {
    const safe = String(remoteUrl || '').trim();
    if (!safe) return safe;

    await this.init();

    const cached = _memoryMap.get(safe);
    if (cached) return cached;

    const entry = await this._loadEntry(safe);
    if (entry?.status === 'ok') {
      _memoryMap.set(safe, entry.local_uri);
      return entry.local_uri;
    }

    return new Promise<string>((resolve, reject) => {
      _queue.push({ url: safe, resolve, reject });
      this._pump();
    });
  }

  /**
   * Baixa uma lista de URLs com throttle para não travar aparelho fraco.
   */
  static async prefetchMany(urls: string[]): Promise<void> {
    const unique = [...new Set(urls.filter((u) => u && u.trim()))];
    await Promise.allSettled(unique.map((url) => this.prefetch(url)));
  }

  /**
   * Limpa o cache de disco e o índice SQLite/web.
   */
  static async clearAll(): Promise<void> {
    _memoryMap.clear();
    if (IS_WEB) {
      try {
        localStorage.removeItem(WEB_STORE_KEY);
      } catch { /* ignore */ }
      return;
    }
    try {
      await OfflineSQLiteService.clearTable(TABLE);
      const fs = await getFS();
      if (fs) {
        const dir = await this._getCacheDir(fs);
        const info = await fs.getInfoAsync(dir);
        if (info.exists) {
          await fs.deleteAsync(dir, { idempotent: true });
        }
      }
    } catch { /* ignore */ }
  }

  // ---------- QUEUE / WORKERS ----------

  private static _enqueue(url: string): void {
    const alreadyQueued = _queue.some((e) => e.url === url);
    if (alreadyQueued) return;
    _queue.push({
      url,
      resolve: () => { /* fire-and-forget */ },
      reject: () => { /* fire-and-forget */ },
    });
    this._pump();
  }

  private static _pump(): void {
    while (_activeWorkers < CONCURRENCY && _queue.length > 0) {
      const entry = _queue.shift()!;
      _activeWorkers++;
      this._download(entry.url)
        .then((localUri) => {
          _memoryMap.set(entry.url, localUri);
          entry.resolve(localUri);
        })
        .catch((err) => {
          entry.reject(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          _activeWorkers--;
          this._pump();
        });
    }
  }

  // ---------- DOWNLOAD ----------

  private static async _download(url: string): Promise<string> {
    if (IS_WEB) {
      // No web não há FileSystem. Apenas registra a URL remota como "ok".
      await this._saveEntry({ remote_url: url, local_uri: url, status: 'ok', retry_count: 0 });
      return url;
    }

    const fs = await getFS();
    if (!fs) return url;

    const existing = await this._loadEntry(url);
    const retryCount = existing?.retry_count ?? 0;

    if (retryCount >= MAX_RETRY) return url;

    try {
      const dir = await this._getCacheDir(fs);
      const filename = this._urlToFilename(url);
      const localUri = `${dir}${filename}`;

      // Garante diretório.
      const dirInfo = await fs.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await fs.makeDirectoryAsync(dir, { intermediates: true });
      }

      const timeoutFetch = createTimeoutFetch(DOWNLOAD_TIMEOUT_MS);

      // Verifica se arquivo já existe (e.g. crash entre download e save do índice).
      const fileInfo = await fs.getInfoAsync(localUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        const response = await timeoutFetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        // Usa downloadAsync para gravar direto no disco (mais eficiente que blob).
        const dlResult = await fs.downloadAsync(url, localUri);
        if (dlResult.status < 200 || dlResult.status >= 300) {
          throw new Error(`Download HTTP ${dlResult.status}`);
        }
      }

      await this._saveEntry({ remote_url: url, local_uri: localUri, status: 'ok', retry_count: 0 });
      await this._evictOldEntriesIfNeeded();

      return localUri;
    } catch (err) {
      const newRetry = retryCount + 1;
      const status: 'failed' | 'downloading' = newRetry >= MAX_RETRY ? 'failed' : 'downloading';
      await this._saveEntry({
        remote_url: url,
        local_uri: url,
        status,
        retry_count: newRetry,
      });
      return url;
    }
  }

  // ---------- INDEX (SQLite / web localStorage) ----------

  private static _urlToFilename(url: string): string {
    // Hash simples baseado na URL para nome único sem caracteres especiais.
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const c = url.charCodeAt(i);
      hash = (hash << 5) - hash + c;
      hash |= 0; // Convert to 32bit integer
    }
    const ext = url.includes('.png') ? '.png' : '.jpg';
    return `img_${(hash >>> 0).toString(16)}${ext}`;
  }

  private static async _loadEntry(url: string): Promise<CacheEntry | null> {
    if (IS_WEB) {
      try {
        const raw = localStorage.getItem(WEB_STORE_KEY);
        const store: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
        return store[url] ?? null;
      } catch {
        return null;
      }
    }
    try {
      const rows = await OfflineSQLiteService.getAllWhere<CacheEntry>(TABLE, {
        remote_url: url,
      });
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  private static async _saveEntry(entry: Omit<CacheEntry, 'cached_at'>): Promise<void> {
    const full: CacheEntry = { ...entry, cached_at: new Date().toISOString() };
    if (IS_WEB) {
      try {
        const raw = localStorage.getItem(WEB_STORE_KEY);
        const store: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
        store[entry.remote_url] = full;
        localStorage.setItem(WEB_STORE_KEY, JSON.stringify(store));
      } catch { /* ignore quota exceeded */ }
      return;
    }
    try {
      await OfflineSQLiteService.upsertMany(TABLE, [full]);
    } catch { /* ignore */ }
  }

  private static async _deleteEntry(url: string): Promise<void> {
    if (IS_WEB) {
      try {
        const raw = localStorage.getItem(WEB_STORE_KEY);
        const store: Record<string, CacheEntry> = raw ? JSON.parse(raw) : {};
        delete store[url];
        localStorage.setItem(WEB_STORE_KEY, JSON.stringify(store));
      } catch { /* ignore */ }
      return;
    }
    try {
      // upsertMany com status deleted não existe; limpa individualmente.
      // OfflineSQLiteService não expõe deleteWhere — reescrevemos como failed.
      await this._saveEntry({ remote_url: url, local_uri: url, status: 'failed', retry_count: MAX_RETRY });
    } catch { /* ignore */ }
  }

  private static async _evictOldEntriesIfNeeded(): Promise<void> {
    if (IS_WEB) return;
    try {
      const all = await OfflineSQLiteService.getAll<CacheEntry>(TABLE);
      if (all.length <= MAX_CACHED_IMAGES) return;

      // Remove os mais antigos (sort ASC por cached_at, remove excedente).
      const sorted = [...all].sort((a, b) =>
        String(a.cached_at || '').localeCompare(String(b.cached_at || ''))
      );
      const toRemove = sorted.slice(0, all.length - MAX_CACHED_IMAGES);
      const fs = await getFS();

      for (const entry of toRemove) {
        if (fs && entry.local_uri && entry.local_uri !== entry.remote_url) {
          try {
            await fs.deleteAsync(entry.local_uri, { idempotent: true });
          } catch { /* ignore */ }
        }
        // Marca como failed para reutilizar infraestrutura de índice.
        await this._saveEntry({
          remote_url: entry.remote_url,
          local_uri: entry.remote_url,
          status: 'failed',
          retry_count: MAX_RETRY,
        });
      }
    } catch { /* ignore eviction errors */ }
  }
}

export default ImageCacheService;
