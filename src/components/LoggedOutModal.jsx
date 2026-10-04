import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Shown over the sign-in screen right after logging out (the counterpart of AccountDeletedModal).
export default function LoggedOutModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.icon}>
            <Ionicons name="log-out-outline" size={30} color="#059669" />
          </View>
          <Text style={s.title}>You're logged out</Text>
          <Text style={s.body}>
            Everything you've logged is safe in your account. Log back in any time to pick up right where you left off.
          </Text>
          <TouchableOpacity style={s.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 26, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#16201b', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  body: { fontSize: 14.5, lineHeight: 21, color: '#5b6b64', textAlign: 'center', marginBottom: 22 },
  btn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
