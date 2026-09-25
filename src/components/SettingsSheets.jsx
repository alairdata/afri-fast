import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

const APP_VERSION = '1.0.0';
const GREEN = '#059669';

function Sheet({ visible, onClose, title, children }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[st.sheet, { backgroundColor: colors.card }]}>
            <View style={st.handle} />
            <View style={st.header}>
              <Text style={[st.title, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity style={st.close} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
              {children}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Help & FAQ ─────────────────────────────────────────────────────────────────
const FAQ = [
  { q: 'How do I log a meal?', a: 'Tap the + button on the Today screen, then snap a photo, type what you ate, or say it out loud. Logga works out the calories and nutrients, and you can adjust the portions before you save.' },
  { q: 'How is my daily calorie target worked out?', a: "From your age, sex, height, weight, activity level, goal weight and pace. You can change any of them under Make it Yours, then Your Details. If your target should change, we'll suggest the new number and you choose whether to use it." },
  { q: 'What is the Momentum score?', a: 'A score from 0 to 100 for how well you are keeping up. It looks at how steady your eating has been, whether you are eating enough of the right things to keep going, and how much you move. It starts at 0 and comes alive once you log your first meal.' },
  { q: 'What does burnout risk mean?', a: "It's an early warning about how likely you are to drop off. It looks at things like eating far under or over your target, big swings from day to day, and low protein or water. A high number is a nudge to ease up, not a grade." },
  { q: 'Can I change my onboarding answers?', a: 'Yes. Go to Make it Yours, then Your Details, and tap any answer to update it. Changes save straight away.' },
  { q: 'How do I change my name, photo or country?', a: 'On the Settings screen, tap the pencil icon at the top to change your username and photo. Tap your country under your name to pick a different one.' },
  { q: 'How do reminders work?', a: "Turn on the meal logging reminder under Notifications and pick a time. Reminders work in the phone app; the website can't send them yet." },
  { q: 'How do I export or delete my data?', a: 'Both are under Data & Privacy. Export My Data gives you a file of everything you have logged. Clear History wipes your logs but keeps your account. Account Options lets you delete your account for good.' },
];

export function FaqSheet({ visible, onClose }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(null);
  return (
    <Sheet visible={visible} onClose={onClose} title="Help & FAQ">
      {FAQ.map((item, i) => (
        <View key={item.q} style={[st.faqItem, { borderTopColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}>
          <TouchableOpacity style={st.faqRow} onPress={() => setOpen(open === i ? null : i)} activeOpacity={0.7}>
            <Text style={[st.faqQ, { color: colors.text }]}>{item.q}</Text>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
          </TouchableOpacity>
          {open === i && <Text style={[st.faqA, { color: colors.textSecondary }]}>{item.a}</Text>}
        </View>
      ))}
    </Sheet>
  );
}

// ── Shared: send a row to the feedback table ───────────────────────────────────
async function sendFeedback({ userId, email, type, rating = null, message = null }) {
  if (!userId) return 'You need to be signed in.';
  const { error } = await supabase.from('feedback').insert({
    user_id: userId, type, rating, message, email: email || null, app_version: APP_VERSION,
  });
  if (error) {
    console.log('[Feedback] insert failed:', error.message);
    return "We couldn't send that right now. Please try again in a bit.";
  }
  return null;
}

// ── Contact Support ────────────────────────────────────────────────────────────
export function ContactSheet({ visible, onClose, userId, userEmail }) {
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) { setMessage(''); setError(''); setSent(false); setSending(false); }
  }, [visible]);

  const send = async () => {
    if (message.trim().length < 5) { setError('Tell us a little more so we can help.'); return; }
    setSending(true); setError('');
    const err = await sendFeedback({ userId, email: userEmail, type: 'support', message: message.trim() });
    setSending(false);
    if (err) setError(err); else setSent(true);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Contact Support">
      {sent ? (
        <View style={st.centerBlock}>
          <Ionicons name="checkmark-circle" size={44} color={GREEN} />
          <Text style={[st.bigText, { color: colors.text }]}>Message sent</Text>
          <Text style={[st.body, { color: colors.textSecondary, textAlign: 'center' }]}>
            Thanks for reaching out. We'll reply to {userEmail || 'your email'}.
          </Text>
          <TouchableOpacity style={st.primaryBtn} onPress={onClose}><Text style={st.primaryTxt}>Done</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={[st.body, { color: colors.textSecondary }]}>
            Something not working, or an idea to share? Tell us and we'll get back to you{userEmail ? ` at ${userEmail}` : ''}.
          </Text>
          <TextInput
            style={[st.textArea, { color: colors.text, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder="What's on your mind?"
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          {error ? <Text style={st.error}>{error}</Text> : null}
          <TouchableOpacity style={[st.primaryBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryTxt}>Send message</Text>}
          </TouchableOpacity>
        </>
      )}
    </Sheet>
  );
}

// ── Rate the App ───────────────────────────────────────────────────────────────
export function RateSheet({ visible, onClose, userId, userEmail }) {
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (visible) { setRating(0); setComment(''); setError(''); setSent(false); setSending(false); }
  }, [visible]);

  const send = async () => {
    if (!rating) { setError('Tap a star to rate.'); return; }
    setSending(true); setError('');
    const err = await sendFeedback({ userId, email: userEmail, type: 'rating', rating, message: comment.trim() || null });
    setSending(false);
    if (err) setError(err); else setSent(true);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Rate Logga">
      {sent ? (
        <View style={st.centerBlock}>
          <Ionicons name="heart" size={44} color={GREEN} />
          <Text style={[st.bigText, { color: colors.text }]}>Thank you!</Text>
          <Text style={[st.body, { color: colors.textSecondary, textAlign: 'center' }]}>Your feedback helps us make Logga better.</Text>
          <TouchableOpacity style={st.primaryBtn} onPress={onClose}><Text style={st.primaryTxt}>Done</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={[st.body, { color: colors.textSecondary, textAlign: 'center' }]}>How is Logga working for you?</Text>
          <View style={st.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => { setRating(n); setError(''); }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={38} color={n <= rating ? '#F59E0B' : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[st.textArea, { minHeight: 90, color: colors.text, borderColor: colors.border }]}
            value={comment}
            onChangeText={setComment}
            placeholder="Anything you'd like to add? (optional)"
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          {error ? <Text style={st.error}>{error}</Text> : null}
          <TouchableOpacity style={[st.primaryBtn, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryTxt}>Submit</Text>}
          </TouchableOpacity>
        </>
      )}
    </Sheet>
  );
}

// ── Privacy Settings ───────────────────────────────────────────────────────────
export function PrivacySheet({ visible, onClose, shareCommunityPhotos, onToggleShare }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Privacy Settings">
      <View style={st.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[st.toggleLabel, { color: colors.text }]}>Share meal photos with the community</Text>
          <Text style={[st.toggleDesc, { color: colors.textMuted }]}>
            When on, photos of meals you log can appear in the recipe community gallery. Turn it off to keep them private.
          </Text>
        </View>
        <Switch
          value={!!shareCommunityPhotos}
          onValueChange={onToggleShare}
          trackColor={{ false: '#D1D5DB', true: GREEN }}
          thumbColor="#fff"
        />
      </View>
      <View style={[st.infoBox, { backgroundColor: colors.bg }]}>
        <Ionicons name="lock-closed-outline" size={18} color={GREEN} />
        <Text style={[st.infoTxt, { color: colors.textSecondary }]}>
          Your meals, weight, water and check-ins are only visible to you. You can export or delete everything at any time under Data & Privacy.
        </Text>
      </View>
    </Sheet>
  );
}

// ── Clear History ──────────────────────────────────────────────────────────────
export function ClearHistorySheet({ visible, onClose, onConfirm }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setText(''); setBusy(false); setError(''); }
  }, [visible]);

  const ready = text.trim().toUpperCase() === 'CLEAR' && !busy;

  const go = async () => {
    setBusy(true); setError('');
    const err = await onConfirm();
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Clear history?">
      <Text style={[st.body, { color: colors.textSecondary }]}>
        This permanently deletes your logged meals, weigh-ins, water, check-ins, steps and activities. Your account, details and goals stay. This cannot be undone.
      </Text>
      <Text style={[st.body, { color: colors.textSecondary, marginBottom: 8 }]}>
        Type <Text style={{ fontWeight: '800', color: '#DC2626' }}>CLEAR</Text> to confirm.
      </Text>
      <TextInput
        style={[st.input, { color: colors.text, borderColor: colors.border }]}
        value={text}
        onChangeText={setText}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="CLEAR"
        placeholderTextColor="#9CA3AF"
      />
      {error ? <Text style={st.error}>{error}</Text> : null}
      <TouchableOpacity style={[st.dangerBtn, !ready && { opacity: 0.35 }]} disabled={!ready} onPress={go}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={st.primaryTxt}>Yes, clear my history</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={st.cancel} onPress={onClose}><Text style={st.cancelTxt}>Cancel</Text></TouchableOpacity>
    </Sheet>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  faqItem: { borderTopWidth: 1 },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
  faqQ: { flex: 1, fontSize: 15, fontWeight: '600' },
  faqA: { fontSize: 14, lineHeight: 21, paddingBottom: 14 },
  textArea: { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 15, minHeight: 130, marginBottom: 12 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 10 },
  primaryBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dangerBtn: { backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  centerBlock: { alignItems: 'center', paddingVertical: 10, gap: 8 },
  bigText: { fontSize: 20, fontWeight: '800' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, marginBottom: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  infoBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, alignItems: 'flex-start' },
  infoTxt: { flex: 1, fontSize: 13, lineHeight: 19 },
});
