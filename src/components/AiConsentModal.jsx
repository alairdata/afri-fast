import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Switch, Platform, Linking } from 'react-native';
import { loadConsent, saveConsent, setAiConsentAsker } from '../lib/consent';

const INK = '#16201b';
const INK500 = '#6c7872';
const GREEN = '#059669';
const LINE = '#e9e9e1';

// "How Logga uses AI and your data" (App Store guideline 5.1.2(i): name the third-party AI, say what is sent,
// and get explicit permission first). Shown once after sign-in; AI features also bring it back if they're
// tapped while AI is off.
const AiConsentModal = ({ signedIn }) => {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const pending = useRef(null);

  // First time after sign-in, ask once.
  useEffect(() => {
    if (!signedIn) return;
    loadConsent().then((c) => {
      if (c.ai == null) {
        setAnalytics(c.analytics !== false);
        setVisible(true);
      }
    });
  }, [signedIn]);

  // AI features call ensureAiConsent(), which opens this and waits for the answer.
  useEffect(() => {
    setAiConsentAsker(() => new Promise((resolve) => {
      pending.current = resolve;
      loadConsent().then((c) => { setAnalytics(c.analytics !== false); setVisible(true); });
    }));
    return () => setAiConsentAsker(null);
  }, []);

  const finish = async (allowAi) => {
    await saveConsent({ ai: allowAi, analytics });
    setVisible(false);
    if (pending.current) { pending.current(allowAi); pending.current = null; }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={() => finish(false)}>
      <View style={[styles.page, Platform.OS === 'android' && { paddingTop: 44 }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}><Ionicons name="sparkles-outline" size={26} color={GREEN} /></View>
          <Text style={styles.title}>How Logga uses AI</Text>
          <Text style={styles.body}>
            To estimate the calories in your meals and write your insights, Logga sends some of your data to outside AI services, only to create a response for you. Logga never uses your data for advertising.
          </Text>

          <View style={styles.card}>
            <Text style={styles.provider}>Google Gemini</Text>
            <Text style={styles.what}>Meal photos, voice notes and food descriptions you log, and short summaries of your logs to explain your scores.</Text>
            <View style={styles.divider} />
            <Text style={styles.provider}>Anthropic Claude</Text>
            <Text style={styles.what}>Your messages to the coach, and a summary of your recent logs (meals, weight, water, steps, activities, check-ins and goals) for your daily insight.</Text>
          </View>

          <Text style={styles.small}>
            Without AI you can still log meals by typing them in, and track your weight, water and steps. You can change this any time in Settings › Privacy Settings.
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleLabel}>Share anonymous usage stats</Text>
              <Text style={styles.toggleSub}>How the app is used, like which features you open and how many meals you log (through Mixpanel), so we can improve Logga. Never your photos, voice notes or what you wrote.</Text>
            </View>
            <Switch value={analytics} onValueChange={setAnalytics} trackColor={{ false: '#D1D5DB', true: GREEN }} thumbColor="#fff" />
          </View>

          <TouchableOpacity onPress={() => Linking.openURL('https://www.logga.space/privacy').catch(() => {})}>
            <Text style={styles.link}>Read our Privacy Policy</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.allowBtn} onPress={() => finish(true)} activeOpacity={0.85}>
            <Text style={styles.allowTxt}>Allow AI features</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notNow} onPress={() => finish(false)} activeOpacity={0.7}>
            <Text style={styles.notNowTxt}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 24, paddingTop: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(5,150,105,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5, marginTop: 16 },
  body: { fontSize: 15, lineHeight: 22, color: INK500, marginTop: 10 },
  card: { marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  provider: { fontSize: 15, fontWeight: '700', color: INK },
  what: { fontSize: 13.5, lineHeight: 19, color: INK500, marginTop: 4 },
  divider: { height: 1, backgroundColor: LINE, marginVertical: 12 },
  small: { fontSize: 13, lineHeight: 19, color: INK500, marginTop: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE },
  toggleLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  toggleSub: { fontSize: 12.5, lineHeight: 17, color: INK500, marginTop: 2 },
  link: { fontSize: 13.5, fontWeight: '700', color: GREEN, marginTop: 18 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 22, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: '#F8FAFC' },
  allowBtn: { height: 54, borderRadius: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  allowTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  notNow: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  notNowTxt: { color: INK500, fontSize: 15, fontWeight: '600' },
});

export default AiConsentModal;
