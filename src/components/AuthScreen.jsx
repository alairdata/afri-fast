import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { supabase } from '../lib/supabase';
import PreAuthOnboarding from './PreAuthOnboarding';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function AuthScreen({ preAuthData, onSavePreAuthData }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState(preAuthData?.preferredName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState({});
  const [screen, setScreen] = useState(preAuthData?.completedAt ? 'auth' : 'gate'); // 'gate' | 'onboarding' | 'auth'
  const [heroIndex, setHeroIndex] = useState(0);

  const heroImages = [
    require('../../assets/gate-hero.png'),
    require('../../assets/gate-hero-2.png'),
    require('../../assets/gate-hero-3.png'),
  ];

  const heroScrollRef = useRef(null);

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
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setHeroIndex(index);
            }}
            style={styles.gateHeroScroll}
          >
            {heroImages.map((img, i) => (
              <Image key={i} source={img} style={styles.gateHeroImage} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={styles.gateHeroPill}>
            <Text style={styles.gateHeroPillText}>Break your fast with{'\n'}food that knows{'\n'}your roots.</Text>
          </View>
          <View style={styles.gateHeroDots}>
            {heroImages.map((_, i) => (
              <View key={i} style={[styles.gateHeroDot, i === heroIndex && styles.gateHeroDotActive]} />
            ))}
          </View>
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

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.authLogoImage}
          />
          <Text style={styles.appName}>Afri Fast</Text>
          <Text style={styles.tagline}>Your African wellness companion</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.authTitle}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>

          {/* Fields */}
          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, touched.name && !name && styles.inputError]}
                placeholder="e.g. Amara Osei"
                placeholderTextColor="#aaa"
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
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={(v) => { setEmail(v); setTouched(t => ({ ...t, email: true })); }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, touched.password && !password && styles.inputError]}
              placeholder="••••••••"
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={(v) => { setPassword(v); setTouched(t => ({ ...t, password: true })); }}
              secureTextEntry
            />
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

        <Text style={styles.footer}>Eat well. Fast well. Live well. 🌍</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Gate screen
  gateContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  gateHeroWrap: { width: '100%', height: '58%', position: 'relative' },
  gateHeroScroll: { width: '100%', height: '100%' },
  gateHeroImage: { width: SCREEN_WIDTH, height: '100%' },
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
    fontWeight: '500',
    lineHeight: 20,
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
  gateAppName: { fontSize: 26, fontWeight: '700', color: '#111', marginBottom: 4 },
  gateTagline: { fontSize: 13, color: 'rgba(0,0,0,0.4)', fontWeight: '300' },
  gateCard: {
    flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#fff',
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

  container: { flex: 1, backgroundColor: '#F0FDF4' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  onboardingContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  onboardingScroll: { flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 32 },
  authLogoImage: { width: 80, height: 80, borderRadius: 16, marginBottom: 12, resizeMode: 'contain' },
  appName: { fontSize: 28, fontWeight: '800', color: '#064E3B', marginBottom: 4 },
  tagline: { fontSize: 14, color: '#6B7280' },
  authTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111',
    backgroundColor: '#FAFAFA',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  fieldHint: { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginLeft: 2 },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  successMsg: { color: '#059669', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', marginTop: 32, color: '#9CA3AF', fontSize: 13 },
});
