import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

const DOT_SIZE = 10;
const DOT_SPACING = 14;
const ANIMATION_DURATION = 500;
const STAGGER = 160;

function BouncingDots() {
  const anims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const makeLoop = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -10, duration: ANIMATION_DURATION, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,   duration: ANIMATION_DURATION, useNativeDriver: true }),
          Animated.delay(STAGGER * 2),
        ])
      );

    const loops = anims.map((a, i) => makeLoop(a, i * STAGGER));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={styles.dotsRow}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { transform: [{ translateY: anim }] }]}
        />
      ))}
    </View>
  );
}

export default function LoadingScreen() {
  return (
    <LinearGradient
      colors={['#0F2A5A', '#0A1A3C', '#07101F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Lane lines decoration */}
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.laneLine, { top: 80 + i * 60, opacity: 0.04 + i * 0.01 }]}
          pointerEvents="none"
        />
      ))}

      <View style={styles.content}>
        <Text style={styles.appName}>SWIMMY</Text>
        <Text style={styles.heading}>Building your plan</Text>
        <BouncingDots />
        <Text style={styles.sub}>Personalising 12 weeks of training{'\n'}just for you — this may take a minute.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneLine: {
    position: 'absolute',
    left: -20,
    right: -20,
    height: 1,
    backgroundColor: '#00A8E8',
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  appName: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 5,
    marginBottom: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DOT_SPACING,
    height: DOT_SIZE + 16,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#00A8E8',
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 4,
  },
});
