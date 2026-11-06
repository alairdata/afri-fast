// The one card Logga leaves on Insights when it notices something (see api/_smartCards.js and lib/smartCard.js).
// "Show Me Why" opens the numbers behind it; "Got it" puts it away for good.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../lib/theme';
import { HELPLINE_URL, SUPPORT_TEXT } from '../lib/worry';
import { onSmartCardChange, markSmartCardDone } from '../lib/smartCard';

const SmartCard = ({ userId, cardStyle }) => {
  const { colors } = useTheme();
  const [card, setCard] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => onSmartCardChange((s) => { setCard(s.card); }), []);
  useEffect(() => { setOpen(false); }, [card?.id]);
  if (!card) return null;

  const why = Array.isArray(card.why) ? card.why : [];
  const support = card.safety;
  const tint = support ? { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' } : { backgroundColor: colors.accentLight, borderColor: colors.accent };
  const btnColor = support ? '#6D28D9' : colors.accent;

  return (
    <View style={[cardStyle, tint]}>
      <Text style={{ color: colors.text, fontSize: 15.5, fontWeight: '700' }}>{card.title}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{card.body}</Text>

      {open && why.length > 0 && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {why.map((reason) => (
            <Text key={reason} style={{ color: colors.text, fontSize: 13.5, lineHeight: 19 }}>{reason}</Text>
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {card.button === 'helpline' ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(HELPLINE_URL).catch(() => {})}
            accessibilityRole="link"
            style={{ backgroundColor: btnColor, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{SUPPORT_TEXT.urgent.button}</Text>
          </TouchableOpacity>
        ) : why.length > 0 ? (
          <TouchableOpacity
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            style={{ backgroundColor: btnColor, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{open ? 'Hide' : 'Show Me Why'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => markSmartCardDone(userId)} accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13.5, fontWeight: '600' }}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SmartCard;
