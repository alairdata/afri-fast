import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// What Pro unlocks, as edge-to-edge cards that slide on their own. Shared by the Pro screen at the end
// of onboarding and the in-app upgrade screen, so the two always match.
const FEATURES = [
  { t: 'See your forecast',  s: "Know when you'll hit your goal", img: require('../../assets/lumi/lumi-forecast.png'), bg: ['#E3F8EE', '#BDEBD4'] },
  { t: 'Log without limits', s: 'Every meal, every way',          img: require('../../assets/lumi/lumi-food.png'),     bg: ['#FFF3EA', '#FFDCC6'] },
  { t: 'Every recipe',       s: 'All local recipes unlocked',     img: require('../../assets/lumi/lumi-elder.png'),    bg: ['#F3EFFF', '#DCD1FF'] },
  { t: 'Deeper insights',    s: 'Fibre, sugar, sodium and more',  img: require('../../assets/lumi/lumi-think.png'),    bg: ['#EAF5FF', '#CBE4FF'] },
];

// Each card holds long enough to be read in full before the next slides in.
const HOLD_MS = 4000;

export default function ProFeatureCarousel() {
  const { width: W } = useWindowDimensions();
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const iv = setInterval(() => {
      cur.current = (cur.current + 1) % FEATURES.length;
      ref.current?.scrollTo({ x: cur.current * W, animated: true });
      setI(cur.current);
    }, HOLD_MS);
    return () => clearInterval(iv);
  }, [W]);
  return (
    <View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{ width: W }}>
        {FEATURES.map((f) => (
          <LinearGradient key={f.t} colors={f.bg} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={[st.card, { width: W }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{f.t}</Text>
              <Text style={st.sub}>{f.s}</Text>
            </View>
            <Image source={f.img} style={st.lumi} resizeMode="contain" accessibilityLabel="" />
          </LinearGradient>
        ))}
      </ScrollView>
      <View style={st.dots}>
        {FEATURES.map((f, k) => <View key={f.t} style={[st.dot, k === i && st.dotOn]} />)}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { height: 210, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 6 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: '#16201b' },
  sub: { marginTop: 6, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#4b5a52' },
  lumi: { width: 170, height: 196, alignSelf: 'flex-end' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(5,150,105,0.3)' },
  dotOn: { width: 18, backgroundColor: '#059669' },
});
