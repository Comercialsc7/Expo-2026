import { router } from 'expo-router';
import { useCallback } from 'react';

export const useNavigation = () => {
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Se não houver histórico de navegação, volta para a tela de login
      router.replace('/login');
    }
  }, []);

  const navigateTo = useCallback((route: string, params?: Record<string, any>) => {
    router.push({
      pathname: route,
      params
    });
  }, []);

  return {
    goBack,
    navigateTo
  };
}; 