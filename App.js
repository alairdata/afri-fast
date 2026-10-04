import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator, Text, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/components/AuthScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import FastingApp from './src/FastingApp';
import PreAuthOnboarding from './src/components/PreAuthOnboarding';
import { installErrorTracking } from './src/lib/analytics';
import { clearWidgetSnapshot } from './src/lib/widgetSync';
import AccountDeletedModal from './src/components/AccountDeletedModal';
import LoggedOutModal from './src/components/LoggedOutModal';
import { ThemeContext, COLORS, DARK_MODE_AVAILABLE } from './src/lib/theme';
import { takeAuthIntent } from './src/lib/authIntent';
import AccountNotFoundScreen from './src/components/AccountNotFoundScreen';
import RestoreAccountScreen from './src/components/RestoreAccountScreen';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
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

// Uncaught errors / unhandled rejections go to Mixpanel too (capped per launch).
installErrorTracking();

const PRE_AUTH_STORAGE_KEY = 'afri-fast-preauth';
const DARK_MODE_KEY = 'logga-dark-mode';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preAuthData, setPreAuthData] = useState(null);
  // Set when an account has just been deleted, so 'Your account has been deleted' shows over the sign-in screen.
  // Set when an account has just been deleted: true, or the date it will be erased ('now' if already erased).
  const [accountDeleted, setAccountDeleted] = useState(false);
  // Set on log out, so "You're logged out" shows over the sign-in screen.
  const [loggedOut, setLoggedOut] = useState(false);

  // Dark mode: the switch in Settings. The screens already read their colours from ThemeContext; this is what
  // actually provides it (it used to default to light forever) and remembers the choice.
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((v) => { if (v === '1') setDarkMode(true); }).catch(() => {});
  }, []);
  const toggleDarkMode = (on) => {
    setDarkMode(!!on);
    AsyncStorage.setItem(DARK_MODE_KEY, on ? '1' : '0').catch(() => {});
  };
  const effectiveDark = DARK_MODE_AVAILABLE && darkMode; // stays light while dark mode is hidden
  const themeValue = React.useMemo(() => ({ isDark: effectiveDark, colors: effectiveDark ? COLORS.dark : COLORS.light }), [effectiveDark]);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED' || !session) {
        setSession(null);
        if (event === 'SIGNED_OUT') setPreAuthData(null); // the next person starts their own onboarding
      } else {
        setSession(session);
        setLoggedOut(false);
      }
    });

    // Poll every 30 seconds — if the user was deleted by admin, force sign out
    const sessionPoll = setInterval(async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        supabase.auth.signOut();
        setSession(null);
      }
    }, 30000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearInterval(sessionPoll);
    };
  }, []);


  // Everyone who signs in must have been through onboarding, however they signed in (the same rule as
  // So-UnFiltered AI's onboarding_complete flag). Someone who taps Apple/Google on the LOGIN screen
  // creates an account without ever answering the questions; catch that here. We call onboarding done
  // if they answered it before sign-up (preAuthData) or their profile already has any of the answers.
  const [profileCheck, setProfileCheck] = useState('idle'); // 'idle' | 'checking' | 'needs' | 'ok' | 'notfound'
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfileCheck('idle'); return undefined; }
    if (loading) return undefined;
    let cancelled = false;
    const intent = takeAuthIntent(); // 'login' when they tapped Apple/Google on the Log in screen
    setProfileCheck('checking');
    supabase.from('profiles')
      .select('goal, height, age, target_weight, starting_weight, daily_calorie_goal')
      .eq('id', uid).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // A network blip must never lock someone out of their own account.
        if (error) { setProfileCheck('ok'); return; }
        // Tapped Apple/Google to LOG IN, but there was no account: Apple/Google just created an empty one.
        // Say we couldn't find their account instead of quietly signing them up.
        if (!data && intent === 'login') { setProfileCheck('notfound'); return; }
        const filled = !!data && Object.values(data).some((v) => v !== null && v !== undefined && v !== '');
        setProfileCheck(filled || preAuthData?.completedAt ? 'ok' : 'needs');
      })
      .catch(() => { if (!cancelled) setProfileCheck('ok'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, loading]);
  // Signed out for any reason (log out, expired session, removed account): the home-screen widgets must not keep
  // showing the last person's numbers.
  useEffect(() => {
    if (!loading && !session) clearWidgetSnapshot();
  }, [loading, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
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
      <AccountDeletedModal
        visible={!!accountDeleted}
        deleteAfter={typeof accountDeleted === 'string' ? accountDeleted : null}
        onClose={() => setAccountDeleted(false)}
      />
      <LoggedOutModal visible={loggedOut && !accountDeleted} onClose={() => setLoggedOut(false)} />
      </>
    );
  }

  if (profileCheck === 'idle' || profileCheck === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  // Logged in to an account they deleted less than 7 days ago: offer to restore it.
  const deletionScheduledAt = session.user.app_metadata?.deletion_scheduled_at;
  if (deletionScheduledAt) {
    const api = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
    const authed = (body) => ({
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return (
      <SafeAreaProvider>
        <RestoreAccountScreen
          deleteAfter={deletionScheduledAt}
          onRestore={async () => {
            try {
              const r = await fetch(`${api}/api/restore-account`, authed());
              if (!r.ok) return "We couldn't restore your account. Please try again.";
              // A fresh token no longer carries the deletion date, so the app opens normally.
              const { error } = await supabase.auth.refreshSession();
              return error ? "Your account is restored. Please log in again." : null;
            } catch (_) {
              return "Couldn't reach Logga. Check your connection and try again.";
            }
          }}
          onDeleteNow={async () => {
            try {
              const r = await fetch(`${api}/api/delete-account`, authed({ mode: 'now' }));
              if (!r.ok) return "We couldn't delete your account. Please try again.";
              setAccountDeleted('now');
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              return null;
            } catch (_) {
              return "Couldn't reach Logga. Check your connection and try again.";
            }
          }}
          onLogOut={async () => {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return null;
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (profileCheck === 'notfound') {
    return (
      <SafeAreaProvider>
        <AccountNotFoundScreen
          email={session.user.email}
          provider={session.user.app_metadata?.provider}
          onCreate={() => setProfileCheck(preAuthData?.completedAt ? 'ok' : 'needs')}
          onBack={async () => {
            // Remove the empty account Apple/Google just made, so nothing is left behind.
            try {
              await fetch(`${Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app'}/api/delete-account`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'now' }), // nothing to keep: it was created seconds ago
              });
            } catch (_) {}
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }}
        />
      </SafeAreaProvider>
    );
  }

  if (profileCheck === 'needs') {
    return (
      <SafeAreaProvider>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <PreAuthOnboarding
            initialData={preAuthData}
            onLogin={() => supabase.auth.signOut()}
            onComplete={async (answers) => {
              setPreAuthData(answers);
              await AsyncStorage.setItem(PRE_AUTH_STORAGE_KEY, JSON.stringify(answers));
              setProfileCheck('ok');
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    );
  }

  return (
    <ThemeContext.Provider value={themeValue}>
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar barStyle={themeValue.colors.statusBar} backgroundColor={themeValue.colors.appBg} />
        <SafeAreaView style={{ flex: 1, backgroundColor: themeValue.colors.appBg }}>
          <FastingApp
            // A different account gets a completely fresh app: nothing the previous person had on screen
            // (profile photo, name, numbers) can carry over, however the switch happened.
            key={session.user.id}
            session={session}
            onAccountDeleted={(deleteAfter) => setAccountDeleted(deleteAfter || true)}
            onLoggedOut={() => setLoggedOut(true)}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            pendingPreAuthData={preAuthData}
            onPreAuthDataApplied={async () => {
              setPreAuthData(null);
              await AsyncStorage.removeItem(PRE_AUTH_STORAGE_KEY);
            }}
          />
        </SafeAreaView>
      </ErrorBoundary>
    </SafeAreaProvider>
    </ThemeContext.Provider>
  );
}
