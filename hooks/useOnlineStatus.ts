import { useState, useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const previousOnlineState = useRef(true);

  const checkNativeConnectivity = async (): Promise<boolean> => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      if (!baseUrl) {
        return false;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(baseUrl, {
          method: 'HEAD',
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      console.log('✅ Conexão restabelecida');
      setIsOnline(true);

      previousOnlineState.current = true;
    };

    const handleOffline = () => {
      console.log('⚠️ Conexão perdida - modo offline ativado');
      setIsOnline(false);
      previousOnlineState.current = false;
    };

    if (Platform.OS === 'web') {
      // Definir estado inicial no web
      const initialStatus = navigator.onLine;
      setIsOnline(initialStatus);
      previousOnlineState.current = initialStatus;

      // Adicionar event listeners
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    let mounted = true;

    const checkAndSyncNative = async () => {
      const onlineNow = await checkNativeConnectivity();
      if (!mounted) return;

      if (onlineNow) {
        await handleOnline();
      } else {
        handleOffline();
      }
    };

    // Estado inicial e polling leve para detectar reconexão no mobile.
    checkAndSyncNative();
    const interval = setInterval(checkAndSyncNative, 15000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAndSyncNative();
      }
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, []);

  return isOnline;
}
