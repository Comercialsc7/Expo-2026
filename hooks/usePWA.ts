import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Apenas executar no navegador web
    if (Platform.OS !== 'web') {
      return;
    }

    // Verificar se o app já está instalado
    const checkIfInstalled = () => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        setIsInstalled(isStandalone);
      }
    };

    checkIfInstalled();

    // Registrar Service Worker
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/',
          });

          console.log('Service Worker registrado com sucesso:', registration.scope);

          // Verificar atualizações
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Nova versão disponível! Atualize a página.');
                  // Você pode mostrar uma notificação ao usuário aqui
                }
              });
            }
          });
        } catch (error) {
          console.error('Erro ao registrar Service Worker:', error);
        }
      }
    };

    registerServiceWorker();

    // Capturar evento de instalação
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setIsInstallable(true);
      console.log('PWA pode ser instalado');
    };

    // Capturar evento de app instalado
    const handleAppInstalled = () => {
      console.log('PWA foi instalado');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.log('Prompt de instalação não disponível');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        console.log('Usuário aceitou instalar o PWA');
        setIsInstallable(false);
        return true;
      } else {
        console.log('Usuário recusou instalar o PWA');
        return false;
      }
    } catch (error) {
      console.error('Erro ao mostrar prompt de instalação:', error);
      return false;
    } finally {
      setDeferredPrompt(null);
    }
  };

  return {
    isInstallable,
    isInstalled,
    promptInstall,
  };
}
