let storageAvailable = false;

if (typeof window !== 'undefined') {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    storageAvailable = true;
  } catch (e) {
    storageAvailable = false;
    console.warn('⚠️ Storage não disponível (ambiente restrito). Funcionalidades offline desabilitadas.');
  }
}

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!storageAvailable) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!storageAvailable) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // Silenciosamente ignora
    }
  },

  async removeItem(key: string): Promise<void> {
    if (!storageAvailable) return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      // Silenciosamente ignora
    }
  },

  async clear(): Promise<void> {
    if (!storageAvailable) return;
    try {
      window.localStorage.clear();
    } catch (e) {
      // Silenciosamente ignora
    }
  },

  isAvailable(): boolean {
    return storageAvailable;
  }
};
