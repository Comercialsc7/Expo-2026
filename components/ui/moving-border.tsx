import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface MovingBorderButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: any;
}

export function MovingBorderButton({ onPress, children, style }: MovingBorderButtonProps) {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.borderContainer}>
        <Animated.View style={[styles.gradientRing, animatedStyle]} />
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>{children}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 56,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  borderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#0088CC', // Primary blue
  },
  gradientRing: {
    position: 'absolute',
    width: '200%',
    height: '200%',
    left: '-50%',
    top: '-50%',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(45deg, #0088CC 0%, #00A3FF 25%, #0055FF 50%, #00A3FF 75%, #0088CC 100%)',
        opacity: 0.8,
      },
      default: {
        backgroundColor: '#00A3FF',
        opacity: 0.5,
      },
    }),
  },
  button: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    backgroundColor: '#0088CC',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
  },
});