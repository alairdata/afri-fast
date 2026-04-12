import React, { createContext, useContext } from 'react';

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

export const ThemeContext = createContext({ isDark: false, colors: COLORS.light });

export const useTheme = () => useContext(ThemeContext);
