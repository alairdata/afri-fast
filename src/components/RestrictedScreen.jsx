import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Shown instead of the app when an admin has restricted this account (admin portal › Users › Restrict).
const RestrictedScreen = ({ onLogOut }) => (
  <View style={styles.page}>
    <View style={styles.icon}><Ionicons name="lock-closed-outline" size={30} color="#B45309" /></View>
    <Text style={styles.title}>Your account is on hold</Text>
    <Text style={styles.body}>Logga has paused this account for now. If you think this is a mistake, email us and we'll look into it.</Text>
    <TouchableOpacity style={styles.primary} onPress={() => Linking.openURL('mailto:sounfilteredai@gmail.com?subject=My%20Logga%20account%20is%20on%20hold')} accessibilityRole="button">
      <Text style={styles.primaryText}>Email support</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.secondary} onPress={onLogOut} accessibilityRole="button">
      <Text style={styles.secondaryText}>Log out</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#1F1F1F', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: '#4B5563', textAlign: 'center', marginTop: 10, maxWidth: 340 },
  primary: { marginTop: 28, height: 52, alignSelf: 'stretch', maxWidth: 340, width: '100%', borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondary: { marginTop: 12, padding: 10 },
  secondaryText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});

export default RestrictedScreen;
