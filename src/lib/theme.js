import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export const COLORS = {
  light: {
    bg:           '#FAFAFA',
    appBg:        '#FAFBFF',
    card:         '#ffffff',
    cardAlt:      '#F3F4F6',
    border:       '#E5E7EB',
    borderLight:  'rgba(0,0,0,0.06)',
    text:         '#1F1F1F',
    subtext:      '#6B7280',
    textSecondary:'#6B7280',
    textMuted:    '#9CA3AF',
    tabBar:       '#ffffff',
    tabBarBorder: 'rgba(0,0,0,0.06)',
    accent:       '#059669',
    accentLight:  '#ECFDF5',
    accentText:   '#059669',
    inputBg:      '#F9FAFB',
    overlay:      'rgba(0,0,0,0.45)',
    statusBar:    'dark-content',
  },
  dark: {
    bg:           '#111827',
    appBg:        '#0F172A',
    card:         '#1F2937',
    cardAlt:      '#374151',
    border:       '#374151',
    borderLight:  'rgba(255,255,255,0.08)',
    text:         '#F9FAFB',
    subtext:      '#9CA3AF',
    textSecondary:'#9CA3AF',
    textMuted:    '#6B7280',
    tabBar:       '#111827',
    tabBarBorder: 'rgba(255,255,255,0.08)',
    accent:       '#10B981',
    accentLight:  'rgba(16,185,129,0.15)',
    accentText:   '#10B981',
    inputBg:      '#374151',
    overlay:      'rgba(0,0,0,0.7)',
    statusBar:    'light-content',
  },
};

// Dark mode is only partly built (the tabs follow the theme, about 30 other screens have fixed colours). Keep this
// false until those screens are done: it hides the Dark Mode switch in Settings and keeps the app light, even for
// anyone who switched it on while it was visible.
export const DARK_MODE_AVAILABLE = false;

export const ThemeContext = createContext({ isDark: false, colors: COLORS.light });

// ── Dark mode for screens written with fixed light colours ────────────────────────────────────────────────────────
// App.js sets this before rendering (and remounts the app when it changes), so module-level styles can follow it.
let currentDark = false;
export const setThemeDark = (on) => { currentDark = !!on; };
export const isThemeDark = () => currentDark;

const norm = (c) => {
  if (typeof c !== 'string') return c;
  const s = c.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map((d) => d + d).join('')).toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  if (/^white$/i.test(s)) return '#FFFFFF';
  return s;
};
// Light colour → dark colour, by what it's used for. Anything not listed (brand greens, chart colours, photos) stays.
const DARK_MAP = {
  bg: {
    // cards and sheets
    '#FFFFFF': '#1F2937', '#FCFCFC': '#1F2937', '#FAFAFA': '#1F2937', '#FAFBFF': '#1F2937', '#FDFDFD': '#1F2937',
    // page backgrounds
    '#F9FAFB': '#111827', '#F2F2F2': '#111827', '#F8FAFC': '#111827', '#F6F3EC': '#111827', '#F7F7F7': '#111827', '#F5F5F5': '#111827',
    // light grey fills (chips, inputs, rows)
    '#F3F4F6': '#2B3544', '#F1F5F9': '#2B3544', '#F1F3F7': '#2B3544', '#F0F1F3': '#2B3544', '#F0EBE0': '#2B3544', '#E5E7EB': '#374151', '#EEF0EC': '#374151', '#F3F4F2': '#2B3544', '#E7F3EC': '#1E3A2F',
    // tints
    '#ECFDF5': '#123227', '#D1FAE5': '#14532D', '#E2E9E4': '#1E3A2F', '#EEF7F1': '#123227', '#F0FDF4': '#123227', '#E2EFE4': '#123227', '#DDF6E7': '#123227', '#E9F8EF': '#14261F', '#F4FBF7': '#16211C', '#CFF3DE': '#123227', '#EAF9F1': '#123227', '#C7EEDA': '#14532D',
    '#FEE2E2': '#3B1D1D', '#FEF2F2': '#2E1A1A', '#FBE5DC': '#3B1D1D', '#FECACA': '#4C1D1D',
    '#FEF3C7': '#3A2E12', '#FFF7ED': '#33240F', '#FFFBEB': '#2E2612', '#FFF8EC': '#33240F', '#FFF1DD': '#33240F', '#FDE7C8': '#3A2A12',
    '#EFF6FF': '#172554', '#DBEAFE': '#1E3A8A', '#EAF0F8': '#172554',
    '#F5F3FF': '#2E1F4D', '#F3E8FF': '#3B1F5C', '#FAF5FF': '#2E1F4D', '#EDE9FE': '#2E1F4D',
  },
  text: {
    '#1F1F1F': '#F9FAFB', '#111111': '#F9FAFB', '#111827': '#F9FAFB', '#16201B': '#F9FAFB', '#1A1F1B': '#F9FAFB', '#1F2937': '#F3F4F6', '#000000': '#F9FAFB', '#0B3D2E': '#D1FAE5', '#13241A': '#F3F4F6',
    '#374151': '#E5E7EB', '#3E4A40': '#E5E7EB', '#4B5563': '#D1D5DB', '#565D57': '#D1D5DB', '#4A4F49': '#D1D5DB',
    '#6B7280': '#9CA3AF', '#6C7872': '#9CA3AF', '#888888': '#9CA3AF', '#999999': '#9CA3AF', '#666666': '#9CA3AF',
    '#9CA3AF': '#9CA3AF', '#A3ACA7': '#6B7280', '#BDBDBD': '#6B7280', '#AAAAAA': '#6B7280', '#C4C8CE': '#6B7280', '#CCCCCC': '#6B7280', '#D1D5DB': '#4B5563',
  },
  border: {
    '#E5E7EB': '#374151', '#F0F1F3': '#2B3544', '#F1F5F9': '#2B3544', '#D1D5DB': '#4B5563', '#E4DED1': '#374151', '#CFC9BB': '#4B5563', '#EEF0EC': '#374151', '#F3F4F6': '#2B3544', '#E9E9E1': '#374151', '#F0EBE0': '#374151', '#FFFFFF': '#1F2937',
  },
};
const KEY_KIND = (key) => {
  if (/^(color|tintColor|placeholderTextColor|textShadowColor)$/.test(key)) return 'text';
  if (/border.*Color|^(stroke|outlineColor)$/.test(key)) return 'border';
  if (/^(backgroundColor|background|fill|underlayColor)$/.test(key)) return 'bg';
  return null;
};

// See-through light colours (rgba with near-white red, green and blue) as backgrounds or borders: the same
// see-through-ness over the dark page or card colour. White ones become the card colour, off-whites the page colour.
const darkRgba = (c, kind) => {
  if (kind === 'text') return null;
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  if (Math.min(r, g, b) < 225) return null;
  const a = m[4] != null ? m[4] : '1';
  return r === 255 && g === 255 && b === 255 ? `rgba(31,41,55,${a})` : `rgba(17,24,39,${a})`;
};
const mapColor = (c, kind) => DARK_MAP[kind]?.[norm(c)] || darkRgba(String(c).trim(), kind) || c;

/** One colour for the current theme: dc('#FFFFFF', 'bg'). In light mode it's returned unchanged. */
export function dc(color, kind = 'bg') {
  if (!currentDark || typeof color !== 'string') return color;
  return mapColor(color, kind);
}

// A style object for dark mode: every colour swapped by what its property is for.
function darkenStyle(style) {
  if (!style || typeof style !== 'object') return style;
  if (Array.isArray(style)) return style.map(darkenStyle);
  const out = {};
  Object.keys(style).forEach((k) => {
    const v = style[k];
    const kind = KEY_KIND(k);
    if (kind && typeof v === 'string') out[k] = mapColor(v, kind);
    else if (v && typeof v === 'object') out[k] = darkenStyle(v);
    else out[k] = v;
  });
  return out;
}

/** StyleSheet.create for both themes; reading a style gives the current theme's version. */
export function themedStyles(def) {
  const light = StyleSheet.create(def);
  let dark = null;
  return new Proxy(light, {
    get(target, prop) {
      if (!currentDark) return target[prop];
      if (!dark) {
        const d = {};
        Object.keys(def).forEach((k) => { d[k] = darkenStyle(def[k]); });
        dark = StyleSheet.create(d);
      }
      return dark[prop];
    },
  });
}

export const useTheme = () => useContext(ThemeContext);
