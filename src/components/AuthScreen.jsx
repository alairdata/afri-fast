import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
  Animated, Easing, useWindowDimensions, Linking, Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { signInNative } from '../lib/nativeAuth';
import PreAuthOnboarding from './PreAuthOnboarding';
import Ionicons from '@expo/vector-icons/Ionicons';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const doodleStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center' },
});

const AUTH_DOODLE_SHAPES = [
  // Large arc across top
  { d: 'M 20 95 Q 170 22 320 95', length: 342, delay: 0, strokeWidth: 2.5 },
  // Timer circle
  { d: 'M 170 62 A 33 33 0 1 0 170 128 A 33 33 0 1 0 170 62', length: 208, delay: 220, strokeWidth: 2 },
  // Hour hand
  { d: 'M 170 95 L 170 70', length: 25, delay: 430, strokeWidth: 2.5 },
  // Minute hand
  { d: 'M 170 95 L 190 95', length: 20, delay: 460, strokeWidth: 2.5 },
  // Left leaf
  { d: 'M 42 138 C 22 116 30 92 54 98 C 68 102 62 126 42 138', length: 112, delay: 350, strokeWidth: 2 },
  // Left stem
  { d: 'M 42 138 L 52 158', length: 22, delay: 462, strokeWidth: 2 },
  // Right leaf
  { d: 'M 298 138 C 318 116 310 92 286 98 C 272 102 278 126 298 138', length: 112, delay: 500, strokeWidth: 2 },
  // Right stem
  { d: 'M 298 138 L 288 158', length: 22, delay: 612, strokeWidth: 2 },
  // Left wavy accent
  { d: 'M 72 58 C 88 46 104 68 120 56', length: 58, delay: 750, strokeWidth: 1.8 },
  // Right wavy accent
  { d: 'M 220 58 C 236 46 252 68 268 56', length: 58, delay: 900, strokeWidth: 1.8 },
  // Small dot top-left
  { d: 'M 50 32 A 4 4 0 1 0 50 31.9', length: 25, delay: 660, strokeWidth: 2 },
  // Small dot top-right
  { d: 'M 290 32 A 4 4 0 1 0 290 31.9', length: 25, delay: 780, strokeWidth: 2 },
  // Tiny dot center-top
  { d: 'M 170 32 A 3 3 0 1 0 170 31.9', length: 19, delay: 840, strokeWidth: 2 },
];

function DoodleAuth() {
  const anims = useRef(AUTH_DOODLE_SHAPES.map(s => new Animated.Value(s.length))).current;

  useEffect(() => {
    const timeouts = [];
    const running = [];

    AUTH_DOODLE_SHAPES.forEach((shape, i) => {
      const t = setTimeout(() => {
        const a = Animated.loop(
          Animated.sequence([
            Animated.timing(anims[i], {
              toValue: 0,
              duration: 1400,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.delay(700),
            Animated.timing(anims[i], {
              toValue: shape.length,
              duration: 900,
              easing: Easing.in(Easing.quad),
              useNativeDriver: false,
            }),
            Animated.delay(500),
          ])
        );
        a.start();
        running.push(a);
      }, shape.delay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
      running.forEach(a => a.stop());
    };
  }, []);

  return (
    <View style={doodleStyles.container}>
      <Svg width="100%" height="100%" viewBox="0 0 340 180" preserveAspectRatio="xMidYMid meet">
        {AUTH_DOODLE_SHAPES.map((shape, i) => (
          <AnimatedPath
            key={i}
            d={shape.d}
            stroke="#0F9D78"
            strokeWidth={shape.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${shape.length}`}
            strokeDashoffset={anims[i]}
          />
        ))}
      </Svg>
    </View>
  );
}

// ── Shared auth-screen styles (create account, confirm email, log in) ─────────
const ca = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbf7' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 58 : 40, paddingBottom: 44 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  wordmark: { width: 104, height: 40 },
  eyebrow: { fontSize: 12, fontWeight: '800', color: '#059669', letterSpacing: 1.6, marginBottom: 8 },
  headline: { fontSize: 32, fontWeight: '800', color: '#10201a', letterSpacing: -0.8, lineHeight: 38, marginBottom: 10 },
  headlineAccent: { color: '#059669' },
  subtitle: { fontSize: 15, color: 'rgba(16,32,26,0.55)', lineHeight: 22, marginBottom: 18 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 26 },
  perk: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(5,150,105,0.09)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  perkTxt: { fontSize: 12, fontWeight: '600', color: '#047857' },
  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111', borderRadius: 16, height: 54, gap: 10, marginBottom: 10,
  },
  appleTxt: { fontSize: 16, fontWeight: '600', color: '#fff' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 16, height: 54, gap: 10,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.09)',
  },
  googleTxt: { fontSize: 16, fontWeight: '600', color: '#111' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  divTxt: { fontSize: 11, fontWeight: '700', color: 'rgba(0,0,0,0.32)', letterSpacing: 1 },
  label: { fontSize: 12, fontWeight: '700', color: 'rgba(16,32,26,0.6)', marginBottom: 6, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, height: 54,
    paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.09)',
  },
  inputRowFocus: { borderColor: '#059669' },
  inputRowErr: { borderColor: '#EF4444', backgroundColor: '#FFF7F7' },
  inputIcon: { marginRight: 10 },
  inputTxt: { flex: 1, fontSize: 16, color: '#10201a' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 2 },
  hintTxt: { fontSize: 12, color: 'rgba(16,32,26,0.45)' },
  hintOk: { color: '#059669', fontWeight: '600' },
  error: {
    color: '#B91C1C', fontSize: 13, lineHeight: 18, marginTop: 14,
    backgroundColor: '#FEF2F2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden',
  },
  success: {
    color: '#047857', fontSize: 13, lineHeight: 18, marginTop: 14,
    backgroundColor: '#ECFDF5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden',
  },
  createBtn: {
    backgroundColor: '#059669', borderRadius: 16, height: 56,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
    shadowColor: '#059669', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  createTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', backgroundColor: '#fff',
  },
  secondaryTxt: { color: '#10201a', fontSize: 15, fontWeight: '600' },
  terms: { textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(16,32,26,0.45)', lineHeight: 19 },
  link: { color: '#059669', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalIcon: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 21, fontWeight: '800', color: '#10201a', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  modalBody: { fontSize: 14.5, color: 'rgba(16,32,26,0.62)', textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  confirmIcon: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 28, marginBottom: 22,
  },
  confirmHeadline: { fontSize: 28, fontWeight: '800', color: '#10201a', textAlign: 'center', letterSpacing: -0.6, marginBottom: 10 },
  confirmBody: { fontSize: 15, color: 'rgba(16,32,26,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  confirmEmail: { fontSize: 16, fontWeight: '700', color: '#10201a', textAlign: 'center', marginBottom: 22 },
});

// Where the confirmation link in the sign-up email sends the person. On a phone that is the app
// itself (logga://auth-callback, the same link Google sign-in already returns through); without
// this Supabase falls back to the dashboard's Site URL, which is the website.
const NATIVE_REDIRECT = 'logga://auth-callback';
const webOrigin = () => (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? window.location.origin
  : 'https://afri-fast.vercel.app');
const emailRedirectTo = () => (Platform.OS === 'web' ? webOrigin() : NATIVE_REDIRECT);

const isNotConfirmed = (e) => e?.code === 'email_not_confirmed' || /not confirmed/i.test(e?.message || '');
const isRateLimited = (e) => e?.code === 'over_email_send_rate_limit' || e?.status === 429 || /rate limit/i.test(e?.message || '');
const RATE_LIMIT_MSG = "We're sending a lot of emails right now. Please wait a few minutes and try again, or continue with Apple or Google.";

// Capitalise what they typed ("reviewer" -> "Reviewer") but never cut it down to an initial.
const displayName = (n) => {
  const t = (n || '').trim().replace(/\s+/g, ' ');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

// Auth links already used this launch, so a re-mounted screen can't replay a stale token.
const handledAuthUrls = new Set();

function AuthTop({ onBack }) {
  return (
    <>
      <LinearGradient colors={['#DDF3E7', '#fbfbf7']} style={ca.hero} pointerEvents="none" />
      <View style={ca.topRow}>
        <TouchableOpacity style={ca.closeBtn} onPress={onBack} activeOpacity={0.7} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color="rgba(0,0,0,0.55)" />
        </TouchableOpacity>
        <Image source={require('../../assets/logga-wordmark.png')} style={ca.wordmark} resizeMode="contain" />
        <View style={{ width: 40 }} />
      </View>
    </>
  );
}

export default function AuthScreen({ preAuthData, onSavePreAuthData }) {
  const { width: screenWidth } = useWindowDimensions();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState(preAuthData?.preferredName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState({});
  const [focused, setFocused] = useState('');
  const [screen, setScreen] = useState(preAuthData?.completedAt ? 'auth' : 'onboarding'); // 'onboarding' | 'auth' | 'confirm'
  const [rawOnboarding, setRawOnboarding] = useState(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [pendingModal, setPendingModal] = useState(false);

  // Resend-email cooldown.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // The confirmation email opens the app through logga://auth-callback with the session tokens (or an
  // error such as an expired link) in the URL. Hand the tokens to Supabase; the app moves on by itself.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const handle = async (url) => {
      if (!url || !url.startsWith(NATIVE_REDIRECT) || handledAuthUrls.has(url)) return;
      handledAuthUrls.add(url);
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) setError(sessionError.message);
        return;
      }
      const desc = params.get('error_description');
      if (desc) {
        setError(/expired|invalid/i.test(desc)
          ? 'That confirmation link has expired. Tap "Resend email" to get a fresh one.'
          : desc);
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const goConfirm = (addr, cooldown = 0) => {
    setConfirmEmail(addr);
    setResendIn(cooldown);
    setError(''); setMessage('');
    setScreen('confirm');
  };

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true); setError(''); setMessage('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (!loginError) return;
    // They signed up but never tapped the link in the email: say so (and let them resend) instead of
    // bouncing them around the sign-up screens.
    if (isNotConfirmed(loginError)) {
      setConfirmEmail(cleanEmail); setError(''); setMessage('');
      setPendingModal(true);
      return;
    }
    if (isRateLimited(loginError)) { setError('Too many attempts. Please wait a few minutes and try again.'); return; }
    if (loginError.code === 'invalid_credentials' || /invalid login credentials/i.test(loginError.message || '')) {
      setError("That email and password don't match. If you're new here, tap \"Start here\" below.");
      return;
    }
    setError(loginError.message);
  };

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true });
    if (!name.trim() || !email.trim() || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true); setError(''); setMessage('');
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: emailRedirectTo() },
    });
    if (signUpError) {
      const msg = (signUpError.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError(`We already have an account for ${cleanEmail}. Log in below instead.`);
        setMode('login');
      } else if (isRateLimited(signUpError)) {
        setError(RATE_LIMIT_MSG);
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }
    // With email confirmation on, Supabase answers "success" for an email that already has an account,
    // but returns a user with no identities. Treat that as "already registered".
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(`We already have an account for ${cleanEmail}. Log in below instead.`);
      setMode('login');
      setLoading(false);
      return;
    }
    // With email confirmation on, signUp gives back a user but no session yet, so the database (row
    // security) refuses the profile insert and it used to show a false "Account setup failed".
    // The profile is created automatically on the first real login (see FastingApp's profile fetch),
    // so just ask them to confirm their email.
    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, name: name.trim(), email: cleanEmail });
      if (profileError) {
        console.error('[DB Error - create profile]', profileError);
        // Profile creation failed — delete the auth user to avoid orphaned accounts
        await supabase.auth.signOut();
        setError('Account setup failed. Please try again.');
        setLoading(false);
        return;
      }
      setLoading(false);
      return;
    }
    setLoading(false);
    goConfirm(cleanEmail, 45);
  };

  const handleResend = async () => {
    if (resendIn > 0 || !confirmEmail) return;
    setError(''); setMessage('');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup', email: confirmEmail, options: { emailRedirectTo: emailRedirectTo() },
    });
    if (resendError) {
      setError(isRateLimited(resendError) ? RATE_LIMIT_MSG : resendError.message);
      setResendIn(60);
      return;
    }
    setMessage('Sent! It can take a minute to arrive. Check your spam folder too.');
    setResendIn(60);
  };

  const handleOAuth = async (provider) => {
    setError('');
    if (Platform.OS !== 'web') {
      const r = await signInNative(provider);
      if (r.error) setError(r.error);
      return;
    }
    const redirectTo = webOrigin();
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('afri-fast-oauth-pending', '1');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined } });
    if (oauthError) setError(oauthError.message);
  };

  const openLegal = (path) => Linking.openURL(`https://www.logga.space/${path}`).catch(() => {});
  const openMailApp = () => Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => {});

  const socialButtons = (
    <>
      {Platform.OS !== 'web' && (
        <TouchableOpacity style={ca.appleBtn} activeOpacity={0.85} onPress={() => handleOAuth('apple')}>
          <Ionicons name="logo-apple" size={20} color="#fff" />
          <Text style={ca.appleTxt}>Continue with Apple</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={ca.googleBtn} activeOpacity={0.85} onPress={() => handleOAuth('google')}>
        <Ionicons name="logo-google" size={18} color="#444" />
        <Text style={ca.googleTxt}>Continue with Google</Text>
      </TouchableOpacity>
    </>
  );

  const emailField = (
    <View>
      <Text style={ca.label}>Email</Text>
      <View style={[ca.inputRow, focused === 'email' && ca.inputRowFocus, touched.email && !email.trim() && ca.inputRowErr]}>
        <Ionicons name="mail-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
        <TextInput
          style={ca.inputTxt}
          placeholder="you@email.com"
          placeholderTextColor="rgba(0,0,0,0.28)"
          value={email}
          onChangeText={(v) => { setEmail(v); setTouched((t) => ({ ...t, email: true })); }}
          onFocus={() => setFocused('email')}
          onBlur={() => setFocused('')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
      </View>
    </View>
  );

  const passwordField = (placeholder, isSignup) => (
    <View style={{ marginTop: 14 }}>
      <Text style={ca.label}>Password</Text>
      <View style={[ca.inputRow, focused === 'password' && ca.inputRowFocus, touched.password && !password && ca.inputRowErr]}>
        <Ionicons name="lock-closed-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
        <TextInput
          style={ca.inputTxt}
          placeholder={placeholder}
          placeholderTextColor="rgba(0,0,0,0.28)"
          value={password}
          onChangeText={(v) => { setPassword(v); setTouched((t) => ({ ...t, password: true })); }}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused('')}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={isSignup ? 'newPassword' : 'password'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ paddingLeft: 8 }} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="rgba(0,0,0,0.35)" />
        </TouchableOpacity>
      </View>
      {isSignup && (
        <View style={ca.hint}>
          <Ionicons
            name={password.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={password.length >= 8 ? '#059669' : 'rgba(0,0,0,0.3)'}
          />
          <Text style={[ca.hintTxt, password.length >= 8 && ca.hintOk]}>At least 8 characters</Text>
        </View>
      )}
    </View>
  );

  if (screen === 'onboarding') {
    return (
      <KeyboardAvoidingView style={styles.onboardingContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PreAuthOnboarding
          initialData={rawOnboarding || preAuthData}
          initialStep={rawOnboarding ? 'done' : undefined}
          onLogin={() => { setMode('login'); setScreen('auth'); }}
          onComplete={async (answers, raw) => {
            setRawOnboarding(raw);
            await onSavePreAuthData?.(answers);
            setName(answers.preferredName || '');
            setMode('signup');
            setScreen('auth');
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── Check-your-email screen (after sign-up, or a log-in before confirming) ──
  if (screen === 'confirm') {
    return (
      <KeyboardAvoidingView style={ca.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ca.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthTop onBack={() => { setError(''); setMessage(''); setScreen('auth'); }} />

          <View style={ca.confirmIcon}>
            <Ionicons name="mail-open-outline" size={36} color="#059669" />
          </View>
          <Text style={ca.confirmHeadline}>Check your email</Text>
          <Text style={ca.confirmBody}>We sent a confirmation link to</Text>
          <Text style={ca.confirmEmail}>{confirmEmail}</Text>
          <Text style={[ca.confirmBody, { marginBottom: 6 }]}>
            Tap the link on this phone and you'll come straight back into Logga, signed in. Can't see it? Check your spam folder.
          </Text>

          {error ? <Text style={ca.error}>{error}</Text> : null}
          {message ? <Text style={ca.success}>{message}</Text> : null}

          <TouchableOpacity style={ca.createBtn} onPress={openMailApp} activeOpacity={0.85}>
            <Text style={ca.createTxt}>Open email app</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ca.secondaryBtn, resendIn > 0 && { opacity: 0.55 }]}
            onPress={handleResend}
            disabled={resendIn > 0}
            activeOpacity={0.8}
          >
            <Text style={ca.secondaryTxt}>{resendIn > 0 ? `Resend email in ${resendIn}s` : 'Resend email'}</Text>
          </TouchableOpacity>

          <Text style={ca.terms}>
            Wrong email?{' '}
            <Text style={ca.link} onPress={() => { setMode('signup'); setScreen('auth'); }}>Start over</Text>
            {'   ·   '}
            Already confirmed?{' '}
            <Text style={ca.link} onPress={() => { setMode('login'); setScreen('auth'); }}>Log in</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Create account screen (post-onboarding signup) ──────────────────────────
  if (mode === 'signup') {
    const shownName = displayName(name);
    return (
      <KeyboardAvoidingView style={ca.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ca.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthTop onBack={() => setScreen('onboarding')} />

          <Text style={ca.eyebrow}>LAST STEP</Text>
          <Text style={ca.headline}>
            Save your plan{shownName ? ', ' : '.'}
            {shownName ? <Text style={ca.headlineAccent}>{shownName}.</Text> : null}
          </Text>
          <Text style={ca.subtitle}>A free account keeps your goal, meals and streak safe, and on every device you use.</Text>

          <View style={ca.perks}>
            {['Free forever', 'Takes 20 seconds', 'Your data stays yours'].map((p) => (
              <View key={p} style={ca.perk}>
                <Ionicons name="checkmark" size={13} color="#059669" />
                <Text style={ca.perkTxt}>{p}</Text>
              </View>
            ))}
          </View>

          {socialButtons}

          <View style={ca.divider}>
            <View style={ca.divLine} />
            <Text style={ca.divTxt}>OR USE EMAIL</Text>
            <View style={ca.divLine} />
          </View>

          {emailField}
          {passwordField('Create a password', true)}

          {error ? <Text style={ca.error}>{error}</Text> : null}
          {message ? <Text style={ca.success}>{message}</Text> : null}

          <TouchableOpacity style={[ca.createBtn, loading && { opacity: 0.6 }]} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={ca.createTxt}>Create account</Text>}
          </TouchableOpacity>

          <Text style={ca.terms}>
            Already have an account?{' '}
            <Text style={ca.link} onPress={() => { setError(''); setMessage(''); setMode('login'); }}>Log in</Text>
          </Text>
          <Text style={[ca.terms, { marginTop: 10, fontSize: 12 }]}>
            By continuing you agree to our{' '}
            <Text style={ca.link} onPress={() => openLegal('terms')}>Terms</Text>
            {' '}and{' '}
            <Text style={ca.link} onPress={() => openLegal('privacy')}>Privacy Policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Log in screen ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={ca.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ca.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AuthTop onBack={() => setScreen('onboarding')} />

        <Text style={ca.eyebrow}>WELCOME BACK</Text>
        <Text style={ca.headline}>Log back in.</Text>
        <Text style={ca.subtitle}>Pick up right where you left off.</Text>

        {socialButtons}

        <View style={ca.divider}>
          <View style={ca.divLine} />
          <Text style={ca.divTxt}>OR USE EMAIL</Text>
          <View style={ca.divLine} />
        </View>

        {emailField}
        {passwordField('Your password', false)}

        {error ? <Text style={ca.error}>{error}</Text> : null}
        {message ? <Text style={ca.success}>{message}</Text> : null}

        <TouchableOpacity style={[ca.createBtn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={ca.createTxt}>Log in</Text>}
        </TouchableOpacity>

        <Text style={ca.terms}>
          Don't have an account?{' '}
          <Text style={ca.link} onPress={() => setScreen('onboarding')}>Start here</Text>
        </Text>
      </ScrollView>

      {/* Shown when they try to log in before tapping the confirmation link in their email. */}
      <Modal visible={pendingModal} transparent animationType="fade" onRequestClose={() => setPendingModal(false)}>
        <View style={ca.modalBackdrop}>
          <View style={ca.modalCard}>
            <View style={ca.modalIcon}>
              <Ionicons name="mail-unread-outline" size={30} color="#059669" />
            </View>
            <Text style={ca.modalTitle}>Confirm your email first</Text>
            <Text style={ca.modalBody}>
              <Text style={{ fontWeight: '700', color: '#10201a' }}>{confirmEmail}</Text> is waiting for confirmation.
              {'\n\n'}Go to your inbox and tap the link we sent, then come back and log in. Can't find it? Check your spam folder.
            </Text>

            {error ? <Text style={[ca.error, { marginTop: 0, marginBottom: 12 }]}>{error}</Text> : null}
            {message ? <Text style={[ca.success, { marginTop: 0, marginBottom: 12 }]}>{message}</Text> : null}

            <TouchableOpacity style={[ca.createBtn, { marginTop: 4 }]} onPress={openMailApp} activeOpacity={0.85}>
              <Text style={ca.createTxt}>Open email app</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ca.secondaryBtn, resendIn > 0 && { opacity: 0.55 }]}
              onPress={handleResend}
              disabled={resendIn > 0}
              activeOpacity={0.8}
            >
              <Text style={ca.secondaryTxt}>{resendIn > 0 ? `Resend email in ${resendIn}s` : 'Resend email'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setPendingModal(false); setError(''); setMessage(''); }} style={{ paddingVertical: 14 }}>
              <Text style={[ca.terms, { marginTop: 0 }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F4F1EA' },
  scroll: { flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  authBackBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', marginBottom: 12,
  },
  authDoodleWrap: { width: '100%', height: 200, marginBottom: 16, borderRadius: 24, overflow: 'hidden' },
  onboardingContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  onboardingScroll: { flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 32 },
  authLogoImage: { width: 80, height: 80, borderRadius: 16, marginBottom: 12, resizeMode: 'contain' },
  appName: { fontSize: 28, fontWeight: '800', color: '#064E3B', marginBottom: 4 },
  tagline: { fontSize: 14, color: '#6B7280' },
  authTitle: {
    fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 16,
    textAlign: 'center', fontFamily: 'Inter, sans-serif', alignSelf: 'center',
  },
  card: {
    backgroundColor: '#F4F1EA', borderRadius: 20, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111',
    backgroundColor: '#FAFAFA',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center' },
  inputPassword: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111',
    backgroundColor: '#FAFAFA',
  },
  eyeBtn: { position: 'absolute', right: 14 },
  fieldHint: { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginLeft: 2 },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  successMsg: { color: '#059669', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  socialBtnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 15,
    marginBottom: 12, gap: 10,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  socialBtnGoogleText: { fontSize: 15, fontWeight: '600', color: '#111', fontFamily: 'Inter, sans-serif' },
  socialBtnApple: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111111', borderRadius: 14, paddingVertical: 15,
    marginBottom: 4, gap: 10,
  },
  socialBtnAppleText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Inter, sans-serif' },
  emailToggle: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10,
  },
  emailToggleLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  emailToggleText: { fontSize: 12, color: 'rgba(0,0,0,0.35)', fontWeight: '400', fontFamily: 'Inter, sans-serif' },
  btn: {
    backgroundColor: '#0F9D78', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter, sans-serif' },
  modeToggle: { marginTop: 20, alignItems: 'center' },
  modeToggleText: { fontSize: 13, color: 'rgba(0,0,0,0.4)' },
  modeToggleLink: { color: '#0F9D78', fontWeight: '600' },
  footer: { textAlign: 'center', marginTop: 24, color: '#9CA3AF', fontSize: 12 },
});

