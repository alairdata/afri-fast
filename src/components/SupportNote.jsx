// The fixed, gentle message shown when a note sounds worrying (see lib/worry.js). Never written by AI.
import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { themedStyles } from '../lib/theme';
import { SUPPORT_TEXT, HELPLINE_URL } from '../lib/worry';

const SupportNote = ({ level, style }) => {
  const t = SUPPORT_TEXT[level];
  if (!t) return null;
  return (
    <View style={[s.box, style]} accessibilityRole="alert">
      <Text style={s.title}>{t.title}</Text>
      <Text style={s.body}>{t.body}</Text>
      {t.button ? (
        <TouchableOpacity style={s.btn} onPress={() => Linking.openURL(HELPLINE_URL).catch(() => {})} accessibilityRole="link">
          <Text style={s.btnTxt}>{t.button}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const s = themedStyles({
  box: { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  title: { fontSize: 14.5, fontWeight: '700', color: '#1F1F1F' },
  body: { fontSize: 13.5, lineHeight: 19.5, color: '#374151', marginTop: 5 },
  btn: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#6D28D9', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});

export default SupportNote;
