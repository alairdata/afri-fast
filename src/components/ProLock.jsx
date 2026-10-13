import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { openPaywall } from '../lib/subscription';
import { track, EVENTS } from '../lib/analytics';

const GREEN = '#059669';

export const unlock = (reason) => {
  track(EVENTS.PRO_LOCK_TAPPED, { reason });
  openPaywall(reason);
};

// Body of a Pro-only card for Free users: what they'd see, and a button to the upgrade screen.
export const ProLockedBody = ({ reason, text, colors, style }) => (
  <TouchableOpacity style={[styles.body, { backgroundColor: colors?.cardAlt || 'rgba(5,150,105,0.05)' }, style]} onPress={() => unlock(reason)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${text}. Unlock with Logga Pro`}>
    <View style={styles.lockCircle}><Ionicons name="lock-closed" size={15} color={GREEN} /></View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.text, { color: colors?.text || '#16201b' }]}>{text}</Text>
      <Text style={styles.cta}>Unlock with Pro</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={GREEN} />
  </TouchableOpacity>
);

// Small "PRO" tag for headers and buttons.
export const ProTag = ({ style }) => (
  <View style={[styles.tag, style]}>
    <Ionicons name="lock-closed" size={9} color="#fff" />
    <Text style={styles.tagTxt}>PRO</Text>
  </View>
);

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 14, borderRadius: 14 },
  lockCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  cta: { fontSize: 12.5, fontWeight: '800', color: GREEN, marginTop: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: GREEN },
  tagTxt: { fontSize: 9.5, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
});
