import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import OfflineCache from '@/lib/OfflineCache';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Verifica sessão ao montar
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setLoading(true);

      // Tenta buscar sessão online
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        setIsOffline(false);
      } else if (error || !session) {
        // Se falhar, tenta buscar do cache offline
        const cachedUser = await OfflineCache.getUser();
        const hasValidSession = await OfflineCache.hasValidSession();

        if (cachedUser && hasValidSession) {
          setUser(cachedUser);
          setIsOffline(true);
          console.log('✅ Autenticação offline ativada');
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);

      // Em caso de erro de rede, tenta cache offline
      const cachedUser = await OfflineCache.getUser();
      const hasValidSession = await OfflineCache.hasValidSession();

      if (cachedUser && hasValidSession) {
        setUser(cachedUser);
        setIsOffline(true);
        console.log('✅ Autenticação offline ativada (fallback)');
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Tenta fazer logout online
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Logout offline');
    }

    // Limpa cache offline
    await OfflineCache.clear();

    // Reseta estado
    setUser(null);
    setIsOffline(false);

    // Volta para login
    router.replace('/');
  };

  return {
    user,
    loading,
    isOffline,
    logout,
    checkSession,
  };
}; 