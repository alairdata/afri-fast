import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Rect, Defs, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { openPaywall } from '../lib/subscription';
import { track, EVENTS } from '../lib/analytics';
import { dc, themedStyles } from '../lib/theme';

const GREEN = '#059669';

export const unlock = (reason) => {
  track(EVENTS.PRO_LOCK_TAPPED, { reason });
  openPaywall(reason);
};

// Body of a Pro-only card for Free users: what they'd see, and a button to the upgrade screen.
export const ProLockedBody = ({ reason, text, colors, style }) => (
  <TouchableOpacity style={[styles.body, { backgroundColor: colors?.cardAlt || dc('rgba(5,150,105,0.05)', 'bg') }, style]} onPress={() => unlock(reason)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${text}. Unlock with Logga Pro`}>
    <View style={styles.lockCircle}><Ionicons name="lock-closed" size={15} color={dc(GREEN, 'text')} /></View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.text, { color: colors?.text || dc('#16201b', 'text') }]}>{text}</Text>
      <Text style={styles.cta}>Unlock with Pro</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={dc(GREEN, 'text')} />
  </TouchableOpacity>
);

// Free plan: a made-up chart (not the person's data) drawn behind a blur, with "Unlock with Pro" on top.
// kind 'line' = a smooth, dramatic forecast line; 'bars' = zig-zagging burnout bars.
const FAKE_LINE = [62, 44, 58, 34, 50, 24, 40, 18, 30, 12, 22];
const FAKE_BARS = [
  [34, '#34D399'], [58, '#F59E0B'], [42, '#34D399'], [76, '#EA580C'], [50, '#F59E0B'], [86, '#EF4444'], [62, '#F59E0B'],
];

const smoothPath = (pts) => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
};

export const LockedChartPreview = ({ reason, kind = 'line', caption, height = 150 }) => {
  const W = 300;
  const H = 120;
  const line = FAKE_LINE.map((v, i) => [(i / (FAKE_LINE.length - 1)) * W, 10 + (v / 70) * (H - 20)]);
  const path = smoothPath(line);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => unlock(reason)} style={[styles.preview, { height }]} accessibilityRole="button" accessibilityLabel="Unlock with Logga Pro">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {kind === 'line' ? (
          <>
            <Defs>
              <SvgGradient id="fakeFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={dc("#10B981", 'bg')} stopOpacity="0.35" />
                <Stop offset="1" stopColor={dc("#10B981", 'bg')} stopOpacity="0" />
              </SvgGradient>
            </Defs>
            <Path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#fakeFill)" />
            <Path d={path} stroke={dc("#059669", 'border')} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          </>
        ) : (
          FAKE_BARS.map(([v, c], i) => {
            const bw = W / FAKE_BARS.length * 0.55;
            const x = (i + 0.225) * (W / FAKE_BARS.length);
            const h = (v / 100) * (H - 10);
            return <Rect key={i} x={x} y={H - h} width={bw} height={h} rx={6} fill={c} />;
          })
        )}
      </Svg>
      <BlurView intensity={Platform.OS === 'android' ? 30 : 14} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.previewOverlay} pointerEvents="none">
        <View style={styles.unlockPill}>
          <Ionicons name="lock-closed" size={13} color={dc(GREEN, 'text')} />
          <Text style={styles.unlockTxt}>Unlock with Pro</Text>
        </View>
        {caption ? <Text style={styles.previewCaption}>{caption}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

// Small "PRO" tag for headers and buttons.
export const ProTag = ({ style }) => (
  <View style={[styles.tag, style]}>
    <Ionicons name="lock-closed" size={9} color={dc("#fff", 'text')} />
    <Text style={styles.tagTxt}>PRO</Text>
  </View>
);

const styles = themedStyles({
  preview: { marginTop: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(5,150,105,0.04)' },
  previewOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  unlockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff',
    shadowColor: '#0B3D2E', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  unlockTxt: { fontSize: 14, fontWeight: '800', color: GREEN },
  previewCaption: { fontSize: 12.5, lineHeight: 17, color: '#16201b', fontWeight: '600', textAlign: 'center', marginTop: 8, opacity: 0.8 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 14 },
  lockCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  cta: { fontSize: 12.5, fontWeight: '800', color: GREEN, marginTop: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: GREEN },
  tagTxt: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
});
