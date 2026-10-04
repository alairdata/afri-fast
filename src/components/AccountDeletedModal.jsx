import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Shown after an account has been deleted (the app has already signed out, so this sits on top of the
// sign-in / onboarding screen). It lives at the top of the app, not inside Settings, because Settings is
// gone by the time the deletion finishes. Deletion has a 7-day restore window (api/delete-account.js).
export default function AccountDeletedModal({ visible, onClose, deleteAfter }) {
  const when = deleteAfter && deleteAfter !== 'now'
    ? new Date(deleteAfter).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'in 7 days';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.icon}>
            <Ionicons name="checkmark" size={34} color="#059669" />
          </View>
          <Text style={s.title}>Your account has been deleted</Text>
          {deleteAfter === 'now' ? (
            <Text style={[s.body, { marginBottom: 22 }]}>
              Your login, meals, photos and the rest of your data have been permanently erased from Logga.
            </Text>
          ) : (
            <>
              <Text style={s.body}>
                Your login, meals, photos and the rest of your data will be permanently erased on {deleteAfter ? <Text style={s.strong}>{when}</Text> : when}.
              </Text>
              <Text style={s.body2}>Changed your mind? Log back in before then and you can restore everything, exactly as it was.</Text>
            </>
          )}
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
  body: { fontSize: 14.5, lineHeight: 21, color: '#5b6b64', textAlign: 'center', marginBottom: 10 },
  strong: { fontWeight: '700', color: '#16201b' },
  body2: { fontSize: 13.5, lineHeight: 20, color: '#8a978f', textAlign: 'center', marginBottom: 22 },
  btn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
