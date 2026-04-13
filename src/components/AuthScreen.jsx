import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
  Animated, Easing, useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../lib/supabase';
import PreAuthOnboarding from './PreAuthOnboarding';
import Ionicons from '@expo/vector-icons/Ionicons';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DOODLE_SHAPES = [
  // Bowl body
  { d: 'M 80 158 Q 170 122 260 158 L 252 182 Q 170 212 88 182 Z', length: 370, delay: 0, strokeWidth: 2.5 },
  // Steam 1
  { d: 'M 143 120 C 130 100 150 84 138 64', length: 78, delay: 520, strokeWidth: 2 },
  // Steam 2
  { d: 'M 170 117 C 157 97 177 81 165 61', length: 78, delay: 680, strokeWidth: 2 },
  // Steam 3
  { d: 'M 197 120 C 184 100 204 84 192 64', length: 78, delay: 840, strokeWidth: 2 },
  // Leaf top-left
  { d: 'M 36 50 C 14 72 20 110 48 114 C 76 110 82 72 60 50 C 54 43 42 46 36 50', length: 168, delay: 180, strokeWidth: 2 },
  // Leaf stem
  { d: 'M 48 114 L 48 138', length: 24, delay: 348, strokeWidth: 2 },
  // S-curve right
  { d: 'M 298 65 C 316 83 298 108 316 126 C 334 144 316 166 298 184', length: 148, delay: 280, strokeWidth: 2 },
  // Small leaf bottom-right
  { d: 'M 290 205 C 272 185 280 162 300 169 C 312 174 307 198 290 205', length: 108, delay: 740, strokeWidth: 2 },
  // Decorative dot cluster top-right
  { d: 'M 268 38 C 268 34 272 34 272 38 C 272 42 268 42 268 38', length: 14, delay: 950, strokeWidth: 2.5 },
  { d: 'M 280 28 C 280 24 284 24 284 28 C 284 32 280 32 280 28', length: 14, delay: 1020, strokeWidth: 2.5 },
  { d: 'M 292 40 C 292 36 296 36 296 40 C 296 44 292 44 292 40', length: 14, delay: 1090, strokeWidth: 2.5 },
];

function DoodleHero() {
  const anims = useRef(DOODLE_SHAPES.map(s => new Animated.Value(s.length))).current;

  useEffect(() => {
    const timeouts = [];
    const running = [];

    DOODLE_SHAPES.forEach((shape, i) => {
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
      <Svg width="100%" height="100%" viewBox="0 0 340 240" preserveAspectRatio="xMidYMid meet">
        {DOODLE_SHAPES.map((shape, i) => (
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

const doodleStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  const [screen, setScreen] = useState(preAuthData?.completedAt ? 'auth' : 'gate'); // 'gate' | 'onboarding' | 'auth'
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError(''); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true });
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError(''); setMessage('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, name, email });
      if (profileError) console.error('[DB Error - create profile]', profileError);
    }
    setMessage('Account created! Check your email to confirm, then log in.');
    setMode('login');
    setLoading(false);
  };

  if (screen === 'gate') {
    return (
      <View style={styles.gateContainer}>
        <View style={styles.gateHeroWrap}>
          <DoodleHero />
        </View>
        <View style={styles.gateInner}>
          <View style={styles.gateLogoWrap}>
            <Text style={styles.gateAppName}>Afri Fast</Text>
            <Text style={styles.gateTagline}>Your African wellness companion</Text>
          </View>

          <TouchableOpacity
            style={styles.gateCard}
            onPress={() => { setMode('login'); setScreen('auth'); }}
            activeOpacity={0.85}
          >
            <View style={styles.gateCardIcon}>
              <Ionicons name="person-outline" size={20} color="#111" />
            </View>
            <View style={styles.gateCardText}>
              <Text style={styles.gateCardTitle}>I already have an account</Text>
              <Text style={styles.gateCardSub}>Take me straight to log in</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.25)" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gateCard}
            onPress={() => setScreen('onboarding')}
            activeOpacity={0.85}
          >
            <View style={styles.gateCardIcon}>
              <Ionicons name="leaf-outline" size={20} color="#111" />
            </View>
            <View style={styles.gateCardText}>
              <Text style={styles.gateCardTitle}>I'm new here</Text>
              <Text style={styles.gateCardSub}>Let's set up your profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.25)" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'onboarding') {
    return (
      <KeyboardAvoidingView style={styles.onboardingContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.onboardingScroll} keyboardShouldPersistTaps="handled">
          <PreAuthOnboarding
            initialData={preAuthData}
            onComplete={async (answers) => {
              await onSavePreAuthData?.(answers);
              setName(answers.preferredName || '');
              setMode('signup');
              setScreen('auth');
            }}
            onSkip={async () => {
              const skippedData = { ...(preAuthData || {}), skipped: true, completedAt: Date.now() };
              await onSavePreAuthData?.(skippedData);
              setMode('signup');
              setScreen('auth');
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Back button */}
        <TouchableOpacity style={styles.authBackBtn} onPress={() => setScreen('gate')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="rgba(0,0,0,0.5)" />
        </TouchableOpacity>

        {/* Doodle header */}
        <View style={styles.authDoodleWrap}>
          <DoodleAuth />
        </View>

        {/* Title outside card */}
        <Text style={styles.authTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>

        {/* Card */}
        <View style={styles.card}>

          {/* Google button */}
          <TouchableOpacity style={styles.socialBtnGoogle} activeOpacity={0.85}>
            <Ionicons name="logo-google" size={20} color="#444" />
            <Text style={styles.socialBtnGoogleText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple button */}
          <TouchableOpacity style={styles.socialBtnApple} activeOpacity={0.85}>
            <Ionicons name="logo-apple" size={22} color="#fff" />
            <Text style={styles.socialBtnAppleText}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Email toggle */}
          <TouchableOpacity
            style={styles.emailToggle}
            onPress={() => setShowEmailForm(v => !v)}
            activeOpacity={0.7}
          >
            <View style={styles.emailToggleLine} />
            <Text style={styles.emailToggleText}>
              {showEmailForm ? 'hide email sign in' : 'or continue with email'}
            </Text>
            <View style={styles.emailToggleLine} />
          </TouchableOpacity>

          {/* Email form — hidden by default */}
          {showEmailForm && (
            <View>
              {mode === 'signup' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={[styles.input, touched.name && !name && styles.inputError]}
                    placeholder="e.g. Amara Osei"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={(v) => { setName(v); setTouched(t => ({ ...t, name: true })); }}
                    autoCapitalize="words"
                  />
                </View>
              )}
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, touched.email && !email && styles.inputError]}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setTouched(t => ({ ...t, email: true })); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.inputPassword, touched.password && !password && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={(v) => { setPassword(v); setTouched(t => ({ ...t, password: true })); }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(0,0,0,0.35)" />
                  </TouchableOpacity>
                </View>
                {mode === 'signup' && (
                  <Text style={[styles.fieldHint, touched.password && password.length > 0 && password.length < 8 && { color: '#EF4444' }]}>
                    {touched.password && password.length > 0 && password.length < 8
                      ? `${password.length}/8 characters minimum`
                      : 'Minimum 8 characters'}
                  </Text>
                )}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.successMsg}>{message}</Text> : null}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={mode === 'login' ? handleLogin : handleSignUp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.footer}>Eat well. Fast well. Live well. 🌍</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Gate screen
  gateContainer: { flex: 1, backgroundColor: '#F4F1EA' },
  gateHeroWrap: {
    marginHorizontal: 16,
    height: '58%',
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gateHeroScroll: { width: '100%', height: '100%' },
  gateHeroImage: { height: '100%' },
  gateHeroPill: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    maxWidth: '65%',
  },
  gateHeroPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'Inter, sans-serif',
  },
  gateHeroDots: {
    position: 'absolute',
    bottom: 18,
    right: 18,
    flexDirection: 'row',
    gap: 6,
  },
  gateHeroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  gateHeroDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
  gateInner: { flex: 1, justifyContent: 'center', paddingHorizontal: 26, paddingBottom: 40, paddingTop: 20 },
  gateLogoWrap: { alignItems: 'center', marginBottom: 24 },
  gateAppName: { fontSize: 26, fontWeight: '700', color: '#0F9D78', marginBottom: 4, fontFamily: 'Inter, sans-serif' },
  gateTagline: { fontSize: 13, color: 'rgba(0,0,0,0.4)', fontWeight: '300' },
  gateCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#FDFCF8',
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  gateCardIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  gateCardText: { flex: 1 },
  gateCardTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  gateCardSub: { fontSize: 12, color: 'rgba(0,0,0,0.4)', fontWeight: '300' },

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
