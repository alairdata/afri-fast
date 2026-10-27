import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

// Blend two #RRGGBB colours: t = 0 gives a, t = 1 gives b.
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// The soft mint fade at the top of a screen. It sits behind the content and melts into the page's own
// background over about 360px, so there's no visible edge. Light theme only. variant="sheet" is the
// lighter, shorter version for pop-up sheets. The app sits inside the safe area, so the fade starts above it
// (under the time and battery) and the green runs to the top of the screen instead of leaving a plain strip.
// Pass scrollY (from useHeaderFadeScroll) and the fade scrolls away with the page, so a scrolled screen is its
// own plain background up to the top edge instead of keeping a green band behind the content.
const HeaderFade = ({ bg, height, style, variant, scrollY }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  if (isDark) return null;
  const hex = (c) => {
    if (/^#[0-9a-f]{6}$/i.test(c || '')) return c;
    if (/^#[0-9a-f]{3}$/i.test(c || '')) return '#' + c.slice(1).split('').map((d) => d + d).join('');
    return null;
  };
  const base = hex(bg) || hex(colors.appBg) || '#F9FAFB';
  const sheet = variant === 'sheet';
  const total = (height || (sheet ? 260 : 360)) + insets.top;
  const gradient = (top) => (
    <LinearGradient
      pointerEvents="none"
      colors={sheet ? ['#DDF6E7', '#E9F8EF', mix('#E9F8EF', base, 0.55), base] : ['#CFF3DE', '#D9F5E4', '#E9F8EF', mix('#E9F8EF', base, 0.5), base]}
      locations={sheet ? [0, 0.23, 0.58, 1] : [0, 0.19, 0.42, 0.67, 1]}
      style={[styles.fade, { top, height: total }, style]}
    />
  );
  if (!scrollY) return gradient(-insets.top);
  const translateY = scrollY.interpolate({ inputRange: [0, total], outputRange: [0, -total], extrapolate: 'clamp' });
  return (
    <>
      {/* the strip under the status bar, in the page colour, for once the fade has scrolled off it */}
      <Animated.View pointerEvents="none" style={[styles.fade, { top: -insets.top, height: insets.top, backgroundColor: base }]} />
      <Animated.View pointerEvents="none" style={[styles.fade, { top: -insets.top, height: total, transform: [{ translateY }] }]}>
        {gradient(0)}
      </Animated.View>
    </>
  );
};

// Scroll tracking for a scrolling HeaderFade: spread onScroll and scrollEventThrottle onto the page's ScrollView
// and pass scrollY to HeaderFade. listener, if given, still gets every scroll event.
export const useHeaderFadeScroll = (listener) => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const listenerRef = useRef(listener);
  listenerRef.current = listener;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (e) => listenerRef.current && listenerRef.current(e),
  }), [scrollY]);
  return { scrollY, scrollProps: { onScroll, scrollEventThrottle: 16 } };
};

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
});

export default HeaderFade;
