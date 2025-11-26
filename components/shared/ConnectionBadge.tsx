import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { Wifi, WifiOff } from 'lucide-react-native';

export function ConnectionBadge() {
  const isOnline = useOnlineStatus();

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.badge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
      {isOnline ? (
        <Wifi color="#FFFFFF" size={12} />
      ) : (
        <WifiOff color="#FFFFFF" size={12} />
      )}
      <Text style={styles.text}>{isOnline ? 'Online' : 'Offline'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  onlineBadge: {
    backgroundColor: '#4CAF50',
  },
  offlineBadge: {
    backgroundColor: '#FF6B6B',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
