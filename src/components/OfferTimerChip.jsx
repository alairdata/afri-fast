import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, Modal, Platform, Animated, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dc } from '../lib/theme';
import { useSubscription, loadIntroOffer } from '../lib/subscription';
import { getOfferDeadline, onOfferDeadline } from '../lib/offerTimer';
import { OfferScreen } from './PreAuthOnboarding';

const pad = (n) => String(n).padStart(2, '0');

// A small dot that keeps pulsing, so the countdown reads as live.
function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: dc('#10B981', 'bg'),
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dc('#059669', 'bg') }} />
    </View>
  );
}

// Top-left of the Today gauge: the first-month offer's time left. Tapping it opens the offer again. Shown only
// on iPhone, while the account's two hours last, before they're on Pro and while Apple still offers this Apple
// ID the intro price. Gone for good once the time runs out.
export default function OfferTimerChip({ userId, name, style }) {
  const { isPro, ready } = useSubscription();
  const [deadline, setDeadline] = useState(null);
  const [offer, setOffer] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !userId) return undefined;
    let alive = true;
    getOfferDeadline(userId).then((d) => { if (alive && d) setDeadline(d); });
    const stop = onOfferDeadline((d) => setDeadline(d));
    return () => { alive = false; stop(); };
  }, [userId]);

  const live = !!deadline && deadline > now && ready && !isPro;
  useEffect(() => {
    if (!live || offer) return;
    loadIntroOffer().then((o) => setOffer(o)).catch(() => {});
  }, [live]);
  useEffect(() => {
    if (!live) return undefined;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [live]);

  if (!live || !offer) return null;
  const left = Math.floor((deadline - now) / 1000);
  const time = `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Your gift offer, ${time} left`}
        style={[{
          position: 'absolute', top: 10, left: 10, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: dc('#ECFDF5', 'bg'),
          borderWidth: 1, borderColor: dc('rgba(5,150,105,0.25)', 'border'),
        }, style]}
      >
        <LiveDot />
        <Ionicons name="gift" size={13} color={dc('#059669', 'text')} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: dc('#047857', 'text'), fontVariant: ['tabular-nums'] }}>{time}</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        <OfferScreen d={{ name: name || '' }} offer={offer} deadline={deadline} reason="today_offer_timer" onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
