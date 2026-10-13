import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform, Linking, ActivityIndicator, Alert } from 'react-native';
import { setPaywallPresenter, loadPlans, purchasePlan, restorePurchases, getSubscription } from '../lib/subscription';
import { track, EVENTS } from '../lib/analytics';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const GREEN = '#059669';
const LINE = '#e9e9e1';

// Why the screen opened, so the headline matches what the person just tried to do.
const HEADLINES = {
  meal_limit: ["You've logged 2 meals today", 'Free includes 2 meal logs a day. Go Pro to log every meal, snack and drink.'],
  forecast: ['See your full forecast', 'Your 7- and 14-day weight forecast, goal date and what is driving it.'],
  burnout: ['Know before you burn out', 'See your burnout likelihood, what is pushing it up and when you might feel worn out.'],
  calories: ['Understand what you eat', 'Your full calorie and macro analysis, including fibre, sugar and sodium.'],
  macros: ['Go deeper than calories', 'Fibre, sugar and sodium, and which meals bring the most of each.'],
  recipe: ['Unlock every recipe', 'Every recipe in every section, with calories and macros for each.'],
  recipe_photo: ['Cook with what you have', 'Snap your ingredients and Logga builds recipes around them.'],
  jfy: ['More insights, every day', 'Three more personal insights written from your own logs, fresh every day.'],
};
const DEFAULT_HEADLINE = ['Get more from Logga', 'Unlimited logging, deeper insights and every recipe.'];

const BENEFITS = [
  ['infinite-outline', 'Unlimited meal logging', 'Log every meal, snack and drink, any way you like'],
  ['trending-down-outline', 'Full weight forecast', 'Your 7- and 14-day forecast and goal date'],
  ['flame-outline', 'Burnout risk analysis', 'Spot a hard stretch before it knocks you off track'],
  ['bulb-outline', '4 daily insights', 'Three more personal insights every day, not just one'],
  ['nutrition-outline', 'Advanced nutrition', 'Calorie analysis plus fibre, sugar and sodium'],
  ['restaurant-outline', 'Every recipe', 'All recipes, and recipes from a photo of your ingredients'],
];

const openUrl = (url) => Linking.openURL(url).catch(() => {});

const monthlyEquivalent = (pkg) => {
  const p = pkg?.product;
  if (!p?.price) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currencyCode }).format(Math.floor((p.price / 12) * 100) / 100);
  } catch (_) { return null; }
};

const PaywallModal = () => {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState(null);
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState('yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPaywallPresenter((r) => {
      setReason(r || null);
      setChoice('yearly');
      setVisible(true);
      track(EVENTS.PAYWALL_VIEWED, { reason: r || 'unknown' });
    });
    return () => setPaywallPresenter(null);
  }, []);

  useEffect(() => {
    if (!visible || plans) return;
    if (!getSubscription().canPurchase) return;
    setLoading(true);
    loadPlans().then(setPlans).catch(() => setPlans(null)).finally(() => setLoading(false));
  }, [visible]);

  const close = () => { if (!busy) setVisible(false); };
  const [headline, sub] = HEADLINES[reason] || DEFAULT_HEADLINE;
  const canPurchase = getSubscription().canPurchase;
  const yearly = plans?.yearly;
  const monthly = plans?.monthly;
  const selected = choice === 'yearly' ? yearly : monthly;
  const trial = choice === 'yearly' && plans?.trialEligible;
  const savePct = yearly?.product?.price && monthly?.product?.price
    ? Math.round((1 - yearly.product.price / (monthly.product.price * 12)) * 100) : null;

  const buy = async () => {
    if (!selected || busy) return;
    setBusy(true);
    track(EVENTS.PURCHASE_STARTED, { plan: choice, trial: !!trial, reason: reason || 'unknown' });
    try {
      const result = await purchasePlan(selected);
      if (result === 'purchased') {
        track(EVENTS.SUBSCRIBED, { plan: choice, trial: !!trial, reason: reason || 'unknown' });
        setVisible(false);
      } else {
        track(EVENTS.PURCHASE_CANCELLED, { plan: choice });
      }
    } catch (e) {
      track(EVENTS.PURCHASE_FAILED, { plan: choice, message: String(e?.message || '').slice(0, 120) });
      Alert.alert("Couldn't complete the purchase", 'Nothing was charged. Please try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const found = await restorePurchases();
      track(EVENTS.PURCHASES_RESTORED, { found });
      if (found) { setVisible(false); Alert.alert('Welcome back', 'Your Logga Pro subscription is active again.'); }
      else Alert.alert('No subscription found', "We couldn't find a Logga Pro subscription on this Apple ID.");
    } catch (_) {
      Alert.alert("Couldn't restore", 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const PlanRow = ({ id, pkg, title, note, badge }) => {
    const on = choice === id;
    return (
      <TouchableOpacity style={[styles.plan, on && styles.planOn]} onPress={() => setChoice(id)} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: on }}>
        <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.planTitle}>{title}</Text>
            {badge ? <View style={styles.badge}><Text style={styles.badgeTxt}>{badge}</Text></View> : null}
          </View>
          {note ? <Text style={styles.planNote}>{note}</Text> : null}
        </View>
        <Text style={styles.planPrice}>{pkg?.product?.priceString || '--'}</Text>
      </TouchableOpacity>
    );
  };

  const yearlyNote = [
    plans?.trialEligible ? '7 days free, then billed yearly' : 'Billed yearly',
    monthlyEquivalent(yearly) ? `${monthlyEquivalent(yearly)}/month` : null,
  ].filter(Boolean).join(' · ');

  const terms = selected
    ? (trial
      ? `Free for 7 days, then ${selected.product.priceString} a year. `
      : `${selected.product.priceString} a ${choice === 'yearly' ? 'year' : 'month'}. `)
      + 'Payment is charged to your Apple ID. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period'
      + (trial ? ' or free trial' : '')
      + '. Manage or cancel any time in your Apple ID settings.'
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={close}>
      <View style={[styles.page, Platform.OS === 'android' && { paddingTop: 44 }]}>
        <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={INK} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.proPill}><Ionicons name="sparkles" size={13} color={GREEN} /><Text style={styles.proPillTxt}>LOGGA PRO</Text></View>
          <Text style={styles.title}>{headline}</Text>
          <Text style={styles.body}>{sub}</Text>

          <View style={styles.card}>
            {BENEFITS.map(([icon, t, d], i) => (
              <View key={t} style={[styles.benefit, i === BENEFITS.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.benefitIcon}><Ionicons name={icon} size={17} color={GREEN} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{t}</Text>
                  <Text style={styles.benefitSub}>{d}</Text>
                </View>
              </View>
            ))}
          </View>

          {!canPurchase ? (
            <Text style={styles.small}>Logga Pro is available in the Logga iPhone app.</Text>
          ) : loading ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
          ) : !plans ? (
            <Text style={styles.small}>Plans couldn't load right now. Check your connection and try again.</Text>
          ) : (
            <View style={{ marginTop: 18, gap: 10 }}>
              {yearly && <PlanRow id="yearly" pkg={yearly} title="Yearly" note={yearlyNote} badge={savePct > 0 ? `SAVE ${savePct}%` : null} />}
              {monthly && <PlanRow id="monthly" pkg={monthly} title="Monthly" note="Billed monthly" />}
            </View>
          )}

          {terms ? <Text style={styles.terms}>{terms}</Text> : null}
          <View style={styles.links}>
            {canPurchase && <Text style={styles.linkTxt} onPress={restore}>Restore purchases</Text>}
            <Text style={styles.linkTxt} onPress={() => openUrl('https://www.logga.space/terms')}>Terms of Use</Text>
            <Text style={styles.linkTxt} onPress={() => openUrl('https://www.logga.space/privacy')}>Privacy Policy</Text>
          </View>
        </ScrollView>
        {canPurchase && plans && selected && (
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.cta, busy && { opacity: 0.6 }]} onPress={buy} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{trial ? 'Start 7-day free trial' : 'Continue'}</Text>}
            </TouchableOpacity>
            <Text style={styles.ctaSub}>{trial ? `Then ${selected.product.priceString}/year · Cancel anytime` : 'Cancel anytime'}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  closeBtn: { position: 'absolute', top: Platform.OS === 'android' ? 50 : 14, right: 16, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 36, width: '100%', maxWidth: 560, alignSelf: 'center' },
  proPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(5,150,105,0.1)' },
  proPillTxt: { fontSize: 11.5, fontWeight: '800', color: GREEN, letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5, marginTop: 14 },
  body: { fontSize: 15, lineHeight: 22, color: INK500, marginTop: 8 },
  card: { marginTop: 18, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  benefitIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(5,150,105,0.08)', alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  benefitSub: { fontSize: 12.5, lineHeight: 17, color: INK500, marginTop: 1 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1.5, borderColor: LINE },
  planOn: { borderColor: GREEN, backgroundColor: 'rgba(5,150,105,0.04)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cfd6d2', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  planTitle: { fontSize: 16, fontWeight: '800', color: INK },
  planNote: { fontSize: 12.5, color: INK500, marginTop: 2 },
  planPrice: { fontSize: 16, fontWeight: '800', color: INK },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: GREEN },
  badgeTxt: { fontSize: 10.5, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  small: { fontSize: 13.5, lineHeight: 19, color: INK500, marginTop: 18, textAlign: 'center' },
  terms: { fontSize: 11.5, lineHeight: 16, color: INK400, marginTop: 16 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 14, marginBottom: 12 },
  linkTxt: { fontSize: 12.5, fontWeight: '700', color: INK500, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 22, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#F8FAFC' },
  cta: { height: 54, borderRadius: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaSub: { fontSize: 12, color: INK500, textAlign: 'center', marginTop: 8 },
});

export default PaywallModal;
