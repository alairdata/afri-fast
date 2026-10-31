import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { SourcesLink } from './HealthSourcesPage';
import { LineChart } from 'react-native-chart-kit';
import { Rect } from 'react-native-svg';
import { dc, themedStyles } from '../lib/theme';
import { useSubscription } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import { callGeminiApi } from '../lib/geminiApi';
import { MICRO_ITEMS, microsCache } from '../lib/micros';
import { MicroGroups, MicrosLocked } from './MicrosCard';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Reference amounts for sugar and sodium (WHO guidance), and the nutrients the trend chart can show.
const SUGAR_REF_G = 50;
const SODIUM_REF_MG = 2000;
const TRENDS = [
  { key: 'protein', label: 'Protein', hex: '#EF4444', rgba: 'rgba(239, 68, 68, 1)', unit: 'g' },
  { key: 'carbs', label: 'Carbs', hex: '#F59E0B', rgba: 'rgba(245, 158, 11, 1)', unit: 'g' },
  { key: 'fats', label: 'Fats', hex: '#8B5CF6', rgba: 'rgba(139, 92, 246, 1)', unit: 'g' },
  { key: 'fiber', label: 'Fibre', hex: '#22C55E', rgba: 'rgba(34, 197, 94, 1)', unit: 'g' },
  { key: 'sugar', label: 'Sugar', hex: '#EC4899', rgba: 'rgba(236, 72, 153, 1)', unit: 'g', ref: SUGAR_REF_G,
    note: 'Total sugars, including the natural sugar in fruit and milk. WHO suggests keeping added sugars to about 50g a day or less.' },
  { key: 'sodium', label: 'Sodium', hex: '#0EA5E9', rgba: 'rgba(14, 165, 233, 1)', unit: 'mg', ref: SODIUM_REF_MG,
    note: 'Includes salt and seasoning cubes. WHO suggests under 2,000mg of sodium a day (about one teaspoon of salt).' },
];

const RANGE_DAYS = { '7 days': 7, '30 days': 30, '90 days': 90 };
// The range's meals (All time = every meal).
const mealsInRange = (meals, range) => {
  const days = RANGE_DAYS[range];
  if (!days) return meals;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return meals.filter((m) => { const t = m.timestamp || new Date(m.date).getTime(); return !isNaN(t) && t >= cutoff; });
};
// A meal's worked-out micronutrients: saved on it, or worked out earlier this session.
const microsOf = (m) => m.micros || microsCache.get(`id:${m.id}`) || null;
// What the AI needs to work a meal out: its foods, else just its name and calories.
const microFoods = (m) => (Array.isArray(m.foods) && m.foods.length
  ? m.foods.map((f) => ({ name: f.name, qty: f.qty, cal: f.cal }))
  : m.name ? [{ name: m.name, cal: m.calories }] : []);
const MICRO_BATCH = 8;
const MICRO_MAX_PER_OPEN = 48;

const CalorieDetailsPage = ({ show, onClose, recentMeals }) => {
  const [calorieRange, setCalorieRange] = useState('7 days');
  const [proteinTooltip, setProteinTooltip] = useState(null);
  const [carbsTooltip, setCarbsTooltip] = useState(null);
  const [fatsTooltip, setFatsTooltip] = useState(null);
  const [fiberTooltip, setFiberTooltip] = useState(null);
  const [sugarTooltip, setSugarTooltip] = useState(null);
  const [sodiumTooltip, setSodiumTooltip] = useState(null);
  const [trendKey, setTrendKey] = useState('protein');
  const [trendTooltip, setTrendTooltip] = useState(null);
  // Macronutrients | Micronutrients, the same pill toggle as Today's Meals | Usual Meals.
  const [nutrientTab, setNutrientTab] = useState('macro');
  const { isPro } = useSubscription();
  const [microFill, setMicroFill] = useState({ running: false, done: 0, total: 0, failed: false });
  const [, setMicroTick] = useState(0);

  // On Micronutrients (Pro), meals in the range that don't have theirs yet are worked out, a few at a time,
  // and saved on each meal, so every meal is only ever worked out once.
  useEffect(() => {
    if (!show || nutrientTab !== 'micro' || !isPro) return undefined;
    const missing = mealsInRange(recentMeals || [], calorieRange)
      .filter((m) => m.id != null && !microsOf(m) && microFoods(m).length)
      .slice(0, MICRO_MAX_PER_OPEN);
    if (!missing.length) return undefined;
    let alive = true;
    setMicroFill({ running: true, done: 0, total: missing.length, failed: false });
    (async () => {
      let done = 0;
      for (let i = 0; i < missing.length && alive; i += MICRO_BATCH) {
        const batch = missing.slice(i, i + MICRO_BATCH);
        try {
          const { results } = await callGeminiApi('meals_micros', { meals: batch.map((m) => ({ id: m.id, foods: microFoods(m) })) });
          Object.entries(results || {}).forEach(([id, micros]) => {
            microsCache.set(`id:${id}`, micros);
            supabase.from('meals').update({ micros }).eq('id', id).then(() => {}, () => {});
          });
        } catch (e) {
          if (alive) setMicroFill((f) => ({ ...f, running: false, failed: true }));
          return;
        }
        done += batch.length;
        if (alive) { setMicroFill((f) => ({ ...f, done })); setMicroTick((t) => t + 1); }
      }
      if (alive) setMicroFill((f) => ({ ...f, running: false }));
    })();
    return () => { alive = false; };
  }, [show, nutrientTab, isPro, calorieRange, recentMeals]);

  useEffect(() => { if (!proteinTooltip) return; const t = setTimeout(() => setProteinTooltip(null), 2000); return () => clearTimeout(t); }, [proteinTooltip]);
  useEffect(() => { if (!carbsTooltip) return; const t = setTimeout(() => setCarbsTooltip(null), 2000); return () => clearTimeout(t); }, [carbsTooltip]);
  useEffect(() => { if (!fatsTooltip) return; const t = setTimeout(() => setFatsTooltip(null), 2000); return () => clearTimeout(t); }, [fatsTooltip]);
  useEffect(() => { if (!fiberTooltip) return; const t = setTimeout(() => setFiberTooltip(null), 2000); return () => clearTimeout(t); }, [fiberTooltip]);
  useEffect(() => { if (!sugarTooltip) return; const t = setTimeout(() => setSugarTooltip(null), 2000); return () => clearTimeout(t); }, [sugarTooltip]);
  useEffect(() => { if (!sodiumTooltip) return; const t = setTimeout(() => setSodiumTooltip(null), 2000); return () => clearTimeout(t); }, [sodiumTooltip]);
  useEffect(() => { if (!trendTooltip) return; const t = setTimeout(() => setTrendTooltip(null), 2000); return () => clearTimeout(t); }, [trendTooltip]);

  if (!show) return null;

  const meals = recentMeals || [];
  const days = calorieRange === '7 days' ? 7 : calorieRange === '30 days' ? 30 : calorieRange === '90 days' ? 90 : 99999;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const rangeMeals = meals.filter(m => {
    if (days === 99999) return true;
    const t = m.timestamp || new Date(m.date).getTime();
    return !isNaN(t) && t >= cutoff;
  });
  const byDate = {};
  rangeMeals.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0 };
    byDate[m.date].calories += m.calories || 0;
    byDate[m.date].protein += m.protein || 0;
    byDate[m.date].carbs += m.carbs || 0;
    byDate[m.date].fats += m.fats || 0;
    byDate[m.date].fiber += m.fiber || 0;
    byDate[m.date].sugar += m.sugar || 0;
    byDate[m.date].sodium += m.sodium || 0;
  });
  const daysCount = Object.keys(byDate).length;
  const totals = rangeMeals.reduce((s, m) => ({
    calories: s.calories + (m.calories || 0),
    protein: s.protein + (m.protein || 0),
    carbs: s.carbs + (m.carbs || 0),
    fats: s.fats + (m.fats || 0),
    fiber: s.fiber + (m.fiber || 0),
    sugar: s.sugar + (m.sugar || 0),
    sodium: s.sodium + (m.sodium || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sugar: 0, sodium: 0 });
  // Sugar and sodium are only known for meals logged since they were added; average over those days.
  const sugarDays = Object.values(byDate).filter(d => d.sugar > 0 || d.sodium > 0);
  const hasSugarData = sugarDays.length > 0;
  const avgOver = (key) => hasSugarData ? Math.round(sugarDays.reduce((t, d) => t + d[key], 0) / sugarDays.length) : 0;
  const daysOver = (key, ref) => sugarDays.filter(d => d[key] > ref).length;
  // Which meals brought the most of each, over the range.
  const topMeals = (key) => rangeMeals.filter(m => (m[key] || 0) > 0).sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 3);
  const hasData = daysCount > 0;
  const avg = (val) => hasData ? Math.round(val / daysCount) : 0;
  const dailyVals = Object.values(byDate).map(d => d.calories);
  const highest = dailyVals.length > 0 ? Math.max(...dailyVals) : 0;
  const lowest = dailyVals.length > 0 ? Math.min(...dailyVals) : 0;
  const totalMacroCal = (totals.protein * 4) + (totals.carbs * 4) + (totals.fats * 9);
  const pct = (val, multiplier) => totalMacroCal > 0 ? Math.round((val * multiplier / totalMacroCal) * 100) : 0;
  const dailyData = Object.entries(byDate)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const hasMultiple = dailyData.length >= 2;
  const chartLabels = dailyData.map(d => {
    if (calorieRange !== '7 days') return '';
    const dt = new Date(d.date);
    return isNaN(dt.getTime()) ? '' : `${dt.getDate()}/${dt.getMonth() + 1}`;
  });

  const makeMacroChart = (dataPoints, rgbaColor, hexColor, tooltip, setTooltip, unit = 'g') => (
    <View style={{ marginHorizontal: -12, height: 190, overflow: 'hidden', position: 'relative' }}>
      <LineChart
        data={{
          labels: chartLabels,
          datasets: [
            { data: dataPoints.length > 0 ? dataPoints : [0] },
            { data: [0] },
          ],
        }}
        width={SCREEN_WIDTH - 16}
        height={190}
        chartConfig={{
          backgroundColor: dc('#fff', 'bg'),
          backgroundGradientFrom: '#fff',
          backgroundGradientTo: '#fff',
          decimalPlaces: 0,
          color: (opacity = 1) => rgbaColor.replace('1)', `${opacity})`),
          labelColor: () => '#888',
          propsForDots: { r: '0' },
          propsForBackgroundLines: { stroke: 'transparent' },
          fillShadowGradientFrom: hexColor,
          fillShadowGradientTo: hexColor,
          fillShadowGradientFromOpacity: 0.3,
          fillShadowGradientToOpacity: 0.05,
          propsForLabels: { fontSize: 9 },
          paddingRight: 48,
        }}
        renderDotContent={({ x, y }) => (
          <Rect key={`${x}-${y}`} x={x - 3} y={y - 3} width={6} height={6} fill={hexColor} rx={1} />
        )}
        onDataPointClick={({ value, x, y }) => setTooltip(t => t?.x === x && t?.y === y ? null : { value, x, y })}
        bezier
        style={{ borderRadius: 12, marginLeft: -54 }}
        withInnerLines={false}
        withOuterLines={false}
        fromZero={false}
        withHorizontalLabels={false}
      />
      {tooltip && (
        <View style={[styles.chartTooltip, { left: Math.max(0, Math.min(tooltip.x - 30, SCREEN_WIDTH - 120)), top: tooltip.y - 12 }]} pointerEvents="none">
          <Text style={styles.chartTooltipText}>{tooltip.value}{unit}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        {/* Header */}
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color={dc("#059669", 'text')} />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>Calorie Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Time Range Filter */}
        <View style={styles.detailsTimeRange}>
          {['7 days', '30 days', '90 days', 'All time'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.detailsTimeBtn,
                calorieRange === range ? styles.detailsTimeBtnActive : null,
              ]}
              onPress={() => setCalorieRange(range)}
            >
              <Text style={[
                styles.detailsTimeBtnText,
                calorieRange === range ? styles.detailsTimeBtnTextActive : null,
              ]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.weightPageContent} showsVerticalScrollIndicator={false}>
          {/* Calorie Statistics - Compact 4 in a row */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Calorie Statistics</Text>
            <View style={styles.calorieStatsGridCompact}>
              <View style={styles.calorieStatCardCompact}>
                <Ionicons name="flame-outline" size={16} color={dc("#1F1F1F", 'text')} style={{ marginBottom: 4 }} />
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? avg(totals.calories).toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Avg daily</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Ionicons name="bar-chart-outline" size={16} color={dc("#1F1F1F", 'text')} style={{ marginBottom: 4 }} />
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? (totals.calories >= 1000 ? `${(totals.calories / 1000).toFixed(1)}k` : totals.calories) : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Total cal</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Ionicons name="trending-up-outline" size={16} color={dc("#1F1F1F", 'text')} style={{ marginBottom: 4 }} />
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? highest.toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Highest</Text>
              </View>
              <View style={styles.calorieStatCardCompact}>
                <Ionicons name="trending-down-outline" size={16} color={dc("#1F1F1F", 'text')} style={{ marginBottom: 4 }} />
                <Text style={styles.calorieStatCardValueSmall}>{hasData ? lowest.toLocaleString() : '--'}</Text>
                <Text style={styles.calorieStatCardLabelSmall}>Lowest</Text>
              </View>
            </View>
          </View>

          {/* Macronutrients | Micronutrients */}
          <View style={styles.nutrientTabsWrap}>
            <View style={styles.nutrientTabs} accessibilityRole="tablist">
              {[['macro', 'Macronutrients'], ['micro', 'Micronutrients']].map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.nutrientTab, nutrientTab === id && styles.nutrientTabOn]}
                  onPress={() => setNutrientTab(id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: nutrientTab === id }}
                >
                  <Text style={[styles.nutrientTabTxt, nutrientTab === id && styles.nutrientTabTxtOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {nutrientTab === 'micro' ? (
            <View style={styles.detailSection}>
              {!isPro ? (
                <MicrosLocked style={styles.macroCardCompact} showTitle={false} sub="29 essential vitamins and minerals in your food each day, against what your body needs." />
              ) : (() => {
                const withMicros = rangeMeals.filter((m) => microsOf(m));
                const microDays = new Set(withMicros.map((m) => m.date)).size;
                const avgMicros = {};
                MICRO_ITEMS.forEach((it) => {
                  avgMicros[it.key] = microDays ? withMicros.reduce((t, m) => t + (Number(microsOf(m)[it.key]) || 0), 0) / microDays : 0;
                });
                return (
                  <View style={styles.macroCardCompact}>
                    <Text style={styles.extraTitle}>Daily average</Text>
                    {microFill.running && (
                      <View style={styles.microStatus}>
                        <ActivityIndicator size="small" color={dc('#059669', 'text')} />
                        <Text style={styles.microStatusTxt}>Working out your meals... {microFill.done} of {microFill.total}</Text>
                      </View>
                    )}
                    {microFill.failed && <Text style={styles.microStatusTxt}>Couldn't work out every meal right now. Open this tab again to try again.</Text>}
                    {!rangeMeals.length ? (
                      <Text style={styles.microStatusTxt}>No meals logged in this range yet.</Text>
                    ) : withMicros.length ? (
                      <>
                        {withMicros.length < rangeMeals.length && !microFill.running && (
                          <Text style={styles.microStatusTxt}>Based on {withMicros.length} of {rangeMeals.length} meals.</Text>
                        )}
                        <MicroGroups values={avgMicros} />
                      </>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          ) : (
          <View style={styles.detailSection}>
            <View style={styles.macroCardCompact}>
              <View style={styles.macroDistBarCompact}>
                <View style={{ width: hasData ? `${pct(totals.protein, 4)}%` : '33%', height: '100%', backgroundColor: dc('#EF4444', 'bg'), borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
                <View style={{ width: hasData ? `${pct(totals.carbs, 4)}%` : '34%', height: '100%', backgroundColor: dc('#F59E0B', 'bg') }} />
                <View style={{ width: hasData ? `${pct(totals.fats, 9)}%` : '33%', height: '100%', backgroundColor: dc('#8B5CF6', 'bg'), borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
              </View>
              <View style={styles.macroDistLegendCompact}>
                {[['Protein', '#EF4444', pct(totals.protein, 4), avg(totals.protein)], ['Carbs', '#F59E0B', pct(totals.carbs, 4), avg(totals.carbs)], ['Fats', '#8B5CF6', pct(totals.fats, 9), avg(totals.fats)]].map(([label, color, p, g]) => (
                  <View key={label} style={styles.distCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={[styles.macroDistDotSmall, { backgroundColor: color }]} />
                      <Text style={styles.distLabel}>{label}</Text>
                    </View>
                    <Text style={styles.distValue}>{hasData ? `${p}%` : '--'}</Text>
                    <Text style={styles.distSub}>{hasData ? `${g}g a day` : ' '}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.extraDivider} />
              <Text style={styles.extraTitle}>Also in your food (daily average)</Text>
              <View style={styles.extraRow}>
                {[
                  ['Fibre', hasData ? `${avg(totals.fiber)}g` : '--', null],
                  ['Sugar', hasSugarData ? `${avgOver('sugar')}g` : '--', hasSugarData ? avgOver('sugar') > SUGAR_REF_G : null],
                  ['Sodium', hasSugarData ? `${avgOver('sodium').toLocaleString()}mg` : '--', hasSugarData ? avgOver('sodium') > SODIUM_REF_MG : null],
                ].map(([label, value, over]) => (
                  <View key={label} style={styles.extraCol}>
                    <Text style={[styles.extraValue, over === true && { color: dc('#D97706', 'text') }, over === false && { color: dc('#059669', 'text') }]}>{value}</Text>
                    <Text style={styles.extraLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          )}

          {/* One trend chart, switchable by nutrient */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Daily Trends</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {TRENDS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => { setTrendKey(t.key); setTrendTooltip(null); }}
                  style={[styles.trendTab, trendKey === t.key && { backgroundColor: t.hex, borderColor: t.hex }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.trendTabTxt, trendKey === t.key && { color: dc('#fff', 'text') }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {(() => {
              const t = TRENDS.find((x) => x.key === trendKey) || TRENDS[0];
              const isLimit = t.key === 'sugar' || t.key === 'sodium';
              const ok = isLimit ? hasSugarData : hasData;
              const fmt = (v) => (t.unit === 'mg' ? `${Math.round(v).toLocaleString()}mg` : `${Math.round(v)}g`);
              const avgVal = isLimit ? avgOver(t.key) : avg(totals[t.key]);
              const series = dailyData.map((d) => Math.round(d[t.key] || 0));
              const stats = isLimit
                ? [[fmt(avgVal), 'Avg daily'], [fmt(Math.max(0, ...sugarDays.map((d) => d[t.key]))), 'Highest day'], [`${daysOver(t.key, t.ref)} of ${sugarDays.length}`, `Days over ${t.unit === 'mg' ? '2,000mg' : '50g'}`]]
                : t.key === 'fiber'
                  ? [[fmt(avgVal), 'Avg daily'], [fmt(Math.max(0, ...dailyData.map((d) => d.fiber || 0))), 'Best day'], [fmt(totals.fiber), 'Total']]
                  : [[fmt(avgVal), 'Avg daily'], [`${pct(totals[t.key], t.key === 'fats' ? 9 : 4)}%`, 'Of calories'], [fmt(totals[t.key]), 'Total']];
              return (
                <View style={styles.chartCardCompact}>
                  {hasMultiple && ok
                    ? makeMacroChart(series, t.rgba, t.hex, trendTooltip, setTrendTooltip, t.unit)
                    : <View style={{ height: 150, justifyContent: 'center', alignItems: 'center' }}><Text style={styles.chartPlaceholderText}>{ok ? `${fmt(avgVal)} avg` : isLimit ? 'Log a meal to start tracking this' : 'No data yet'}</Text></View>}
                  <View style={styles.macroStatsRowCompact}>
                    {stats.map(([v, l]) => (
                      <View key={l} style={styles.macroStatItemCompact}>
                        <Text style={styles.macroStatValueSmall}>{ok ? v : '--'}</Text>
                        <Text style={styles.macroStatLabelSmall}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  {isLimit && topMeals(t.key).length > 0 && (
                    <View style={styles.topMeals}>
                      <Text style={styles.topMealsTitle}>Most from</Text>
                      {topMeals(t.key).map((m) => (
                        <View key={m.id} style={styles.topMealRow}>
                          <Text style={styles.topMealName} numberOfLines={1}>{m.name}</Text>
                          <Text style={styles.topMealVal}>{fmt(m[t.key])}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {t.note ? <Text style={styles.refNote}>{t.note}</Text> : null}
                </View>
              );
            })()}
          </View>

          <SourcesLink topic="food" only label="Estimates · Sources" color={dc("#6B7280", 'text')} style={{ marginTop: 4, marginBottom: 24 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = themedStyles({
  nutrientTabsWrap: { alignItems: 'center', marginBottom: 12 },
  nutrientTabs: { flexDirection: 'row', gap: 2, padding: 4, borderRadius: 999, backgroundColor: '#F1F5F3' },
  nutrientTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  nutrientTabOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  nutrientTabTxt: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  nutrientTabTxtOn: { color: '#047857' },
  microStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 4 },
  microStatusTxt: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  distCol: { flex: 1, alignItems: 'center' },
  distLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  distValue: { fontSize: 18, fontWeight: '800', color: '#1F1F1F', marginTop: 4 },
  distSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  extraDivider: { height: 1, backgroundColor: '#F1F1EC', marginTop: 14, marginBottom: 12 },
  extraTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  extraRow: { flexDirection: 'row' },
  extraCol: { flex: 1, alignItems: 'center' },
  extraValue: { fontSize: 16, fontWeight: '800', color: '#1F1F1F' },
  extraLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  trendTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  trendTabTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  topMeals: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F1EC' },
  topMealsTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  topMealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  topMealName: { flex: 1, fontSize: 13, color: '#1F1F1F', marginRight: 10 },
  topMealVal: { fontSize: 13, fontWeight: '700', color: '#1F1F1F' },
  refNote: { fontSize: 11.5, lineHeight: 16, color: '#6B7280', marginTop: 10 },
  weightPageOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  weightPage: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    height: SCREEN_HEIGHT,
    flexDirection: 'column',
    flex: 1,
  },
  weightPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  weightBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  weightPageContent: {
    flex: 1,
    padding: 20,
  },
  detailsTimeRange: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailsTimeBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  detailsTimeBtnActive: {
    backgroundColor: '#059669',
  },
  detailsTimeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  detailsTimeBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 10,
  },
  detailSectionTitleNoMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  calorieStatsGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calorieStatCardCompact: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  calorieStatCardIconSmall: {
    fontSize: 16,
    marginBottom: 4,
  },
  calorieStatCardValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  calorieStatCardLabelSmall: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  macroCardCompact: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  macroChartPlaceholder: {
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginBottom: 6,
  },
  macroChartLine: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
  },
  macroStatsRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  macroStatItemCompact: {
    alignItems: 'center',
  },
  macroStatValueSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  macroStatLabelSmall: {
    fontSize: 9,
    color: '#888',
  },
  macroDistribution: {
    paddingVertical: 8,
  },
  macroDistBarCompact: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  macroDistLegendCompact: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroDistItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDistDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 4,
  },
  macroDistLabelSmall: {
    fontSize: 10,
    color: '#444',
    fontWeight: '500',
  },
  chartCardCompact: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  chartPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 4,
  },
  chartTooltip: {
    position: 'absolute',
    backgroundColor: '#1F1F1F',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  chartTooltipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default CalorieDetailsPage;
