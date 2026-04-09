import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ChatScreen = ({ show, onClose, messages, setMessages }) => {
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef(null);

  const sendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Based on your check-ins, I'd recommend trying a 16:8 schedule on busy days instead of 18:6. This gives you more flexibility while maintaining benefits.",
        "Your energy dips seem to happen around hour 14-16. Try having electrolytes or black coffee during this window to help push through.",
        "I've noticed you feel best when you break your fast with protein-focused meals. Keep that up! It helps stabilize blood sugar.",
        "Consider shifting your eating window earlier on days you report poor sleep. Late eating can affect sleep quality.",
        "Your consistency is great! 6 days in a row is impressive. Remember, it's okay to have rest days when needed."
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, { role: 'assistant', content: randomResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  if (!show) return null;

  return (
    <View style={styles.chatOverlay}>
      <View style={styles.chatContainer}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.chatBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatAvatar}>
              <Text style={{ fontSize: 22 }}>{'🤖'}</Text>
            </View>
            <View>
              <Text style={styles.chatHeaderTitle}>Fasting Assistant</Text>
              <Text style={styles.chatHeaderStatus}>
                {isTyping ? 'Typing...' : 'Online'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.chatMenuBtn}>
            <Text style={{ color: '#666', fontSize: 20 }}>{'⋮'}</Text>
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
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
                  <Text style={{ fontSize: 16 }}>{'🤖'}</Text>
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
                <Text style={{ fontSize: 16 }}>{'🤖'}</Text>
              </View>
              <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chatSuggestions} contentContainerStyle={styles.chatSuggestionsContent}>
          {['Why am I tired?', 'Best fasting schedule?', 'Tips for hunger'].map((suggestion, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chatSuggestionBtn}
              onPress={() => {
                setChatInput(suggestion);
              }}
            >
              <Text style={styles.chatSuggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Chat Input */}
        <View style={styles.chatInputContainer}>
          <TextInput
            placeholder="Ask about your fasting insights..."
            placeholderTextColor="#999"
            style={styles.chatInput}
            value={chatInput}
            onChangeText={(text) => setChatInput(text)}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[
              styles.chatSendBtn,
              { opacity: chatInput.trim() ? 1 : 0.5 },
            ]}
            onPress={sendMessage}
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>{'➤'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 1000,
  },
  chatContainer: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flexDirection: 'column',
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  chatBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
    fontWeight: '500',
  },
  chatMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessages: {
    flex: 1,
    paddingHorizontal: 20,
  },
  chatMessagesContent: {
    paddingVertical: 20,
  },
  chatBubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  chatBubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  chatBubble: {
    maxWidth: '75%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  chatBubbleAssistant: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chatBubbleUser: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  typingIndicator: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
    marginRight: 4,
  },
  chatSuggestions: {
    maxHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatSuggestionsContent: {
    alignItems: 'center',
  },
  chatSuggestionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  chatSuggestionText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  chatInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  chatInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    marginRight: 12,
    color: '#1F1F1F',
  },
  chatSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(5, 150, 105, 1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
});

export default ChatScreen;
