import React, { useEffect, useRef, memo } from 'react';
import { Animated, View, Dimensions } from 'react-native';

const COLORS = ['#40c074','#1b4332','#FFD700','#FF6B6B','#4FC3F7','#FF8A65','#CE93D8','#80CBC4','#ffffff','#059669'];
const { width: W, height: H } = Dimensions.get('window');
const COUNT = 62;

const Particle = memo(({ color, startX, drift, size, duration, delay, round }) => {
  const ty = useRef(new Animated.Value(-40)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const endRot = useRef(`${(Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1) * 360}deg`).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(ty, { toValue: H + 60, duration, useNativeDriver: true }),
        Animated.timing(tx, { toValue: drift, duration, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(duration * 0.5),
          Animated.timing(op, { toValue: 0, duration: duration * 0.5, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: startX,
        width: size,
        height: round ? size : size * 0.55,
        backgroundColor: color,
        borderRadius: round ? size / 2 : 2,
        opacity: op,
        transform: [
          { translateY: ty },
          { translateX: tx },
          { rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', endRot] }) },
        ],
      }}
    />
  );
});

const Confetti = ({ onDone }) => {
  const particles = useRef(
    Array.from({ length: COUNT }, () => ({
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      startX: Math.random() * W,
      drift: (Math.random() - 0.5) * 220,
      size: Math.random() * 9 + 5,
      duration: Math.random() * 1000 + 1500,
      delay: Math.random() * 500,
      round: Math.random() > 0.5,
    }))
  ).current;

  useEffect(() => {
    const maxTime = Math.max(...particles.map(p => p.delay + p.duration)) + 200;
    const timer = setTimeout(onDone, maxTime);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} pointerEvents="none">
      {particles.map((p, i) => <Particle key={i} {...p} />)}
    </View>
  );
};

export default Confetti;
