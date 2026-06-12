import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { InstallPWABanner } from '../components/shared/InstallPWABanner';
import { OfflineIndicator } from '../components/shared/OfflineIndicator';
import OfflineCache from '../lib/OfflineCache';
import OfflineSQLiteService from '../lib/OfflineSQLiteService';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // This hook is required and must never be removed
  useFrameworkReady();
  const isWeb = Platform.OS === 'web';

  const [fontsLoaded, fontError] = useFonts({
    // Using system fonts - no custom fonts loaded for now
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Preparar cache automaticamente se necessário
  useEffect(() => {
    OfflineSQLiteService.init().catch((error) => {
      console.error('Erro ao inicializar SQLite offline:', error);
    });

    async function prepareOfflineCacheIfNeeded() {
      try {
        // Só verifica status se estiver online
        if (Platform.OS === 'web' && !navigator.onLine) {
          console.log('⚠️ App offline - status de cache será validado depois');
          return;
        }

        const status = await OfflineCache.isReady();
        const stale = await OfflineCache.isStale(60);

        // A preparação do cache é feita no fluxo de login para evitar duplicidade.
        if (!status.ready || stale) {
          console.log('ℹ️ Cache offline pendente/desatualizado; atualização ocorrerá no login.');
        } else {
          console.log('✅ Cache offline já está pronto e atualizado');
        }
      } catch (error) {
        console.error('Erro ao verificar cache offline:', error);
      }
    }

    if (fontsLoaded || fontError) {
      prepareOfflineCacheIfNeeded();
    }
  }, [fontsLoaded, fontError]);

  return (
    <View style={styles.container}>
      {isWeb ? <InstallPWABanner /> : null}
      {isWeb ? <OfflineIndicator /> : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});