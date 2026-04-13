import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator, Text, TextInput, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/components/AuthScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import FastingApp from './src/FastingApp';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Load Ionicons font via CSS (Metro doesn't auto-load icon fonts like webpack did)
  // eslint-disable-next-line import/no-unresolved
  const ioniconsFontUrl = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');
  const iconStyle = document.createElement('style');
  iconStyle.textContent = `@font-face{font-family:'ionicons';src:url('${ioniconsFontUrl}') format('truetype');font-display:block;}`;
  document.head.appendChild(iconStyle);

  // Load Inter from Google Fonts
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=block';
  document.head.appendChild(link);

  // react-native-web generates a CSS rule with font-family: -apple-system,BlinkMacSystemFont,...
  // for its base Text style. We patch that specific rule to prepend Inter.
  // Ionicons rules only contain "Ionicons" and are left untouched.
  const patchSystemFontRule = () => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!rule.style) continue;
          const ff = rule.style.getPropertyValue('font-family');
          const font = rule.style.getPropertyValue('font');
          if (ff && ff.includes('-apple-system')) {
            rule.style.setProperty('font-family', `"Inter",${ff}`);
          }
          if (font && font.includes('-apple-system')) {
            rule.style.setProperty('font', font.replace('-apple-system', '"Inter",-apple-system'));
          }
        }
      } catch (e) {
        // cross-origin stylesheets throw — skip them
      }
    }
  };

  // Run after first render so react-native-web has generated its CSS classes
  setTimeout(patchSystemFontRule, 0);

}

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [
  { fontFamily: 'Inter', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  TextInput.defaultProps.style,
].filter(Boolean);

const PRE_AUTH_STORAGE_KEY = 'afri-fast-preauth';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preAuthData, setPreAuthData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      supabase.auth.getSession(),
      AsyncStorage.getItem(PRE_AUTH_STORAGE_KEY),
    ]).then(([{ data: { session }, error }, storedPreAuth]) => {
      if (!isMounted) return;
      if (error) {
        // Stale/invalid refresh token — clear it and show login
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
      }
      try {
        setPreAuthData(storedPreAuth ? JSON.parse(storedPreAuth) : null);
      } catch {
        setPreAuthData(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        preAuthData={preAuthData}
        onSavePreAuthData={async (nextData) => {
          setPreAuthData(nextData);
          if (nextData) {
            await AsyncStorage.setItem(PRE_AUTH_STORAGE_KEY, JSON.stringify(nextData));
          } else {
            await AsyncStorage.removeItem(PRE_AUTH_STORAGE_KEY);
          }
        }}
      />
    );
  }

  return (
    <ErrorBoundary>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFF" />
      <SafeAreaView style={{ flex: 1 }}>
        <FastingApp
          session={session}
          pendingPreAuthData={preAuthData}
          onPreAuthDataApplied={async () => {
            setPreAuthData(null);
            await AsyncStorage.removeItem(PRE_AUTH_STORAGE_KEY);
          }}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}
