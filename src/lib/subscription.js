// Logga Pro through Apple in-app purchase, managed by RevenueCat (entitlement 'pro', offering 'default'
// with a Monthly and an Annual package; the yearly product carries the 7-day free trial).
// Only iOS can buy, so the Free/Pro split only applies there: on web and Android (no way to pay yet)
// everything stays unlocked.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
export const ENTITLEMENT = 'pro';
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
  let trialEligible = false;
  if (yearly?.product?.introPrice) {
    try {
      const elig = await Purchases.checkTrialOrIntroductoryPriceEligibility([yearly.product.identifier]);
      // 2 = eligible; 0 (unknown) is treated as eligible, as Apple decides at purchase time.
      const s = elig?.[yearly.product.identifier]?.status;
      trialEligible = s === 2 || s === 0;
    } catch (_) { trialEligible = true; }
  }
  return { yearly, monthly, trialEligible };
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
