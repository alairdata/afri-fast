// Logga Pro through Apple in-app purchase, managed by RevenueCat (entitlement 'logga_pro', offering 'default'
// with a Monthly and an Annual package; the yearly product carries the 7-day free trial).
// Only iOS can buy, so the Free/Pro split only applies there: on web and Android (no way to pay yet)
// everything stays unlocked.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// RevenueCat public SDK key for the App Store app (public by design; safe to ship in the app).
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || 'appl_vZinLvIPrzgYbpiLBwZItkfHBHV';
export const ENTITLEMENT = 'logga_pro';
export const FREE_MEALS_PER_DAY = 2;
const CACHE_KEY = 'logga_is_pro_v1';

let Purchases = null;
let configured = false;
// EXPO_PUBLIC_PREVIEW_FREE=1 (development only) shows the Free plan's locks anywhere, e.g. on web, to preview them.
const PREVIEW_FREE = __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_FREE === '1';
const GATED = (Platform.OS === 'ios' && !!IOS_KEY) || PREVIEW_FREE;
let state = { isPro: !GATED, ready: false, canPurchase: false, expiresAt: null, willRenew: false, inTrial: false, managementURL: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (_) {} });
const setState = (patch) => { state = { ...state, ...patch }; emit(); };

export const getSubscription = () => state;
export const isPro = () => state.isPro;
export const onSubscriptionChange = (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

const applyCustomerInfo = (info) => {
  const ent = info?.entitlements?.active?.[ENTITLEMENT];
  const pro = !!ent || !GATED;
  setState({
    isPro: pro,
    ready: true,
    expiresAt: ent?.expirationDate || null,
    willRenew: !!ent?.willRenew,
    inTrial: ent?.periodType === 'TRIAL',
    managementURL: info?.managementURL || null,
  });
  AsyncStorage.setItem(CACHE_KEY, pro ? '1' : '0').catch(() => {});
};

// Call once a person is signed in, with their Supabase user id, so purchases follow the account.
export async function initSubscriptions(userId) {
  if (!state.ready) {
    // Start from the last known status so Pro features don't flicker locked while offline.
    const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
    if (cached === '1') setState({ isPro: true });
  }
  if (Platform.OS !== 'ios' || !IOS_KEY) { setState({ ready: true, canPurchase: false }); return; }
  try {
    if (!Purchases) Purchases = require('react-native-purchases').default;
    if (!configured) {
      Purchases.configure({ apiKey: IOS_KEY, appUserID: userId || null });
      Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
      configured = true;
    } else if (userId) {
      await Purchases.logIn(userId);
    }
    setState({ canPurchase: true });
    applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch (e) {
    console.log('[Subscriptions] init failed', e?.message);
    setState({ ready: true });
  }
}

export async function signOutSubscriptions() {
  AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
  setState({ isPro: !GATED, expiresAt: null, willRenew: false, inTrial: false, managementURL: null });
  if (configured && Purchases) {
    try { if (!(await Purchases.isAnonymous())) await Purchases.logOut(); } catch (_) {}
  }
}

// The two plans with their App Store prices (localised by Apple) and whether the free trial applies.
export async function loadPlans() {
  if (!configured || !Purchases) return null;
  const offerings = await Purchases.getOfferings();
  const current = offerings?.current;
  if (!current) return null;
  const yearly = current.annual || current.availablePackages.find((p) => p.packageType === 'ANNUAL') || null;
  const monthly = current.monthly || current.availablePackages.find((p) => p.packageType === 'MONTHLY') || null;
  // Whether this Apple ID can still get each plan's free trial (only plans that have one in App Store Connect).
  const ids = [yearly, monthly].filter((p) => p?.product?.introPrice).map((p) => p.product.identifier);
  let elig = {};
  if (ids.length) {
    try { elig = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids); } catch (_) { elig = null; }
  }
  // 2 = eligible; 0 (unknown) counts as eligible, as Apple decides at purchase time.
  // Only a free intro (price 0) is a trial; a paid first month (the one-time $2.99 offer) never shows as '7 days free'.
  const canTrial = (p) => !!p?.product?.introPrice && p.product.introPrice.price === 0 && (elig === null || [0, 2].includes(elig?.[p.product.identifier]?.status));
  const trialYearly = canTrial(yearly);
  const trialMonthly = canTrial(monthly);
  return { yearly, monthly, trialYearly, trialMonthly, trialEligible: trialYearly };
}

// Onboarding sells Pro before there is an account: RevenueCat starts with an anonymous id, and
// initSubscriptions(userId) after sign-up logs in, which moves anything bought onto that account.
export async function initAnonymousSubscriptions() {
  if (configured) return;
  await initSubscriptions(null);
}

// The one-time onboarding offer: offering 'onboarding_offer' in RevenueCat, whose Monthly package has a
// pay-up-front introductory price for the first month. Returns null when it isn't set up or this Apple ID
// can't get the intro price, so the offer screen is skipped rather than showing a price we can't charge.
export async function loadIntroOffer() {
  if (!configured || !Purchases) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const off = offerings?.all?.onboarding_offer;
    const pkg = off?.monthly || off?.availablePackages?.find((p) => p.packageType === 'MONTHLY') || null;
    const intro = pkg?.product?.introPrice;
    if (!pkg || !intro || !(intro.price > 0)) return null;
    let elig = null;
    try { elig = await Purchases.checkTrialOrIntroductoryPriceEligibility([pkg.product.identifier]); } catch (_) {}
    const status = elig?.[pkg.product.identifier]?.status;
    if (elig && ![0, 2].includes(status)) return null;
    return { pkg, introPrice: intro.priceString, price: pkg.product.priceString };
  } catch (_) {
    return null;
  }
}

// Returns 'purchased', 'cancelled' or throws.
export async function purchasePlan(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return state.isPro ? 'purchased' : 'cancelled';
  } catch (e) {
    if (e?.userCancelled) return 'cancelled';
    throw e;
  }
}

// Returns true if a Pro subscription was found on this Apple ID.
export async function restorePurchases() {
  if (!configured || !Purchases) return false;
  applyCustomerInfo(await Purchases.restorePurchases());
  return state.isPro;
}

export function useSubscription() {
  const [s, setS] = useState(state);
  useEffect(() => onSubscriptionChange(setS), []);
  return s;
}

// The app registers a function that shows the upgrade screen; any screen can then ask for it.
let presenter = null;
export const setPaywallPresenter = (fn) => { presenter = fn; };
export const openPaywall = (reason) => { if (presenter) presenter(reason); };
