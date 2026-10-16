import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfferScreen, WidgetScreen, WidgetStepsScreen } from './PreAuthOnboarding';
import { getSubscription, onSubscriptionChange, loadIntroOffer } from '../lib/subscription';

// People who signed up before the offer and widget screens were part of onboarding see them once, just
// in case: the first-month offer (only when they aren't on Pro and Apple says this Apple ID can still get
// the intro price), then the home screen widget. New accounts already saw both during onboarding, so
// they're marked done straight away. iOS only, like the screens themselves.
const OFFER_WINDOW_MS = 2 * 60 * 60 * 1000;
const keyFor = (userId) => `logga_catchup_v1_${userId}`;

export default function CatchUpPrompts({ userId, name, kcal, newUser, busy }) {
  const [step, setStep] = useState(null); // 'offer' | 'widget' | 'steps' | null
  const [offer, setOffer] = useState(null);
  const [deadline, setDeadline] = useState(0);
  const checked = useRef(false);

  // A brand-new account just went through onboarding: nothing to catch up on.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !userId || !newUser) return;
    checked.current = true;
    AsyncStorage.setItem(keyFor(userId), '1').catch(() => {});
  }, [userId, newUser]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !userId || newUser || busy || checked.current) return undefined;
    // Let the app settle first, so this never lands on top of the first screens.
    const t = setTimeout(async () => {
      if (checked.current) return;
      checked.current = true;
      const done = await AsyncStorage.getItem(keyFor(userId)).catch(() => '1');
      if (done) return;
      AsyncStorage.setItem(keyFor(userId), '1').catch(() => {});
      // Wait for RevenueCat to say whether this account is on Pro.
      if (!getSubscription().ready) {
        await new Promise((resolve) => {
          const stop = onSubscriptionChange((st) => { if (st.ready) { stop(); resolve(); } });
          setTimeout(() => { stop(); resolve(); }, 8000);
        });
      }
      let o = null;
      if (getSubscription().ready && !getSubscription().isPro) o = await loadIntroOffer().catch(() => null);
      if (o) { setOffer(o); setDeadline(Date.now() + OFFER_WINDOW_MS); setStep('offer'); } else setStep('widget');
    }, 4000);
    return () => clearTimeout(t);
  }, [userId, newUser, busy]);

  if (!step) return null;
  const d = { name: name || '' };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setStep(null)}>
      {step === 'offer' && offer ? (
        <OfferScreen d={d} offer={offer} deadline={deadline} reason="catchup_offer" onDone={() => setStep('widget')} />
      ) : step === 'widget' ? (
        <WidgetScreen d={d} kcal={kcal} onShow={() => setStep('steps')} onLater={() => setStep(null)} />
      ) : (
        <WidgetStepsScreen onBack={() => setStep('widget')} onDone={() => setStep(null)} />
      )}
    </Modal>
  );
}
