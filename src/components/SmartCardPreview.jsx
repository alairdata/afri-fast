// A preview of the smart alert card on Insights, shown only to the owner's account on the web so they can judge
// the idea. The numbers are live from their logs, but the wording is fixed and nothing watches in the background yet.
// The real version will replace this once the safety rules are in.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../lib/theme';

const OWNER_USER_ID = '25c55375-b7d7-45b1-a7d7-7658e39c3142';
export const showsSmartCardPreview = (userId) => Platform.OS === 'web' && userId === OWNER_USER_ID;

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG = 7700;
const WINDOW_DAYS = 28;
const BIG_DAY_RATIO = 1.3; // well above this person's own typical day, so "big" means big for them
const MIN_BIG_DAYS = 2;

export function buildSmartCardFacts({ weights = [], meals = [], goalHistory = [], weeklyRateKg, chosenRateKg, now = Date.now() }) {
  const since = now - WINDOW_DAYS * DAY_MS;
  const recentWeights = weights.filter((w) => w.ts >= since && Number.isFinite(w.weightKg)).map((w) => w.weightKg);

  const todayDs = new Date(now).toDateString();
  const byDay = {};
  meals.forEach((m) => {
    const ts = new Date(m.date).getTime();
    if (m.date && m.date !== todayDs && ts >= since) byDay[m.date] = (byDay[m.date] || 0) + (m.calories || 0);
  });
  const eaten = Object.values(byDay).filter((c) => c > 0);
  const sorted = [...eaten].sort((a, b) => a - b);
  const typical = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const big = eaten.filter((c) => c >= typical * BIG_DAY_RATIO);
  const rest = eaten.filter((c) => c < typical * BIG_DAY_RATIO);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const bigDays = big.length >= MIN_BIG_DAYS && rest.length ? {
    count: big.length,
    bigAvg: avg(big),
    restAvg: avg(rest),
    kg: big.reduce((sum, c) => sum + (c - avg(rest)), 0) / KCAL_PER_KG,
  } : null;

  let targetChanges = 0;
  (goalHistory || []).forEach((entry, i, all) => {
    if (entry.dailyCalorieGoal == null || new Date(entry.from).getTime() < since) return;
    const before = i > 0 ? all[i - 1].dailyCalorieGoal : null;
    if (before != null && before !== entry.dailyCalorieGoal) targetChanges++;
  });

  if (!Number.isFinite(weeklyRateKg) || recentWeights.length < 3) return null;
  return {
    weeklyRateKg, chosenRateKg, bigDays, targetChanges,
    lowKg: Math.min(...recentWeights), highKg: Math.max(...recentWeights),
  };
}

const round10 = (n) => Math.round(n / 10) * 10;

const SmartCardPreview = ({ facts, weightUnit, fromKg, cardStyle }) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const kg = useMemo(() => (v, digits = 1) => `${fromKg(v, weightUnit).toFixed(digits)} ${weightUnit}`, [fromKg, weightUnit]);
  if (!facts || hidden) return null;

  const { weeklyRateKg, chosenRateKg, bigDays, targetChanges, lowKg, highKg } = facts;
  const losing = weeklyRateKg < -0.05;
  const headline = losing ? 'Your weight is still going down' : "Your weight hasn't moved much lately";
  const body = losing
    ? `It's about ${kg(Math.abs(weeklyRateKg))} a week${chosenRateKg ? `, slower than the ${kg(chosenRateKg, chosenRateKg % 1 ? 2 : 0)} you chose` : ''}. It can feel like nothing is working, but your logs tell a clearer story.`
    : 'It can feel like nothing is working, but your logs tell a clearer story.';
  const reasons = [
    `Your weigh-ins ranged from ${kg(lowKg)} to ${kg(highKg)} in 4 weeks. Swings that size are mostly water, so one weigh-in says very little.`,
    bigDays && `${bigDays.count} days in the last 4 weeks averaged about ${round10(bigDays.bigAvg).toLocaleString()} kcal, and the others about ${round10(bigDays.restAvg).toLocaleString()}. Those bigger days offset about ${kg(bigDays.kg)}.`,
    targetChanges >= 3 && `You changed your calorie target ${targetChanges} times in 4 weeks, so it's hard to tell what any one target would have done.`,
  ].filter(Boolean);

  return (
    <View style={[cardStyle, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Preview: only you can see this</Text>
      <Text style={{ color: colors.text, fontSize: 15.5, fontWeight: '700' }}>{headline}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginTop: 6 }}>{body}</Text>

      {open && (
        <View style={{ marginTop: 12, gap: 10 }}>
          {reasons.map((reason) => (
            <Text key={reason} style={{ color: colors.text, fontSize: 13.5, lineHeight: 19 }}>{reason}</Text>
          ))}
          <Text style={{ color: colors.text, fontSize: 13.5, lineHeight: 19, fontWeight: '600' }}>
            You don't need to eat less. A steadier target may help more than a lower one, though this is my best guess from one month, not a certainty.
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          style={{ backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}
        >
          <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{open ? 'Hide' : 'Show Me Why'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHidden(true)} accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13.5, fontWeight: '600' }}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SmartCardPreview;
