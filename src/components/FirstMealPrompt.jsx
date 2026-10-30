import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { dc, themedStyles } from '../lib/theme';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK600 = '#4b5a52';
const GREEN = '#059669';

const Sparkle = ({ size, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={[{ position: 'absolute' }, style]}>
    <Path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill={dc("#34D399", 'bg')} />
  </Svg>
);

const WAYS = [
  { method: 'scan',  label: 'Snap', icon: 'camera-outline' },
  { method: 'write', label: 'Type', icon: 'create-outline' },
];

// Right after sign-up: Lumi asks for the first meal, with the ways to log it.
export default function FirstMealPrompt({ visible, name, onPick, onLater }) {
  const first = name ? String(name).trim().split(' ')[0] : '';
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onLater}>
      <View style={st.page}>
        <View style={st.mid}>
          <View style={{ width: 280, alignItems: 'center' }}>
            <Sparkle size={18} style={{ left: '6%', top: '12%' }} />
            <Sparkle size={14} style={{ left: '86%', top: '6%' }} />
            <Sparkle size={16} style={{ left: '90%', top: '58%' }} />
            <Sparkle size={12} style={{ left: '2%', top: '64%' }} />
            <Image source={require('../../assets/lumi/lumi-food.png')} style={{ width: 220, height: 240 }} resizeMode="contain" accessibilityLabel="Lumi" />
          </View>
          <Text style={st.eyebrow}>YOUR FIRST LOG</Text>
          <Text style={st.title}>What did you eat last{first ? `, ${first}` : ''}?</Text>
          <Text style={st.sub}>Log it and watch your day fill up.</Text>
          <View style={st.row}>
            {WAYS.map((w) => (
              <TouchableOpacity key={w.method} style={st.tile} onPress={() => onPick(w.method)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${w.label} your meal`}>
                <View style={st.tileIcon}><Ionicons name={w.icon} size={26} color={dc(GREEN, 'text')} /></View>
                <Text style={st.tileTxt}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={st.later} onPress={onLater} accessibilityRole="button">
          <Text style={st.laterTxt}>I'll do it later</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const st = themedStyles({
  page: { flex: 1, backgroundColor: '#F7F8F5', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: Platform.OS === 'ios' ? 34 : 22 },
  mid: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { marginTop: 12, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: GREEN },
  title: { marginTop: 8, fontSize: 28, lineHeight: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, color: INK },
  sub: { marginTop: 8, fontSize: 15, lineHeight: 22, color: INK600, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, marginTop: 26, alignSelf: 'stretch' },
  tile: {
    flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 20, backgroundColor: '#fff',
    shadowColor: '#0B3D2E', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6F8EF', alignItems: 'center', justifyContent: 'center' },
  tileTxt: { marginTop: 10, fontSize: 15, fontWeight: '800', color: INK },
  later: { height: 48, alignItems: 'center', justifyContent: 'center' },
  laterTxt: { fontSize: 15, fontWeight: '700', color: INK500 },
});
