import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { InstallPWABanner } from '../components/shared/InstallPWABanner';
import { OfflineIndicator } from '../components/shared/OfflineIndicator';
import OfflineCache from '../lib/OfflineCache';
import OfflineSQLiteService from '../lib/OfflineSQLiteService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // This hook is required and must never be removed
  useFrameworkReady();

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
        // Só prepara se estiver online
        if (Platform.OS === 'web' && !navigator.onLine) {
          console.log('⚠️ App offline - cache não será atualizado agora');
          return;
        }

        const status = await OfflineCache.isReady();

        // Se não está pronto ou está desatualizado (mais de 60 min)
        if (!status.ready || await OfflineCache.isStale(60)) {
          console.log('🔄 Preparando cache offline em background...');

          // Prepara em background sem bloquear UI.
          // Lê equipe/repre do AsyncStorage para filtrar clients e evitar baixar 20k registros.
          const [equipeStr, repreStr] = await Promise.all([
            AsyncStorage.getItem('selectedTeamCode'),
            AsyncStorage.getItem('representativeCodeToStore'),
          ]);
          const clientFilters: Record<string, Record<string, string | number>> =
            equipeStr && repreStr
              ? { clients: { equipe: Number(equipeStr), repre: repreStr } }
              : {};

          OfflineCache.prepare(
            ['teams', 'products', 'clients', 'brands', 'users', 'pedidos', 'prazos', 'relacao_prazo'],
            clientFilters
          ).then(result => {
            if (result.success) {
              console.log('✅ Cache offline preparado automaticamente!');
            } else {
              console.warn('⚠️ Preparação do cache teve alguns erros:', result.errors);
            }
          }).catch(err => {
            console.error('❌ Erro ao preparar cache:', err);
          });
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
      {Platform.OS === 'web' && <InstallPWABanner />}
      {Platform.OS === 'web' && <OfflineIndicator />}
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