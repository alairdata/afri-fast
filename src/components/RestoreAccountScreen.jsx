import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Shown when someone logs in to an account they deleted less than 7 days ago (see api/delete-account.js).
// Everything is still there: they can restore it, erase it right now, or just log out.
export default function RestoreAccountScreen({ deleteAfter, onRestore, onDeleteNow, onLogOut }) {
  const [busy, setBusy] = useState(''); // 'restore' | 'delete' | 'logout'
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const when = new Date(deleteAfter).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const run = async (kind, fn) => {
    setBusy(kind); setError('');
    const err = await fn();
    if (err) { setError(err); setBusy(''); }
  };

  return (
    <View style={s.page}>
      <View style={s.card}>
        <View style={s.icon}>
          <Ionicons name="refresh-outline" size={30} color="#059669" />
        </View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.body}>
          You deleted this account recently. It will be permanently erased on <Text style={s.strong}>{when}</Text>.
          {'\n\n'}All your meals, streak and progress are still here. Restore your account to pick up right where you left off.
        </Text>
        {error ? <Text style={s.error}>{error}</Text> : null}

        {!confirmDelete ? (
          <>
            <TouchableOpacity style={s.btn} onPress={() => run('restore', onRestore)} disabled={!!busy} activeOpacity={0.85}>
              {busy === 'restore' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Restore my account</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => run('logout', onLogOut)} disabled={!!busy}>
              {busy === 'logout' ? <ActivityIndicator color="#059669" /> : <Text style={s.linkTxt}>Log out</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.linkSmall} onPress={() => setConfirmDelete(true)} disabled={!!busy}>
              <Text style={s.dangerTxt}>Delete everything now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.warn}>This erases your account and all your data right away. It cannot be undone.</Text>
            <TouchableOpacity style={[s.btn, s.dangerBtn]} onPress={() => run('delete', onDeleteNow)} disabled={!!busy} activeOpacity={0.85}>
              {busy === 'delete' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Yes, delete everything now</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => setConfirmDelete(false)} disabled={!!busy}>
              <Text style={s.linkTxt}>Go back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F4F1EA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 26, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: '#16201b', textAlign: 'center', letterSpacing: -0.4, marginBottom: 10 },
  body: { fontSize: 14.5, lineHeight: 21, color: '#5b6b64', textAlign: 'center', marginBottom: 18 },
  strong: { fontWeight: '700', color: '#16201b' },
  error: { color: '#DC2626', fontSize: 13.5, textAlign: 'center', marginBottom: 12 },
  warn: { color: '#DC2626', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 14 },
  btn: { width: '100%', height: 52, borderRadius: 14, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { backgroundColor: '#DC2626' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { paddingVertical: 14, marginTop: 4, minHeight: 48, justifyContent: 'center' },
  linkTxt: { color: '#059669', fontSize: 15, fontWeight: '600' },
  linkSmall: { paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  dangerTxt: { color: '#DC2626', fontSize: 13.5, fontWeight: '600' },
});
