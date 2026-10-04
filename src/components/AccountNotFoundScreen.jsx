import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Shown when someone taps Apple / Google on the LOG IN screen but has no Logga account. Apple and Google
// quietly create a new, empty account in that case; here the person chooses to keep going (create the
// account) or go back to log in (the empty account is removed again).
export default function AccountNotFoundScreen({ email, provider, onCreate, onBack }) {
  const [leaving, setLeaving] = useState(false);
  const via = provider === 'apple' ? 'Apple ID' : provider === 'google' ? 'Google account' : 'account';
  // Apple's "Hide my email" addresses mean nothing to people, so only show a real-looking address.
  const showEmail = email && !/privaterelay\.appleid\.com$/i.test(email);

  return (
    <View style={s.page}>
      <View style={s.card}>
        <View style={s.icon}>
          <Ionicons name="person-add-outline" size={30} color="#059669" />
        </View>
        <Text style={s.title}>We couldn't find your account</Text>
        <Text style={s.body}>
          There's no Logga account for this {via}
          {showEmail ? <Text style={s.email}>{`\n${email}`}</Text> : null}
          {'\n\n'}Create a new account to get started. It only takes a minute.
        </Text>
        <TouchableOpacity style={s.btn} onPress={onCreate} activeOpacity={0.85} disabled={leaving}>
          <Text style={s.btnTxt}>Create an account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.link}
          onPress={async () => { setLeaving(true); await onBack(); }}
          disabled={leaving}
        >
          {leaving ? <ActivityIndicator color="#059669" /> : <Text style={s.linkTxt}>Back to log in</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 26, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#16201b', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  body: { fontSize: 14.5, lineHeight: 21, color: '#5b6b64', textAlign: 'center', marginBottom: 22 },
  email: { fontWeight: '700', color: '#16201b' },
  btn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { paddingVertical: 14, marginTop: 4, minHeight: 48, justifyContent: 'center' },
  linkTxt: { color: '#059669', fontSize: 15, fontWeight: '600' },
});
