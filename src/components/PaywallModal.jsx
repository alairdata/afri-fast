import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Platform, Linking, ActivityIndicator, Alert } from 'react-native';
import { setPaywallPresenter, loadPlans, purchasePlan, restorePurchases, getSubscription } from '../lib/subscription';
import { track, EVENTS } from '../lib/analytics';
import ProFeatureCarousel from './ProFeatureCarousel';
import { showAlert } from '../lib/alert';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const GREEN = '#059669';
const GREEN_DARK = '#047857';
const LINE = '#e6e8e3';

// Why the screen opened, so the copy matches what the person just tried to do.
const HEADLINES = {
  meal_limit: ["You've logged 2 meals today", 'Free includes 2 meal logs a day. Go Pro to log every meal, snack and drink.'],
  forecast: ['See your full forecast', 'Your 7- and 14-day weight forecast, goal date and what is driving it.'],
  burnout: ['Know before you burn out', 'See your burnout likelihood, what is pushing it up and when you might feel worn out.'],
  calories: ['Understand what you eat', 'Your full calorie and macro analysis, including fibre, sugar and sodium.'],
  macros: ['Go deeper than calories', 'Fibre, sugar and sodium, and which meals bring the most of each.'],
  recipe: ['Unlock every recipe', 'Every recipe in every section, with calories and macros for each.'],
  recipe_photo: ['Cook with what you have', 'Snap your ingredients and Logga builds recipes around them.'],
  jfy: ['More insights, every day', 'Three more personal insights written from your own logs, fresh every day.'],
  jfy_refresh: ['Fresh insights any time', 'Refresh your insights whenever you like, written again from your latest logs.'],
};
const DEFAULT_HEADLINE = ['Get more from Logga', 'Unlimited logging, deeper insights and every recipe.'];

const BENEFITS = [
  'Unlimited meal logging',
  'Full weight forecast',
  'Cook with what you have',
  '4 daily insights',
  'Fibre, sugar & sodium',
  'Every recipe',
];

// Real quotes from people who used Pro before launch (with their permission). No star ratings: they gave words, not stars.
const TESTIMONIALS = [
  { quote: 'To be honest, Pro changed how I see my relationship with food.', by: 'Abena' },
  { quote: 'Best decision ever!', by: 'Samuel' },
];

const openUrl = (url) => Linking.openURL(url).catch(() => {});

const fmtMoney = (amount, currency) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch (_) { return null; }
};

// "72 kg by 14 March" from the person's own goal, if they have a dated weight goal.
const goalLine = (goal) => {
  if (!goal || goal.targetWeight == null || !goal.goalDate) return null;
  const date = new Date(`${goal.goalDate}T12:00:00`);
  if (isNaN(date.getTime()) || date.getTime() < Date.now()) return null;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const when = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  const w = Math.round(parseFloat(goal.targetWeight) * 10) / 10;
  if (!isFinite(w)) return null;
  return { weight: `${w % 1 === 0 ? w.toFixed(0) : w} ${goal.weightUnit || 'kg'}`, when };
};

const PaywallModal = ({ goal }) => {
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
  const [reasonTitle, reasonSub] = HEADLINES[reason] || DEFAULT_HEADLINE;
  const target = goalLine(goal);
  const canPurchase = getSubscription().canPurchase;
  const yearly = plans?.yearly;
  const monthly = plans?.monthly;
  const selected = choice === 'yearly' ? yearly : monthly;
  const trial = choice === 'yearly' ? !!plans?.trialYearly : !!plans?.trialMonthly;
  const yp = yearly?.product;
  const mp = monthly?.product;
  // A true comparison only: 12 months at the monthly price, crossed out next to the yearly price.
  const twelveMonthly = yp && mp && mp.price * 12 > yp.price ? fmtMoney(mp.price * 12, mp.currencyCode) : null;
  const yearlyPerMonth = yp ? fmtMoney(Math.floor((yp.price / 12) * 100) / 100, yp.currencyCode) : null;

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
      showAlert("Couldn't complete the purchase", 'Nothing was charged. Please try again in a moment.');
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
      if (found) { setVisible(false); showAlert('Welcome back', 'Your Logga Pro subscription is active again.'); }
      else showAlert('No subscription found', "We couldn't find a Logga Pro subscription on this Apple ID.");
    } catch (_) {
      showAlert("Couldn't restore", 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const terms = selected
    ? (trial
      ? `Free for 7 days, then ${selected.product.priceString} a ${choice === 'yearly' ? 'year' : 'month'}. `
      : `${selected.product.priceString} a ${choice === 'yearly' ? 'year' : 'month'}. `)
      + 'Payment is charged to your Apple ID. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period'
      + (trial ? ' or free trial' : '')
      + '. Manage or cancel any time in your Apple ID settings.'
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={close}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header: the same feature cards as the Pro screen in onboarding */}
          <View style={styles.hero}>
            <ProFeatureCarousel />
          </View>

          <View style={styles.body}>
            {target ? (
              <Text style={styles.title}>
                We'll help you reach <Text style={styles.titleAccent}>{target.weight}</Text> by <Text style={styles.titleAccent}>{target.when}</Text>!
              </Text>
            ) : (
              <Text style={styles.title}>{reasonTitle}</Text>
            )}
            <Text style={styles.sub}>{target && reason ? `${reasonTitle}. ${reasonSub}` : reasonSub}</Text>

            {!canPurchase ? (
              <Text style={styles.small}>Logga Pro is available in the Logga iPhone app.</Text>
            ) : loading ? (
              <ActivityIndicator color={GREEN} style={{ marginTop: 28 }} />
            ) : !plans ? (
              <Text style={styles.small}>Plans couldn't load right now. Check your connection and try again.</Text>
            ) : (
              <View style={styles.planRow}>
                {yearly && (
                  <TouchableOpacity
                    style={[styles.plan, choice === 'yearly' && styles.planOn]}
                    onPress={() => setChoice('yearly')}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: choice === 'yearly' }}
                  >
                    <View style={styles.badge}><Text style={styles.badgeTxt}>BEST VALUE</Text></View>
                    <Text style={styles.planTitle}>12 months</Text>
                    {twelveMonthly ? <Text style={styles.strike}>{twelveMonthly}</Text> : <Text style={styles.strike}> </Text>}
                    <Text style={styles.planPrice}>{yp.priceString}</Text>
                    {yearlyPerMonth ? <Text style={styles.planPer}>{yearlyPerMonth}/mo</Text> : null}
                    {plans.trialYearly ? <View style={styles.trialChip}><Text style={styles.trialTxt}>7 days free</Text></View> : null}
                  </TouchableOpacity>
                )}
                {monthly && (
                  <TouchableOpacity
                    style={[styles.plan, choice === 'monthly' && styles.planOn]}
                    onPress={() => setChoice('monthly')}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: choice === 'monthly' }}
                  >
                    <Text style={styles.planTitle}>1 month</Text>
                    <Text style={styles.strike}> </Text>
                    <Text style={styles.planPrice}>{mp.priceString}</Text>
                    <Text style={styles.planPer}>billed monthly</Text>
                    {plans.trialMonthly ? <View style={styles.trialChip}><Text style={styles.trialTxt}>7 days free</Text></View> : null}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* What people said */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 22, marginHorizontal: -22 }} contentContainerStyle={{ paddingHorizontal: 22, gap: 10 }}>
              {TESTIMONIALS.map((t) => (
                <View key={t.quote} style={styles.quoteCard}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={GREEN} />
                  <Text style={styles.quoteTxt}>“{t.quote}”</Text>
                  <Text style={styles.quoteBy}>— {t.by}</Text>
                </View>
              ))}
            </ScrollView>

            {/* What Pro unlocks */}
            <View style={styles.benefits}>
              {BENEFITS.map((b) => (
                <View key={b} style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                  <Text style={styles.benefitTxt}>{b}</Text>
                </View>
              ))}
            </View>

            {terms ? <Text style={styles.terms}>{terms}</Text> : null}
            <View style={styles.links}>
              {canPurchase && <Text style={styles.linkTxt} onPress={restore}>Restore purchases</Text>}
              <Text style={styles.linkTxt} onPress={() => openUrl('https://www.logga.space/terms')}>Terms of Use</Text>
              <Text style={styles.linkTxt} onPress={() => openUrl('https://www.logga.space/privacy')}>Privacy Policy</Text>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color={INK} />
        </TouchableOpacity>

        {canPurchase && plans && selected && (
          <View style={styles.footer}>
            <Text style={styles.cancelAny}>{trial ? `7 days free, then ${selected.product.priceString}/${choice === 'yearly' ? 'year' : 'month'} · ` : ''}Cancel anytime</Text>
            <TouchableOpacity style={[styles.cta, busy && { opacity: 0.6 }]} onPress={buy} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{trial ? 'Start my free week' : 'Continue'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  hero: { paddingTop: Platform.OS === 'android' ? 84 : 60 },
  closeBtn: { position: 'absolute', top: Platform.OS === 'android' ? 44 : 14, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 22, paddingTop: 22, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '800', color: INK, letterSpacing: -0.5, lineHeight: 31, textAlign: 'center' },
  titleAccent: { color: GREEN },
  sub: { fontSize: 14.5, lineHeight: 21, color: INK500, marginTop: 8, textAlign: 'center' },
  planRow: { flexDirection: 'row', gap: 12, marginTop: 22 },
  plan: { flex: 1, alignItems: 'center', paddingHorizontal: 12, paddingTop: 20, paddingBottom: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: LINE },
  planOn: { borderColor: GREEN, borderWidth: 2.5, backgroundColor: '#F2FBF6' },
  badge: { position: 'absolute', top: -11, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: GREEN },
  badgeTxt: { fontSize: 10.5, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
  planTitle: { fontSize: 15, fontWeight: '800', color: INK },
  planPrice: { fontSize: 22, fontWeight: '800', color: INK, marginTop: 2 },
  planPer: { fontSize: 12.5, color: INK500, fontWeight: '600', marginTop: 2 },
  planPrices: { fontSize: 13.5, color: INK500, marginTop: 3, fontWeight: '600' },
  strike: { textDecorationLine: 'line-through', color: INK400, fontWeight: '500', fontSize: 13, marginTop: 6 },
  trialChip: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(5,150,105,0.12)' },
  trialTxt: { fontSize: 11.5, fontWeight: '800', color: GREEN_DARK },
  perMonth: { fontSize: 19, fontWeight: '800', color: INK },
  perMonthUnit: { fontSize: 13, fontWeight: '600', color: INK500 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 22, rowGap: 10 },
  benefit: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  benefitTxt: { fontSize: 13.5, color: INK, fontWeight: '600', flexShrink: 1 },
  quoteCard: { width: 230, padding: 14, borderRadius: 16, backgroundColor: '#F6F8F5', borderWidth: 1, borderColor: LINE },
  quoteTxt: { fontSize: 14, lineHeight: 20, color: INK, fontWeight: '600', marginTop: 6 },
  quoteBy: { fontSize: 12.5, color: INK500, marginTop: 8, fontWeight: '600' },
  small: { fontSize: 13.5, lineHeight: 19, color: INK500, marginTop: 22, textAlign: 'center' },
  terms: { fontSize: 11, lineHeight: 16, color: INK400, marginTop: 20 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 12 },
  linkTxt: { fontSize: 12.5, fontWeight: '700', color: INK500, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#fff' },
  cancelAny: { fontSize: 12.5, color: INK500, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  cta: { height: 56, borderRadius: 999, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});

export default PaywallModal;
