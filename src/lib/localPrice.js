// Prices in the person's own currency. Apple charges some countries (Ghana, Kenya, Uganda, ...) in US dollars, so
// the price Apple gives us reads "$4.99"; here it's shown as roughly what that is in their money ("≈ GH₵ 78"), with
// today's rate. The real charged price still appears in the plan's legal text and on Apple's own payment sheet.
//
// Their country, in order: the App Store country of the Apple ID that will pay (RevenueCat's storefront, the most
// accurate: it's where they're billed), else the country picked in onboarding. The rate comes once a day from
// open.er-api.com and is kept on the phone.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorefrontCountry } from './subscription';

// Countries where the App Store may charge in another currency than the local one, by ISO code.
const CURRENCY = {
  GH: 'GHS', KE: 'KES', UG: 'UGX', TZ: 'TZS', RW: 'RWF', ZM: 'ZMW', MW: 'MWK', MZ: 'MZN', BW: 'BWP', NA: 'NAD',
  ET: 'ETB', NG: 'NGN', ZA: 'ZAR', EG: 'EGP', MA: 'MAD', DZ: 'DZD', TN: 'TND', AO: 'AOA', CD: 'CDF', GM: 'GMD',
  SL: 'SLE', LR: 'LRD', GN: 'GNF', CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF',
  SN: 'XOF', CI: 'XOF', BJ: 'XOF', TG: 'XOF', BF: 'XOF', ML: 'XOF', NE: 'XOF', GW: 'XOF', MU: 'MUR', SC: 'SCR',
  MG: 'MGA', CV: 'CVE', SD: 'SDG', SS: 'SSP', SO: 'SOS', DJ: 'DJF', ER: 'ERN', LS: 'LSL', SZ: 'SZL', BI: 'BIF',
};
// StoreKit's storefront codes are three letters.
const ALPHA3 = {
  GHA: 'GH', KEN: 'KE', UGA: 'UG', TZA: 'TZ', RWA: 'RW', ZMB: 'ZM', MWI: 'MW', MOZ: 'MZ', BWA: 'BW', NAM: 'NA',
  ETH: 'ET', NGA: 'NG', ZAF: 'ZA', EGY: 'EG', MAR: 'MA', DZA: 'DZ', TUN: 'TN', AGO: 'AO', COD: 'CD', GMB: 'GM',
  SLE: 'SL', LBR: 'LR', GIN: 'GN', CMR: 'CM', GAB: 'GA', COG: 'CG', TCD: 'TD', CAF: 'CF', GNQ: 'GQ',
  SEN: 'SN', CIV: 'CI', BEN: 'BJ', TGO: 'TG', BFA: 'BF', MLI: 'ML', NER: 'NE', GNB: 'GW', MUS: 'MU', SYC: 'SC',
  MDG: 'MG', CPV: 'CV', SDN: 'SD', SSD: 'SS', SOM: 'SO', DJI: 'DJ', ERI: 'ER', LSO: 'LS', SWZ: 'SZ', BDI: 'BI',
};
// Onboarding's country names.
const BY_NAME = { Nigeria: 'NG', Ghana: 'GH', Kenya: 'KE', Tanzania: 'TZ', Uganda: 'UG', Senegal: 'SN', Cameroon: 'CM', Ethiopia: 'ET' };

const RATE_KEY = 'logga_fx_v1_';
const RATE_MAX_AGE = 12 * 60 * 60 * 1000;

const toAlpha2 = (code) => {
  const c = String(code || '').toUpperCase();
  return c.length === 3 ? ALPHA3[c] || null : c.length === 2 ? c : null;
};

/** The person's local currency (e.g. 'GHS'), or null when we can't tell or it isn't one we convert to. */
export async function localCurrency(onboardingCountry) {
  let cc = toAlpha2(await getStorefrontCountry().catch(() => null));
  if (!cc) cc = BY_NAME[onboardingCountry] || null;
  return (cc && CURRENCY[cc]) || null;
}

/** How many `to` one `from` is worth today (e.g. 1 USD = 15.6 GHS), or null. */
export async function rate(from, to) {
  if (!from || !to || from === to) return null;
  const key = `${RATE_KEY}${from}`;
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
    if (saved && Date.now() - saved.at < RATE_MAX_AGE && saved.rates?.[to]) return saved.rates[to];
  } catch (_) {}
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    const j = await r.json();
    if (j?.result !== 'success' || !j.rates) return null;
    AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), rates: j.rates })).catch(() => {});
    return j.rates[to] || null;
  } catch (_) {
    return null;
  }
}

const money = (amount, currency, digits) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
  } catch (_) {
    return `${currency} ${amount.toFixed(digits)}`;
  }
};

/**
 * { show(amount, currency) -> "≈ GH₵ 78" or null (use Apple's own price), rateLine -> "Today's rate: $1 = GH₵ 15.60" or null }.
 * `from` is the store's currency (e.g. product.currencyCode); nothing changes when it already is theirs.
 */
export function useLocalPrice(from, onboardingCountry) {
  const [fx, setFx] = useState(null); // { to, rate }
  useEffect(() => {
    let alive = true;
    if (!from) return undefined;
    (async () => {
      const to = await localCurrency(onboardingCountry);
      if (!to || to === from) return;
      const r = await rate(from, to);
      if (alive && r) setFx({ to, rate: r });
    })();
    return () => { alive = false; };
  }, [from, onboardingCountry]);
  if (!fx) return { show: () => null, rateLine: null };
  const show = (amount, currency = from) => {
    if (currency !== from || !(amount >= 0)) return null;
    const v = amount * fx.rate;
    return `≈ ${money(v >= 20 ? Math.round(v) : v, fx.to, v >= 20 ? 0 : 2)}`;
  };
  return { show, rateLine: `Today's rate: ${money(1, from, 0)} = ${money(fx.rate, fx.to, 2)}` };
}
