import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FormattedText from '../lib/FormattedText';

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const API_URL = `${BASE}/api/chat`;

async function callChat(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  onUpdatePersonality,
  goalHistory,
  onLogMealFromChat,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);
  const lastOpeningContextRef = useRef(null);
  const isMeals = variant === 'meals';

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
        : userName
        ? `Hi ${userName}! I'm your personal weight loss coach. I have access to all your data — your meals, calories, weight, and hydration. Ask me anything!`
        : `Hi! I'm your personal weight loss coach. I have access to all your data — ask me anything about your progress, goals, or how to improve!`;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [show, openingContext]);

  const sendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;

    const userMsg = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setIsTyping(true);

    try {
      const res = await callChat({
        action: 'message',
        variant,
        messages: updatedMessages,
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
    <KeyboardAvoidingView
      style={styles.chatOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.chatContainer}>
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.chatBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={22} color="#059669" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            {!isMeals && (
              <LinearGradient colors={['#10B981', '#059669']} style={styles.chatAvatar}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </LinearGradient>
            )}
            <View>
              <Text style={styles.chatHeaderTitle}>
                {isMeals ? 'Know your calories first' : 'Your Weight Loss Coach'}
              </Text>
              <View style={styles.chatHeaderStatusRow}>
                {!isTyping && <View style={styles.chatStatusDot} />}
                <Text style={styles.chatHeaderStatus}>
                  {isTyping ? 'Typing…' : isMeals ? "Let's talk about it" : 'Online • Knows your data'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatMessages}
          contentContainerStyle={styles.chatMessagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, index) => (
            <View key={index} style={{ marginBottom: 16 }}>
              <View
                style={[
                  styles.chatBubbleWrapper,
                  { marginBottom: 0, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' },
                ]}
              >
                {msg.role === 'assistant' && !isMeals && (
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.chatBubbleAvatar}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </LinearGradient>
                )}
                {msg.role === 'user' ? (
                  <LinearGradient
                    colors={['#10B981', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.chatBubble, styles.chatBubbleUser]}
                  >
                    <Text style={[styles.chatBubbleText, { color: '#fff' }]}>{msg.content}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                    <FormattedText
                      text={msg.content}
                      bodyStyle={[styles.chatBubbleText, { color: '#1F1F1F' }]}
                      paragraphSpacing={10}
                    />
                  </View>
                )}
              </View>
              {isMeals && msg.role === 'assistant' && msg.loggableMeal && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onLogMealFromChat && onLogMealFromChat(msg.loggableMeal)}
                >
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.logMealPill}>
                    <Ionicons name="add-circle" size={16} color="#fff" />
                    <Text style={styles.logMealPillText}>Log this meal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isTyping && (
            <View style={styles.chatBubbleWrapper}>
              {!isMeals && (
                <LinearGradient colors={['#10B981', '#059669']} style={styles.chatBubbleAvatar}>
                  <Text style={{ fontSize: 14 }}>🤖</Text>
                </LinearGradient>
              )}
              <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestions */}
        {!isMeals && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chatSuggestions}
            contentContainerStyle={styles.chatSuggestionsContent}
          >
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chatSuggestionBtn}
                onPress={() => setChatInput(s)}
              >
                <Text style={styles.chatSuggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder={isMeals ? 'Type a message...' : 'Ask about your progress...'}
            placeholderTextColor="#999"
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={{ opacity: chatInput.trim() && !isTyping ? 1 : 0.4 }}
            onPress={sendMessage}
            disabled={!chatInput.trim() || isTyping}
          >
            <LinearGradient colors={['#10B981', '#047857']} style={styles.chatSendBtn}>
              <Ionicons name="send" size={19} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  chatOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F5F6F8',
    zIndex: 10000,
  },
  chatContainer: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F5F6F8',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
    zIndex: 1,
  },
  chatBackBtn: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chatHeaderInfo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12,
  },
  chatAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  chatHeaderTitle: { fontSize: 15.5, fontWeight: '700', color: '#15181C', letterSpacing: -0.2 },
  chatHeaderStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 5 },
  chatStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  chatHeaderStatus: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  chatMessages: { flex: 1, paddingHorizontal: 18 },
  chatMessagesContent: { paddingVertical: 18 },
  chatBubbleWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16,
  },
  chatBubbleAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  },
  chatBubble: {
    maxWidth: '78%', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 20,
  },
  chatBubbleAssistant: {
    backgroundColor: '#fff', borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  chatBubbleUser: {
    borderBottomRightRadius: 6,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 3,
  },
  chatBubbleText: { fontSize: 14.5, lineHeight: 21.5 },
  logMealPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 8,
    borderRadius: 20,
    paddingVertical: 9, paddingHorizontal: 15,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  logMealPillText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chatSuggestions: { maxHeight: 52, paddingHorizontal: 18 },
  chatSuggestionsContent: { alignItems: 'center', paddingVertical: 10, gap: 8 },
  chatSuggestionBtn: {
    paddingVertical: 9, paddingHorizontal: 15, borderRadius: 20,
    backgroundColor: 'rgba(5,150,105,0.07)',
  },
  chatSuggestionText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  chatInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 30,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 4,
  },
  chatInput: {
    flex: 1, paddingVertical: 13, paddingHorizontal: 18,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)',
    fontSize: 14.5, backgroundColor: '#F5F6F8',
    marginRight: 10, color: '#1F1F1F',
  },
  chatSendBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
});

export default ChatScreen;
