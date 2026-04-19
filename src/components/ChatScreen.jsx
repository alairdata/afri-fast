import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, Animated } from 'react-native';
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

const API_URL = '/api/chat';

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
  'Best foods to break my fast?',
  'How is my progress?',
  'Tips for longer fasts',
];

const ChatScreen = ({
  show,
  onClose,
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
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);
  const lastOpeningContextRef = useRef(null);

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
    if (wasOpen && !show && messages.length >= 3 && onUpdatePersonality) {
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
      const greeting = userName
        ? `Hi ${userName}! I'm AfriFast Assistant, your personal health coach. I have access to all your data — your fasting history, meals, weight, and hydration. Ask me anything!`
        : `Hi! I'm AfriFast Assistant, your personal health coach. I have access to all your data — ask me anything about your progress, goals, or how to improve!`;
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
        messages: updatedMessages,
        personality,
        data: userData,
        userId,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
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
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
            </View>
            <View>
              <Text style={styles.chatHeaderTitle}>AfriFast Assistant</Text>
              <Text style={styles.chatHeaderStatus}>
                {isTyping ? 'Typing...' : 'Online • Knows your data'}
              </Text>
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
            <View
              key={index}
              style={[
                styles.chatBubbleWrapper,
                { justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' },
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.chatBubbleAvatar}>
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
              )}
              <View
                style={[
                  styles.chatBubble,
                  msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                ]}
              >
                {msg.role === 'user' ? (
                  <Text style={[styles.chatBubbleText, { color: '#fff' }]}>{msg.content}</Text>
                ) : (
                  <FormattedText
                    text={msg.content}
                    bodyStyle={[styles.chatBubbleText, { color: '#1F1F1F' }]}
                    paragraphSpacing={10}
                  />
                )}
              </View>
            </View>
          ))}
          {isTyping && (
            <View style={styles.chatBubbleWrapper}>
              <View style={styles.chatBubbleAvatar}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
              </View>
              <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestions */}
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

        {/* Input */}
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder="Ask about your progress..."
            placeholderTextColor="#999"
            style={styles.chatInput}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.chatSendBtn, { opacity: chatInput.trim() && !isTyping ? 1 : 0.4 }]}
            onPress={sendMessage}
            disabled={!chatInput.trim() || isTyping}
          >
            <Ionicons name="send" size={20} color="#fff" />
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
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  chatContainer: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  chatBackBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chatHeaderInfo: {
    flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12,
  },
  chatAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  chatHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  chatHeaderStatus: { fontSize: 12, color: '#10B981', marginTop: 2, fontWeight: '500' },
  chatMessages: { flex: 1, paddingHorizontal: 20 },
  chatMessagesContent: { paddingVertical: 20 },
  chatBubbleWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16,
  },
  chatBubbleAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8, flexShrink: 0,
  },
  chatBubble: {
    maxWidth: '75%', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20,
  },
  chatBubbleAssistant: {
    backgroundColor: '#fff', borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  chatBubbleUser: { backgroundColor: '#059669', borderBottomRightRadius: 4 },
  chatBubbleText: { fontSize: 14, lineHeight: 21 },
  chatSuggestions: { maxHeight: 52, paddingHorizontal: 20 },
  chatSuggestionsContent: { alignItems: 'center', paddingVertical: 10 },
  chatSuggestionBtn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(5,150,105,0.2)',
    backgroundColor: '#fff', marginRight: 8,
  },
  chatSuggestionText: { fontSize: 13, color: '#059669', fontWeight: '500' },
  chatInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  chatInput: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
    fontSize: 14, backgroundColor: '#F8FAFC',
    marginRight: 12, color: '#1F1F1F',
  },
  chatSendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(5,150,105,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
});

export default ChatScreen;
