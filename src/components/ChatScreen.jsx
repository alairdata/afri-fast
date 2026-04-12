import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GEMINI_API_KEY = 'AIzaSyC4EzCRJDTTjX-wwZNkR_igY_P6fn5PGAs';

function buildUserContext({ userName, userCountry, selectedPlan, targetWeight, startingWeight, dailyCalorieGoal, hydrationGoal, volumeUnit, proteinGoal, carbsGoal, fatsGoal, fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs }) {
  const sessions = fastingSessions || [];
  const checkIns = checkInHistory || [];
  const meals = recentMeals || [];
  const weights = [...(weightLogs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const waterLs = waterLogs || [];

  // Fasting
  const completed = sessions.filter(s => s.endTime);
  const durations = completed.map(s => (s.durationHours || 0) + (s.durationMinutes || 0) / 60).filter(d => d > 0);
  const avgDuration = durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : 0;
  const completionRate = sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0;

  // Check-ins
  const moodCount = {};
  checkIns.forEach(c => {
    (Array.isArray(c.moods) ? c.moods : c.moods ? [c.moods] : []).forEach(m => {
      moodCount[m] = (moodCount[m] || 0) + 1;
    });
  });
  const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);

  // Meals
  const mealsByDate = {};
  meals.forEach(m => {
    const date = m.date || (m.loggedAt || '').split('T')[0];
    if (!date) return;
    if (!mealsByDate[date]) mealsByDate[date] = [];
    mealsByDate[date].push(m);
  });
  const dailyCals = Object.values(mealsByDate).map(ms => ms.reduce((a, m) => a + (m.calories || 0), 0));
  const avgCals = dailyCals.length ? Math.round(dailyCals.reduce((a, b) => a + b, 0) / dailyCals.length) : 0;

  const foodCount = {};
  meals.forEach(m => {
    const name = m.detectedName || m.name;
    if (name) foodCount[name] = (foodCount[name] || 0) + 1;
  });
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

  // Weight
  const currentWeight = weights.length ? weights[weights.length - 1].weight : null;
  const weightUnit = weights.length ? weights[weights.length - 1].unit : 'kg';
  const weightLost = currentWeight && startingWeight ? parseFloat((startingWeight - currentWeight).toFixed(1)) : null;

  // Hydration
  const waterByDate = {};
  waterLs.forEach(w => { if (w.date) waterByDate[w.date] = (waterByDate[w.date] || 0) + (w.amount || 1); });
  const dailyWater = Object.values(waterByDate);
  const avgWater = dailyWater.length ? parseFloat((dailyWater.reduce((a, b) => a + b, 0) / dailyWater.length).toFixed(1)) : 0;

  return `
USER PROFILE:
- Name: ${userName || 'User'}
- Country: ${userCountry || 'Africa'}
- Fasting plan: ${selectedPlan || '16:8'}
- Starting weight: ${startingWeight ? `${startingWeight} ${weightUnit}` : 'not set'}
- Current weight: ${currentWeight ? `${currentWeight} ${weightUnit}` : 'not logged'}
- Target weight: ${targetWeight ? `${targetWeight} ${weightUnit}` : 'not set'}
- Weight lost so far: ${weightLost != null ? `${weightLost} ${weightUnit}` : 'unknown'}
- Daily calorie goal: ${dailyCalorieGoal} kcal
- Macro goals: ${proteinGoal}g protein, ${carbsGoal}g carbs, ${fatsGoal}g fats
- Hydration goal: ${hydrationGoal} ${volumeUnit}s/day

FASTING HISTORY:
- Total fasting sessions: ${sessions.length}
- Completed fasts: ${completed.length} (${completionRate}% completion rate)
- Average fast duration: ${avgDuration} hours
- Longest fast: ${durations.length ? Math.max(...durations).toFixed(1) : 0} hours

CHECK-IN HISTORY:
- Total check-ins: ${checkIns.length}
- Most common moods: ${topMoods.join(', ') || 'none recorded'}

NUTRITION:
- Total meals logged: ${meals.length}
- Average daily calories: ${avgCals} kcal (goal: ${dailyCalorieGoal} kcal)
- Most eaten foods: ${topFoods.join(', ') || 'none recorded'}

HYDRATION:
- Average daily water: ${avgWater} ${volumeUnit}s (goal: ${hydrationGoal})
`.trim();
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
  targetWeight,
  startingWeight,
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
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (!show) return;

    if (openingContext) {
      // Opened from alert card — reset and greet with the specific observation
      setMessages([]);
      setIsTyping(true);

      const userContext = buildUserContext({
        userName, userCountry, selectedPlan, targetWeight, startingWeight,
        dailyCalorieGoal, hydrationGoal, volumeUnit, proteinGoal, carbsGoal, fatsGoal,
        fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs,
      });

      const prompt = `You are a warm personal health coach in Afri Fast. You just flagged this observation to the user on their Today screen: "${openingContext}"

Open the conversation by addressing this observation directly and personally. Ask them one follow-up question to understand their situation better. Keep it to 2-3 sentences max. Do not repeat the observation word for word — rephrase it naturally as if you're starting a real conversation.

User context:
${userContext}`;

      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
          }),
        }
      )
        .then(r => r.json())
        .then(raw => {
          const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          setMessages([{ role: 'assistant', content: text || openingContext }]);
        })
        .catch(() => setMessages([{ role: 'assistant', content: openingContext }]))
        .finally(() => setIsTyping(false));

    } else if (messages.length === 0) {
      const greeting = userName
        ? `Hi ${userName}! I'm your personal fasting coach. I have access to all your data — your fasting history, meals, weight, and hydration. Ask me anything!`
        : `Hi! I'm your personal fasting coach. I have access to all your data — ask me anything about your progress, goals, or how to improve!`;
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

    const userContext = buildUserContext({
      userName, userCountry, selectedPlan, targetWeight, startingWeight,
      dailyCalorieGoal, hydrationGoal, volumeUnit, proteinGoal, carbsGoal, fatsGoal,
      fastingSessions, checkInHistory, recentMeals, weightLogs, waterLogs,
    });

    const systemInstruction = `You are a warm, knowledgeable personal health coach inside Afri Fast, an African fasting and nutrition app. You have access to the user's real data shown below. Always use their actual numbers when answering — never give generic advice when you have specific data. Be concise (2-4 sentences), encouraging, and practical. Speak like a coach, not a doctor.

${userContext}`;

    // Build conversation history for Gemini (last 10 messages to stay within limits)
    const history = updatedMessages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    // Prepend system context as first user/model exchange
    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      { role: 'model', parts: [{ text: 'Understood. I have reviewed all the user data and I am ready to help.' }] },
      ...history,
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
          }),
        }
      );

      const raw = await response.json();
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) throw new Error('Empty Gemini response');

      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (e) {
      console.error('[Chat Gemini error]', e);
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
              <Text style={styles.chatHeaderTitle}>Fasting Coach</Text>
              <Text style={styles.chatHeaderStatus}>
                {isTyping ? 'Thinking...' : 'Online • Knows your data'}
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
                <Text style={[styles.chatBubbleText, msg.role === 'user' ? { color: '#fff' } : { color: '#1F1F1F' }]}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}
          {isTyping && (
            <View style={styles.chatBubbleWrapper}>
              <View style={styles.chatBubbleAvatar}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
              </View>
              <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                <ActivityIndicator size="small" color="#059669" />
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
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 1000,
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
