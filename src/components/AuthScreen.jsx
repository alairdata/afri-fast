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


// ── Create-account screen styles ──────────────────────────────────────────────
const ca = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbf7' },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: Platform.OS === 'ios' ? 58 : 40, paddingBottom: 40 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    textAlign: 'center', fontSize: 12, fontWeight: '700',
    color: '#059669', letterSpacing: 1.5, marginBottom: 8,
  },
  headline: {
    textAlign: 'center', fontSize: 28, fontWeight: '800',
    color: '#16201b', marginBottom: 10, letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center', fontSize: 14, color: 'rgba(0,0,0,0.45)',
    lineHeight: 20, marginBottom: 28,
  },
  appleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111', borderRadius: 14, paddingVertical: 15,
    gap: 10, marginBottom: 10,
  },
  appleTxt: { fontSize: 15, fontWeight: '600', color: '#fff' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15,
    gap: 10, marginBottom: 4,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.09)',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  googleTxt: { fontSize: 15, fontWeight: '600', color: '#111' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,0,0,0.09)' },
  divTxt: { fontSize: 11, fontWeight: '600', color: 'rgba(0,0,0,0.3)', letterSpacing: 0.8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f4f4ee', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  inputRowErr: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 10 },
  inputTxt: { flex: 1, fontSize: 15, color: '#16201b' },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 10 },
  success: { color: '#059669', fontSize: 13, textAlign: 'center', marginTop: 10 },
  createBtn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  createTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: {
    textAlign: 'center', marginTop: 16,
    fontSize: 12, color: 'rgba(0,0,0,0.35)', lineHeight: 18,
  },
});

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
  const [screen, setScreen] = useState(preAuthData?.completedAt ? 'auth' : 'onboarding');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true); setError(''); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Check if this email exists in our profiles table
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('email', email.trim().toLowerCase());
      if (count === 0) {
        // No account found — send them to onboarding
        setLoading(false);
        setError('');
        setScreen('onboarding');
        return;
      }
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setTouched({ name: true, email: true, password: true });
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError(''); setMessage('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        setError(`Hey! We already have an account for ${email.trim()}. Log in below instead.`);
        setMode('login');
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({ id: data.user.id, name, email });
      if (profileError) {
        console.error('[DB Error - create profile]', profileError);
        // Profile creation failed — delete the auth user to avoid orphaned accounts
        await supabase.auth.signOut();
        setError('Account setup failed. Please try again.');
        setLoading(false);
        return;
      }
    }
    setMessage('Account created! Check your email to confirm, then log in.');
    setMode('login');
    setLoading(false);
  };


  if (screen === 'onboarding') {
    return (
      <KeyboardAvoidingView style={styles.onboardingContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PreAuthOnboarding
          initialData={preAuthData}
          onLogin={() => { setMode('login'); setScreen('auth'); }}
          onComplete={async (answers) => {
            await onSavePreAuthData?.(answers);
            setName(answers.preferredName || '');
            setMode('signup');
            setScreen('auth');
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── Create account screen (post-onboarding signup) ──────────────────────────
  if (screen === 'auth' && mode === 'signup') {
    const firstName = name ? name.trim().split(' ')[0] : '';
    const initial = firstName ? `, ${firstName[0].toLowerCase()}.` : '.';
    const handleOAuth = async (provider) => {
      const redirectTo = typeof window !== 'undefined'
        ? (window.location.hostname === 'localhost' ? 'https://afri-fast.vercel.app' : window.location.origin)
        : 'https://afri-fast.vercel.app';
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('afri-fast-oauth-pending', '1');
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) setError(error.message);
    };
    return (
      <KeyboardAvoidingView style={ca.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ca.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Close */}
          <TouchableOpacity style={ca.closeBtn} onPress={() => setScreen('gate')} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color="rgba(0,0,0,0.45)" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 18 }} />
          </View>

          {/* Eyebrow */}
          <Text style={ca.eyebrow}>LAST STEP +</Text>

          {/* Headline + subtitle */}
          <Text style={ca.headline}>Save your plan{initial}</Text>
          <Text style={ca.subtitle}>
            Make a free account so AfriFast keeps your{'\n'}goal, meals and streak safe.
          </Text>

          {/* Apple */}
          <TouchableOpacity style={ca.appleBtn} activeOpacity={0.85} onPress={() => handleOAuth('apple')}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={ca.appleTxt}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity style={ca.googleBtn} activeOpacity={0.85} onPress={() => handleOAuth('google')}>
            <Ionicons name="logo-google" size={18} color="#444" />
            <Text style={ca.googleTxt}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={ca.divider}>
            <View style={ca.divLine} />
            <Text style={ca.divTxt}>OR SIGN UP WITH EMAIL</Text>
            <View style={ca.divLine} />
          </View>

          {/* Email field */}
          <View style={[ca.inputRow, touched.email && !email && ca.inputRowErr]}>
            <Ionicons name="mail-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
            <TextInput
              style={ca.inputTxt}
              placeholder="you@email.com"
              placeholderTextColor="rgba(0,0,0,0.3)"
              value={email}
              onChangeText={(v) => { setEmail(v); setTouched(t => ({ ...t, email: true })); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password field */}
          <View style={[ca.inputRow, { marginTop: 10 }, touched.password && !password && ca.inputRowErr]}>
            <Ionicons name="lock-closed-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
            <TextInput
              style={ca.inputTxt}
              placeholder="Create a password"
              placeholderTextColor="rgba(0,0,0,0.3)"
              value={password}
              onChangeText={(v) => { setPassword(v); setTouched(t => ({ ...t, password: true })); }}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ paddingLeft: 8 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(0,0,0,0.3)" />
            </TouchableOpacity>
          </View>

          {error ? <Text style={ca.error}>{error}</Text> : null}
          {message ? <Text style={ca.success}>{message}</Text> : null}

          {/* Create account */}
          <TouchableOpacity style={[ca.createBtn, loading && { opacity: 0.6 }]} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={ca.createTxt}>Create account →</Text>
            }
          </TouchableOpacity>

          {/* Terms */}
          <Text style={ca.terms}>
            By continuing you agree to AfriFast's Terms & Privacy{'\n'}Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const handleOAuthLogin = async (provider) => {
    const redirectTo = typeof window !== 'undefined'
      ? (window.location.hostname === 'localhost' ? 'https://afri-fast.vercel.app' : window.location.origin)
      : 'https://afri-fast.vercel.app';
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('afri-fast-oauth-pending', '1');
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) setError(error.message);
  };

  return (
    <KeyboardAvoidingView style={ca.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ca.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={ca.closeBtn} onPress={() => setScreen('onboarding')} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="rgba(0,0,0,0.45)" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Image source={require('../../assets/icon.png')} style={{ width: 72, height: 72, borderRadius: 18 }} />
        </View>

        <Text style={ca.eyebrow}>WELCOME BACK</Text>
        <Text style={ca.headline}>Log back in.</Text>
        <Text style={ca.subtitle}>Pick up right where you left off.</Text>

        <TouchableOpacity style={ca.appleBtn} activeOpacity={0.85} onPress={() => handleOAuthLogin('apple')}>
          <Ionicons name="logo-apple" size={20} color="#fff" />
          <Text style={ca.appleTxt}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity style={ca.googleBtn} activeOpacity={0.85} onPress={() => handleOAuthLogin('google')}>
          <Ionicons name="logo-google" size={18} color="#444" />
          <Text style={ca.googleTxt}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={ca.divider}>
          <View style={ca.divLine} />
          <Text style={ca.divTxt}>OR LOG IN WITH EMAIL</Text>
          <View style={ca.divLine} />
        </View>

        <View style={[ca.inputRow, touched.email && !email && ca.inputRowErr]}>
          <Ionicons name="mail-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
          <TextInput
            style={ca.inputTxt}
            placeholder="you@email.com"
            placeholderTextColor="rgba(0,0,0,0.3)"
            value={email}
            onChangeText={(v) => { setEmail(v); setTouched(t => ({ ...t, email: true })); }}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={[ca.inputRow, { marginTop: 10 }, touched.password && !password && ca.inputRowErr]}>
          <Ionicons name="lock-closed-outline" size={18} color="rgba(0,0,0,0.35)" style={ca.inputIcon} />
          <TextInput
            style={ca.inputTxt}
            placeholder="Your password"
            placeholderTextColor="rgba(0,0,0,0.3)"
            value={password}
            onChangeText={(v) => { setPassword(v); setTouched(t => ({ ...t, password: true })); }}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ paddingLeft: 8 }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="rgba(0,0,0,0.3)" />
          </TouchableOpacity>
        </View>

        {error ? <Text style={ca.error}>{error}</Text> : null}
        {message ? <Text style={ca.success}>{message}</Text> : null}

        <TouchableOpacity style={[ca.createBtn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={ca.createTxt}>Log in →</Text>}
        </TouchableOpacity>

        <Text style={ca.terms}>
          Don't have an account?{' '}
          <Text style={{ color: '#059669', fontWeight: '700' }} onPress={() => setScreen('onboarding')}>
            Start here
          </Text>
        </Text>
      </ScrollView>
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

