import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { themedStyles } from '../lib/theme';

// A photo that shows a pulsing grey placeholder until it has loaded, then fades in,
// so cards never sit empty and then pop. `style` sizes the box (same as an <Image> style).
const ShimmerImage = ({ uri, style, resizeMode = 'cover', onError }) => {
  const [loaded, setLoaded] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loaded) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loaded]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const shimmerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return (
    <View style={[style, styles.box]}>
      {!loaded && <Animated.View style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: shimmerOpacity }]} />}
      <Animated.Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={onError}
      />
    </View>
  );
};

const styles = themedStyles({
  box: { overflow: 'hidden' },
  shimmer: { backgroundColor: '#D9D9D9' },
});

export default ShimmerImage;
