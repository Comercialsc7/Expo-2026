import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Animated } from 'react-native';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react-native';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [showOnlineBadge, setShowOnlineBadge] = useState(false);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    if (isOnline && !showOnlineBadge) {
      // Mostra o badge "Online" por 3 segundos quando a conexão volta
      setShowOnlineBadge(true);

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2700),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowOnlineBadge(false);
      });
    }
  }, [isOnline]);

  if (Platform.OS !== 'web') {
    return null;
  }

  // Mostra offline persistente
  if (!isOnline) {
    return (
      <View style={[styles.container, styles.offlineContainer]}>
        <WifiOff color="#FFFFFF" size={16} />
        <Text style={styles.text}>Offline</Text>
        <View style={styles.badge}>
          <View style={[styles.dot, styles.offlineDot]} />
        </View>
      </View>
    );
  }

  // Mostra online temporariamente (3s)
  if (showOnlineBadge) {
    return (
      <Animated.View style={[styles.container, styles.onlineContainer, { opacity: fadeAnim }]}>
        <Wifi color="#FFFFFF" size={16} />
        <Text style={styles.text}>Online - Sincronizando...</Text>
        <View style={styles.badge}>
          <View style={[styles.dot, styles.onlineDot]} />
        </View>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  offlineContainer: {
    backgroundColor: '#FF6B6B',
  },
  onlineContainer: {
    backgroundColor: '#4CAF50',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    marginLeft: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  offlineDot: {
    opacity: 0.8,
  },
  onlineDot: {
    opacity: 1,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
