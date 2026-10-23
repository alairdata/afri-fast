import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lib/theme';

// Blend two #RRGGBB colours: t = 0 gives a, t = 1 gives b.
const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// The soft mint fade at the top of a screen. It sits behind the content and melts into the page's own
// background over about 360px, so there's no visible edge. Light theme only.
const HeaderFade = ({ bg, height = 360, style }) => {
  const { colors, isDark } = useTheme();
  if (isDark) return null;
  const base = /^#[0-9a-f]{6}$/i.test(bg || '') ? bg : (/^#[0-9a-f]{6}$/i.test(colors.appBg || '') ? colors.appBg : '#F9FAFB');
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['#CFF3DE', '#D9F5E4', '#E9F8EF', mix('#E9F8EF', base, 0.5), base]}
      locations={[0, 0.19, 0.42, 0.67, 1]}
      style={[styles.fade, { height }, style]}
    />
  );
};

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0 },
});

export default HeaderFade;
