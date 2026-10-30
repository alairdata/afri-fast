import { ensureAiConsent, AiConsentError } from '../lib/consent';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Animated, Image, Keyboard } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import FormattedText from '../lib/FormattedText';
import { coachGreeting } from '../lib/lumiVoice';
import HeaderFade, { useHeaderFadeScroll } from './HeaderFade';
import { useVoiceInput } from '../lib/useVoiceInput';
import { aiHeaders } from '../lib/aiAuth';

const INK = '#1F1F1F';
const MUTED = '#6B7280';

// Ask Logga's start screen, as on Fit it in: when it's the right tool
const ASK_WHEN = [
  ['restaurant-outline', 'You ate out', 'A chop bar, a party, a friend\u2019s cooking'],
  ['chatbubbles-outline', 'It\u2019s hard to describe', '\u201cRice with a bit of stew and two pieces of chicken\u201d'],
  ['help-circle-outline', 'You want it exact', 'Fried or grilled, bone in, weighed raw: Logga asks'],
];

// A photo as base64 JPEG, made smaller first on phones so it sends quickly
async function photoBase64(uri) {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) return uri.split(',')[1];
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 900 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  return FileSystem.readAsStringAsync(small.uri, { encoding: 'base64' });
}

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(450 - i * 150),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 6, gap: 5 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 7, height: 7, borderRadius: 4, backgroundColor: '#059669',
          opacity: dot,
          transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) }],
        }} />
      ))}
    </View>
  );
}


const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const API_URL = `${BASE}/api/chat`;

async function callChat(body) {
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError(); // no consent, nothing goes to AI
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Chat API error');
  return json;
}


const SUGGESTIONS = [
  'Why am I always hungry?',
  'Am I meeting my goals?',
  'Best foods for fat loss?',
  'How is my progress?',
  'How to manage cravings?',
];

const ChatScreen = ({
  show,
  onClose,
  variant = 'coach',
  messages,
  setMessages,
  openingContext,
  userId,
  userName,
  userCountry,
  selectedPlan,
  goal,
  conditions,
  targetWeight,
  startingWeight,
  weightUnit,
  dailyCalorieGoal,
  hydrationGoal,
  volumeUnit,
  proteinGoal,
  carbsGoal,
  fatsGoal,
  fastingSessions,
  checkInHistory,
  recentMeals,
  weightLogs,
  waterLogs,
  personality,
  coachTone,
  onUpdatePersonality,
  goalHistory,
  goalSource,
  onLogMealFromChat,
}) => {
  // These screens are full-screen layers that sit BELOW the top of the phone (under the notch area), but the
  // keyboard measures from the top of the screen. Without telling it about that gap it lifts the input by too
  // little and the keyboard still covers part of what you type.
  const safeInsets = useSafeAreaInsets();
  const keyboardOffset = Platform.OS === 'ios' ? safeInsets.top : 0;

  const [chatInput, setChatInput] = useState('');
  const [photo, setPhoto] = useState(null);
  // When the keyboard opens, jump to the latest message so it stays in view above the keyboard.
  useEffect(() => {
    if (!show) return undefined;
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80));
    return () => sub.remove();
  }, [show]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);
  const pageFade = useHeaderFadeScroll();
  const lastOpeningContextRef = useRef(null);
  const isMeals = variant === 'meals';
  // Ask Logga opens on its start screen (Perfect for when, Recents, New chat); the conversation shows once started.
  const [started, setStarted] = useState(!isMeals);
  useEffect(() => { if (show && isMeals) setStarted(false); }, [show, isMeals]);
  const hasConversation = messages.some((m) => m.role === 'user');
  const askRecents = isMeals
    ? (recentMeals || []).filter((m) => m.method === 'chat').sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at)).slice(0, 3)
    : [];
  const whenLabel = (iso) => {
    const d = new Date(iso), today = new Date();
    const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const startChat = (prefill = '') => {
    setMessages([{ role: 'assistant', content: 'What are you thinking about your meal today?' }]);
    setChatInput(prefill);
    setPhoto(null);
    setStarted(true);
  };
  const { voice, voiceNote, startVoice, stopVoice } = useVoiceInput({ text: chatInput, setText: setChatInput, active: show });
  const caloriesLeft = (() => {
    const day = new Date().toDateString();
    const eaten = (recentMeals || []).filter((m) => m.date === day).reduce((sum, m) => sum + (m.calories || 0), 0);
    return Math.max(0, (dailyCalorieGoal || 0) - eaten);
  })();

  const enrichedMealLogs = (recentMeals || []).map(meal => {
    const ci = (checkInHistory || []).find(c => c.date === meal.date) || null;
    return {
      date: meal.date,
      mealName: meal.name,
      totalCalories: meal.calories || 0,
      ingredients: meal.foods || [],
      feelings: ci?.feelings || [],
      moods: ci?.moods || [],
      fastingStatus: ci?.fastingStatus || null,
      hungerLevel: ci?.hungerLevel || null,
      symptoms: ci?.symptoms || [],
      activities: ci?.activities || [],
      otherFactors: ci?.otherFactors || [],
    };
  });

  const userData = {
    userName, userCountry, selectedPlan, goal, conditions,
    targetWeight, startingWeight, weightUnit,
    dailyCalorieGoal, hydrationGoal, volumeUnit,
    proteinGoal, carbsGoal, fatsGoal,
    fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs,
    enrichedMealLogs,
    goalHistory: goalHistory || [],
    goalSource: goalSource || 'system',
    coachTone: coachTone || null,
  };

  // When chat closes with enough messages, update personality in background
  const prevShowRef = useRef(show);
  useEffect(() => {
    const wasOpen = prevShowRef.current;
    prevShowRef.current = show;
    if (wasOpen && !show && !isMeals && messages.length >= 3 && onUpdatePersonality) {
      const conversation = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
        .join('\n');
      callChat({
        action: 'update_personality',
        conversation,
        personality,
        data: userData,
      }).then(res => {
        if (res.personality) onUpdatePersonality(res.personality);
      }).catch(() => {});
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;

    if (openingContext) {
      const contextChanged = openingContext !== lastOpeningContextRef.current;
      lastOpeningContextRef.current = openingContext;

      if (contextChanged) {
        // New insight card — start a fresh conversation
        setMessages([]);
        setIsTyping(true);
        callChat({
          action: 'message',
          variant,
          messages: [],
          openingContext,
          personality,
          data: userData,
          userId,
        }).then(res => {
          setMessages([{ role: 'assistant', content: res.reply || openingContext }]);
        }).catch(() => {
          setMessages([{ role: 'assistant', content: openingContext }]);
        }).finally(() => setIsTyping(false));
      }
      // Same insight card — keep existing messages, do nothing

    } else if (messages.length === 0) {
      const greeting = isMeals
        ? `What are you thinking about your meal today?`
        : coachGreeting(coachTone, userName);
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [show, openingContext]);

  const pickPhoto = async (fromCamera) => {
    try {
      if (fromCamera && Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
      }
      const res = fromCamera && Platform.OS !== 'web'
        ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
      if (!res.canceled && res.assets?.[0]?.uri) setPhoto(res.assets[0].uri);
    } catch (_) {}
  };

  const sendMessage = async () => {
    if ((!chatInput.trim() && !photo) || isTyping) return;

    const sentPhoto = photo;
    const userMsg = { role: 'user', content: chatInput.trim() || 'Here\u2019s my food.', ...(sentPhoto ? { photo: sentPhoto } : {}) };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setPhoto(null);
    setIsTyping(true);

    try {
      const image = sentPhoto ? await photoBase64(sentPhoto).catch(() => null) : null;
      const res = await callChat({
        action: 'message',
        variant,
        // the photo itself goes once, with this message; earlier ones aren't resent
        messages: updatedMessages.map(({ photo: _p, ...m }) => m),
        image,
        personality,
        data: userData,
        userId,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply, loggableMeal: res.loggableMeal || null }]);
    } catch (e) {
      console.error('[Chat error]', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't reach the server right now. Please try again in a moment.",
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!show) return null;

  return (
    <View style={styles.overlay}>
      <HeaderFade bg="#F9FAFB" scrollY={pageFade.scrollY} />
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {/* Header: its own row above the chat, so the chat scrolls beneath it instead of under the buttons */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={onClose} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={INK} />
          </TouchableOpacity>
          <View style={styles.leftChip}>
            <Ionicons name={isMeals ? 'leaf-outline' : 'sparkles-outline'} size={14} color="#047857" />
            <Text style={styles.leftChipText}>{isMeals ? `${Math.round(caloriesLeft).toLocaleString()} cal left today` : 'Knows your data'}</Text>
          </View>
        </View>
        <ScrollView
          ref={scrollViewRef}
          {...pageFade.scrollProps}
          style={{ flex: 1 }}
          contentContainerStyle={styles.chatMessagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {(!isMeals || !started) && <Text style={styles.h1}>{isMeals ? 'Not sure what you ate?\nLet\u2019s work it out.' : 'Your coach'}</Text>}
          {isMeals && started ? null : isMeals ? (
            <>
              <Text style={styles.kicker}>PERFECT FOR WHEN</Text>
              <View style={styles.whenCard}>
                {ASK_WHEN.map(([icon, title, sub], i) => (
                  <View key={title} style={[styles.whenRow, i < ASK_WHEN.length - 1 && styles.rowDivider]}>
                    <View style={styles.whenIcon}><Ionicons name={icon} size={16} color={INK} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.whenTitle}>{title}</Text>
                      <Text style={styles.whenSub}>{sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {hasConversation && (
                <TouchableOpacity onPress={() => setStarted(true)} style={{ marginTop: 14 }} accessibilityRole="button">
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#047857' }}>Continue your chat ›</Text>
                </TouchableOpacity>
              )}
              {askRecents.length > 0 && (
                <>
                  <Text style={[styles.kicker, { marginTop: 24 }]}>RECENTS</Text>
                  <View style={styles.whenCard}>
                    {askRecents.map((m, i) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.whenRow, i < askRecents.length - 1 && styles.rowDivider]}
                        onPress={() => startChat(`I had ${m.name} again`)}
                        accessibilityLabel={`Log ${m.name} again`}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.whenTitle, { fontSize: 13 }]} numberOfLines={1}>{m.name}</Text>
                          <Text style={[styles.whenSub, { fontSize: 12 }]}>{Math.round(m.calories || 0).toLocaleString()} cal</Text>
                        </View>
                        <Text style={{ fontSize: 12.5, color: MUTED }}>{whenLabel(m.logged_at)}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#C4C8CE" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <Text style={styles.chatDisclaimer}>AI coach, not a doctor. Check with a doctor before making medical decisions or big changes to your diet.</Text>
          )}

          {started && messages.map((msg, index) => (
            <View key={index} style={{ marginBottom: 16 }}>
              <View style={[styles.chatBubbleWrapper, { marginBottom: 0, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }]}>
                {msg.role === 'user' ? (
                  <View style={[styles.chatBubble, styles.chatBubbleUser]}>
                    {msg.photo ? <Image source={{ uri: msg.photo }} style={styles.bubblePhoto} /> : null}
                    <Text style={[styles.chatBubbleText, { color: '#fff' }]}>{msg.content}</Text>
                  </View>
                ) : (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                    <FormattedText text={msg.content} bodyStyle={[styles.chatBubbleText, { color: INK }]} paragraphSpacing={10} />
                  </View>
                )}
              </View>
              {isMeals && msg.role === 'assistant' && msg.loggableMeal && (
                <TouchableOpacity activeOpacity={0.85} onPress={() => onLogMealFromChat && onLogMealFromChat(msg.loggableMeal)}>
                  <LinearGradient colors={['#34D399', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logMealPill}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.logMealPillText}>Log this meal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isTyping && (
            <View style={styles.chatBubbleWrapper}>
              <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Ask Logga's start screen ends in New chat; the composer only shows once a chat has started */}
        {!started ? (
          <View style={styles.composerWrap}>
            <TouchableOpacity style={styles.newChatBtn} onPress={() => startChat()} activeOpacity={0.85} accessibilityRole="button">
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
              <Text style={styles.newChatText}>New chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.composerWrap}>
          {!isMeals && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chatSuggestions} contentContainerStyle={styles.chatSuggestionsContent}>
              {SUGGESTIONS.map((sug, i) => (
                <TouchableOpacity key={i} style={styles.chatSuggestionBtn} onPress={() => setChatInput(sug)}>
                  <Text style={styles.chatSuggestionText}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={styles.composer}>
            {photo && (
              <View style={styles.photoChip}>
                <Image source={{ uri: photo }} style={styles.photoThumb} />
                <TouchableOpacity onPress={() => setPhoto(null)} style={styles.photoRemove} accessibilityLabel="Remove photo">
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {voice !== 'idle' && (
              <View style={styles.listeningRow}>
                <View style={styles.listeningDot} />
                <Text style={styles.listeningText}>{voice === 'listening' ? 'Listening… tap stop when you’re done' : 'Writing down what you said…'}</Text>
              </View>
            )}
            {voiceNote && voice === 'idle' && <Text style={styles.voiceNote}>{voiceNote}</Text>}
            <TextInput
              placeholder={isMeals ? 'What did you eat?' : 'Ask about your progress…'}
              placeholderTextColor="#9CA3AF"
              style={styles.composerInput}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              blurOnSubmit={false}
              onKeyPress={(e) => {
                // Enter sends on a keyboard; Shift+Enter makes a new line
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); sendMessage(); }
              }}
              accessibilityLabel={isMeals ? 'Tell Logga what you ate' : 'Message your coach'}
            />
            <View style={styles.composerRow}>
              {isMeals && (
                <TouchableOpacity style={styles.composerBtnOutline} onPress={() => pickPhoto(false)} accessibilityLabel="Add a photo">
                  <Ionicons name="add" size={20} color={INK} />
                </TouchableOpacity>
              )}
              {isMeals && Platform.OS !== 'web' && (
                <TouchableOpacity style={styles.composerBtn} onPress={() => pickPhoto(true)} accessibilityLabel="Take a photo">
                  <Ionicons name="camera-outline" size={20} color={INK} />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.composerBtn, voice === 'listening' && styles.micOn]}
                onPress={voice === 'listening' ? stopVoice : startVoice}
                disabled={voice === 'transcribing'}
                accessibilityLabel={voice === 'listening' ? 'Stop recording' : 'Say it'}
              >
                <Ionicons name={voice === 'listening' ? 'stop' : 'mic-outline'} size={voice === 'listening' ? 16 : 20} color={voice === 'listening' ? '#fff' : INK} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, ((!chatInput.trim() && !photo) || isTyping || voice !== 'idle') && { opacity: 0.35 }]}
                onPress={sendMessage}
                disabled={(!chatInput.trim() && !photo) || isTyping || voice !== 'idle'}
                accessibilityLabel="Send"
              >
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F9FAFB', zIndex: 10000,
    // the app already sits below the status bar, so only a small gap here
    paddingTop: Platform.OS === 'web' ? 12 : Platform.OS === 'ios' ? 8 : 50,
  },
  chatContainer: { width: '100%', maxWidth: 430, alignSelf: 'center', flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 20 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  leftChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  leftChipText: { fontSize: 13, fontWeight: '700', color: '#047857' },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, lineHeight: 32, color: INK, marginTop: 20 },
  chatMessagesContent: { paddingHorizontal: 20, paddingBottom: 24 },
  chatDisclaimer: { fontSize: 12.5, lineHeight: 18, color: MUTED, marginTop: 12, marginBottom: 22 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#4B5563', marginTop: 28, marginBottom: 10 },
  whenCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F0F1F3' },
  whenIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  whenTitle: { fontSize: 15, fontWeight: '600', color: INK },
  whenSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  composerBtnOutline: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoChip: { alignSelf: 'flex-start', marginBottom: 8 },
  photoThumb: { width: 56, height: 56, borderRadius: 12 },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  bubblePhoto: { width: 180, height: 180, borderRadius: 14, marginBottom: 8 },
  chatBubbleWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 },
  chatBubble: { maxWidth: '82%', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 22 },
  chatBubbleAssistant: { backgroundColor: '#fff', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  chatBubbleUser: { backgroundColor: INK, borderBottomRightRadius: 6 },
  chatBubbleText: { fontSize: 15, lineHeight: 22 },
  logMealPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10,
    borderRadius: 16, paddingVertical: 11, paddingHorizontal: 16,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 3,
  },
  logMealPillText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  chatSuggestions: { maxHeight: 48, marginBottom: 8 },
  chatSuggestionsContent: { alignItems: 'center', gap: 8 },
  chatSuggestionBtn: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  chatSuggestionText: { fontSize: 13, color: '#047857', fontWeight: '600' },
  composerWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'web' ? 16 : 30, backgroundColor: '#F9FAFB' },
  composer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 28, paddingTop: 12, paddingRight: 12, paddingBottom: 10, paddingLeft: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  composerInput: { fontSize: 16, lineHeight: 22, color: INK, minHeight: 26, maxHeight: 110, paddingVertical: 2, outlineStyle: 'none' },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  composerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: '#DC2626' },
  newChatBtn: { height: 54, borderRadius: 16, backgroundColor: INK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  newChatText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listeningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  listeningText: { fontSize: 12.5, fontWeight: '600', color: '#B91C1C' },
  voiceNote: { fontSize: 12.5, color: '#6B7280', marginBottom: 6 },
});

export default ChatScreen;
