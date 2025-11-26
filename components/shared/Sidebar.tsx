import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { router } from 'expo-router';

export interface MenuItem {
  title: string;
  route: string;
  color?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  menuItems: MenuItem[];
  width?: number;
}

const DEFAULT_WIDTH = 280;

export function Sidebar({ 
  isOpen, 
  onClose, 
  onNavigate,
  menuItems,
  width = DEFAULT_WIDTH 
}: SidebarProps) {
  const translateX = useSharedValue(-width);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
    } else {
      translateX.value = withSpring(-width, {
        damping: 20,
        stiffness: 90,
      });
    }
  }, [isOpen, width]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    zIndex: 1000,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 0.5 : 0),
    zIndex: isOpen ? 999 : -1,
  }));

  const filteredMenuItems = menuItems.filter(item => item.title !== 'Sair');
  const sairItem = menuItems.find(item => item.title === 'Sair');

  const handleNavigation = (route: string) => {
    onNavigate(route);
    onClose();
  };

  return (
    <>
      <Animated.View 
        style={[styles.overlay, overlayStyle]} 
        onTouchEnd={onClose}
      />
      <Animated.View style={[styles.sidebar, sidebarStyle, { width }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          {filteredMenuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => handleNavigation(item.route)}
            >
              <Text style={[
                styles.menuText,
                item.color && { color: item.color }
              ]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {sairItem && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => handleNavigation(sairItem.route)}
          >
            <Text style={[styles.menuText, { color: sairItem.color || '#FF3B30' }]}>Sair</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.25)',
      }
    }),
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#003B71',
  },
  menu: {
    padding: 16,
    paddingBottom: 80,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 16,
    color: '#003B71',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
}); 