import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dc, themedStyles } from '../lib/theme';
import { useSubscription } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { MICRO_GROUPS, microsCache as cache } from '../lib/micros';
import { unlock } from './ProLock';

const sigOf = (foods) => foods.map((f) => `${f.name}|${f.qty || ''}|${Math.round(f.cal || 0)}`).join(';');

const fmt = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? (Math.round(v * 10) / 10).toString() : (Math.round(v * 100) / 100).toString());

// The four groups of micronutrients, all closed until tapped; each row shows the amount and its share of an
// adult's daily value. values: { b1: 0.4, iron: 3.2, ... } in the units of lib/micros.js.
export function MicroGroups({ values }) {
  const [open, setOpen] = useState({});
  return MICRO_GROUPS.map((g, gi) => (
    <View key={g.title} style={st.group}>
      <TouchableOpacity style={st.groupHead} onPress={() => setOpen((o) => ({ ...o, [gi]: !o[gi] }))} accessibilityRole="button" accessibilityState={{ expanded: !!open[gi] }}>
        <View style={{ flex: 1 }}>
          <Text style={st.groupTitle}>{g.title}</Text>
          <Text style={st.groupNote}>{g.note}</Text>
        </View>
        <Ionicons name={open[gi] ? 'chevron-up' : 'chevron-down'} size={18} color={dc('#6B7280', 'text')} />
      </TouchableOpacity>
      {open[gi] && g.items.map((m) => {
        const v = Number(values?.[m.key]) || 0;
        const pct = m.dv ? Math.round((v / m.dv) * 100) : null;
        return (
          <View key={m.key} style={st.item}>
            <View style={st.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={st.name}>{m.name}</Text>
                <Text style={st.what}>{m.what}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={st.amount}>{fmt(v)} {m.unit}</Text>
                {pct != null && <Text style={st.pct}>{pct}%</Text>}
              </View>
            </View>
            {pct != null && (
              <View style={st.track}><View style={[st.fill, { width: `${Math.min(pct, 100)}%` }]} /></View>
            )}
          </View>
        );
      })}
    </View>
  ));
}

// What Free sees: the groups with their values hidden, and Unlock with Logga Pro.
export function MicrosLocked({ sub, style, showTitle = true }) {
  return (
    <TouchableOpacity style={style} onPress={() => unlock('micros')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Micronutrients. Unlock with Logga Pro">
      <View style={st.head}>
        {showTitle ? <Text style={st.title}>Micronutrients</Text> : <View />}
        <View style={st.proPill}><Ionicons name="lock-closed" size={11} color={dc('#fff', 'text')} /><Text style={st.proPillTxt}>PRO</Text></View>
      </View>
      <Text style={st.sub}>{sub}</Text>
      {MICRO_GROUPS.map((g) => (
        <View key={g.title} style={st.group}>
          <Text style={st.groupTitle}>{g.title}</Text>
          {g.items.slice(0, 2).map((m, i) => (
            <View key={m.key} style={st.row}>
              <Text style={st.name} numberOfLines={1}>{m.name}</Text>
              <View style={[st.ghost, { width: 44 + ((i * 17) % 30) }]} />
            </View>
          ))}
          <Text style={st.more}>+ {g.items.length - 2} more</Text>
        </View>
      ))}
      <View style={st.unlockBtn}>
        <Ionicons name="lock-open-outline" size={16} color={dc('#fff', 'text')} />
        <Text style={st.unlockTxt}>Unlock with Logga Pro</Text>
      </View>
    </TouchableOpacity>
  );
}

// Under a meal's Macro Distribution: its micronutrients. Logga Pro; Free sees them locked. Worked out once per
// meal (fetchMicros(foods) asks the AI and resolves { micros }) and saved on it (meals.micros).
export default function MicrosCard({ foods, mealId, fetchMicros }) {
  const { isPro } = useSubscription();
  const [micros, setMicros] = useState(null);
  const [state, setState] = useState('idle'); // idle | loading | error | off
  const sig = sigOf(foods || []);

  useEffect(() => {
    if (!isPro || !foods?.length) return undefined;
    let alive = true;
    const known = cache.get(sig) || (mealId && cache.get(`id:${mealId}`));
    if (known) { setMicros(known); setState('idle'); return undefined; }
    setMicros(null);
    setState('loading');
    (async () => {
      // Saved on the meal already?
      if (mealId) {
        const { data } = await supabase.from('meals').select('micros').eq('id', mealId).maybeSingle().then((r) => r, () => ({}));
        if (data?.micros && alive) { cache.set(sig, data.micros); setMicros(data.micros); setState('idle'); return; }
      }
      try {
        const res = await fetchMicros(foods);
        if (!alive) return;
        if (!res?.micros) { setState('error'); return; }
        cache.set(sig, res.micros);
        setMicros(res.micros);
        setState('idle');
      } catch (e) {
        if (alive) setState(e?.code === 'AI_CONSENT' ? 'off' : 'error');
      }
    })();
    return () => { alive = false; };
  }, [isPro, sig]);

  // Save on the meal once both are known (a just-logged meal gets its id a moment after the card shows).
  useEffect(() => {
    if (!isPro || !micros || !mealId || cache.get(`id:${mealId}`)) return;
    cache.set(`id:${mealId}`, micros);
    supabase.from('meals').update({ micros }).eq('id', mealId).then(() => {}, () => {});
  }, [isPro, micros, mealId]);

  if (!foods?.length) return null;

  if (!isPro) return <MicrosLocked style={st.card} sub="29 essential vitamins and minerals in this meal, against what your body needs each day." />;

  return (
    <View style={st.card}>
      <Text style={st.title}>Micronutrients</Text>
      {state === 'loading' && (
        <View style={st.status}><ActivityIndicator size="small" color={dc('#059669', 'text')} /><Text style={st.statusTxt}>Working out the vitamins and minerals...</Text></View>
      )}
      {state === 'off' && <Text style={st.statusTxt}>AI features are off. Turn them on in Settings › Privacy Settings to see these.</Text>}
      {state === 'error' && <Text style={st.statusTxt}>Couldn't work these out right now. Open this meal again to try again.</Text>}
      {micros && <MicroGroups values={micros} />}
    </View>
  );
}

const st = themedStyles({
  card: {
    alignSelf: 'stretch', marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: '#1F1F1F' },
  sub: { fontSize: 12, lineHeight: 17, color: '#6B7280', marginTop: 4 },
  proPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#059669' },
  proPillTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: '#fff' },
  group: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  groupHead: { flexDirection: 'row', alignItems: 'center' },
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  groupNote: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  item: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  name: { fontSize: 13, fontWeight: '600', color: '#374151' },
  what: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  amount: { fontSize: 13, fontWeight: '700', color: '#1F1F1F' },
  pct: { fontSize: 11, fontWeight: '600', color: '#059669', marginTop: 1 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#F3F4F6', marginTop: 6, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: '#34D399' },
  ghost: { height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  more: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  unlockBtn: { marginTop: 16, height: 46, borderRadius: 14, backgroundColor: '#059669', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  unlockTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  statusTxt: { fontSize: 13, color: '#6B7280', marginTop: 12 },
});
