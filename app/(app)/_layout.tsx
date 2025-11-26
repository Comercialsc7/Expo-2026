import 'text-encoding';

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Sidebar } from '../../components/shared/Sidebar';
import { useAuth } from '../../hooks/useAuth';

export default function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  const menuItems = [
    {
      title: 'Pedidos',
      route: '/(app)/orders',
    },
    {
      title: 'Clientes',
      route: '/create-order/select-client',
    },
    {
      title: 'Produtos',
      route: '/products',
    },
    {
      title: 'Sair',
      route: '/',
      color: '#FF3B30',
    },
  ];

  const handleNavigate = (route: string) => {
    if (route === '/') {
      logout();
    } else {
      router.push(route);
    }
  };

  return (
    <View style={styles.container}>
      <Stack screenOptions={{
        headerShown: false,
      }}>
        <Stack.Screen name="orders" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={handleNavigate}
        menuItems={menuItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  menuButton: {
    fontSize: 24,
    color: '#003B71',
    paddingHorizontal: 16,
  },
});