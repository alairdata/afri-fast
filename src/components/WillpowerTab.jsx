import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { addWillpowerEntry, WILLPOWER_KEY } from '../lib/willpower';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import Confetti from './Confetti';
import WillpowerTree, { STAGE_NAMES, STAGE_THRESHOLDS, getStageIndex, getXpInfo } from './WillpowerTree';

const SAVAGE_MESSAGES = [
  "You just did what most people can't.\nYou won.",
  "That craving had no idea who it was dealing with.",
  "The weak version of you would've folded.\nThey didn't show up today.",
  "Every no you say makes the next one easier.",
  "You're building something most people never will.",
  "That's willpower. And it's yours forever.",
  "Your future self is watching. They're proud.",
  "Hunger is temporary. This strength is permanent.",
  "You just added to something that never resets.",
  "Most people quit here. You didn't.\nThat's the difference.",
  "One resistance at a time. This is how it's done.",
  "Your willpower just compounded. Watch it grow.",
  "Almost gave in — and chose not to.\nThat's who you are.",
  "The body asked. The mind said no.\nThat's mastery.",
  "No one saw that battle. But your tree knows.",
  "One more brick. The wall is getting taller.",
  "Did you feel that? That's your willpower flexing.",
  "You're not just fasting. You're building an identity.",
  "Soft people give in. You just proved which kind you are.",
  "The garden of grit just grew.",
];

const STRUGGLE_MESSAGES = [
  "That took courage to admit.\nYour tree is still here waiting.",
  "Even logging this moment is strength.\nCome back when you're ready.",
  "Every warrior rests. Your willpower doesn't disappear.",
  "Awareness is the first act of discipline.\nYou're not done.",
  "The tree doesn't die when you rest.\nIt's still yours.",
];

const BADGES = [
  { id: 'first_blood',   name: 'First Blood',     desc: 'First resistance logged',        icon: '🔥', req: (c) => c >= 1 },
  { id: 'iron_will',     name: 'Iron Will',        desc: '5 resistances',                  icon: '💪', req: (c) => c >= 5 },
  { id: 'second_wind',   name: 'Second Wind',      desc: '10 resistances',                 icon: '💨', req: (c) => c >= 10 },
  { id: 'unbreakable',   name: 'Unbreakable',      desc: '20 resistances',                 icon: '⛓️', req: (c) => c >= 20 },
  { id: 'architect',     name: 'The Architect',    desc: '30 resistances',                 icon: '🏗️', req: (c) => c >= 30 },
  { id: 'anchor',        name: 'The Anchor',       desc: '50 resistances',                 icon: '⚓', req: (c) => c >= 50 },
  { id: 'titanium',      name: 'Titanium',         desc: '75 resistances',                 icon: '🪨', req: (c) => c >= 75 },
  { id: 'centurion',     name: 'Centurion',        desc: '100 resistances',                icon: '🛡️', req: (c) => c >= 100 },
  { id: 'unstoppable',   name: 'Unstoppable',      desc: '150 resistances',                icon: '⚡', req: (c) => c >= 150 },
  { id: 'ancient',       name: 'Ancient Oak',      desc: '200 resistances — full power',   icon: '🌳', req: (c) => c >= 200 },
];

const W = Dimensions.get('window').width;
const WILLPOWER_KEY = 'willpower_v1';

export default function WillpowerTab({ userId }) {
  const { colors, isDark } = useTheme();
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('idle'); // idle | pause | resisted | struggling
  const [pulseKey, setPulseKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [overlay, setOverlay] = useState(null); // { text, isLevelUp }

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pauseScale = useRef(new Animated.Value(0.8)).current;
  const pauseOpacity = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const breathLoop = useRef(null);

  // Idle button pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(btnScale, { toValue: 1.06, duration: 1100, useNativeDriver: true }),
        Animated.timing(btnScale, { toValue: 1.0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Overlay fade
  useEffect(() => {
    if (!overlay) return;
    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(overlay.isLevelUp ? 3200 : 2600),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start(() => setOverlay(null));
  }, [overlay]);

  // Load count
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`${WILLPOWER_KEY}_${userId}`);
        if (raw) setCount(parseInt(raw) || 0);
      } catch (_) {}
      // Sync from Supabase
      try {
        const { count: remoteCount } = await supabase
          .from('willpower_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (remoteCount != null) {
          setCount(remoteCount);
          await AsyncStorage.setItem(`${WILLPOWER_KEY}_${userId}`, String(remoteCount));
        }
      } catch (_) {}
      setLoading(false);
      loadHistory();
    })();
  }, [userId]);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('willpower_logs')
        .select('id, created_at, label')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setHistory(data);
    } catch (_) {}
  }, [userId]);

  const openPause = () => {
    setMode('pause');
    Animated.parallel([
      Animated.spring(pauseScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 8 }),
      Animated.timing(pauseOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    // Breathing animation loop
    breathLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    );
    breathLoop.current.start();
  };

  const closePause = () => {
    breathLoop.current?.stop();
    Animated.parallel([
      Animated.timing(pauseOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(pauseScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setMode('idle');
      pauseScale.setValue(0.8);
    });
  };

  const handleResisted = async () => {
    breathLoop.current?.stop();
    Animated.parallel([
      Animated.timing(pauseOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => { pauseScale.setValue(0.8); setMode('idle'); });

    const prevStage = getStageIndex(count);
    const newCount = count + 1;
    const newStage = getStageIndex(newCount);
    setCount(newCount);
    setPulseKey(k => k + 1);
    setConfettiKey(k => k + 1);
    setShowConfetti(true);
    if (Platform.OS === 'web' && navigator?.vibrate) navigator.vibrate([20, 60, 20]);

    const didLevelUp = newStage > prevStage;
    setOverlay({
      text: didLevelUp
        ? `LEVEL UP!\nYou've grown into a ${STAGE_NAMES[newStage]}`
        : SAVAGE_MESSAGES[Math.floor(Math.random() * SAVAGE_MESSAGES.length)],
      isLevelUp: didLevelUp,
    });

    await addWillpowerEntry(userId, null);
    loadHistory();
  };

  const handleStruggling = () => {
    closePause();
    setOverlay({
      text: STRUGGLE_MESSAGES[Math.floor(Math.random() * STRUGGLE_MESSAGES.length)],
      isLevelUp: false,
    });
  };

  const xpInfo = getXpInfo(count);
  const stage = xpInfo.stage;
  const xpAnim = useRef(new Animated.Value(xpInfo.pct)).current;

  useEffect(() => {
    Animated.timing(xpAnim, { toValue: xpInfo.pct, duration: 700, useNativeDriver: false }).start();
  }, [count]);

  const barWidth = xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const earnedBadges = BADGES.filter(b => b.req(count));

  const formatDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff} days ago`;
  };

  const treeSize = Math.min(W * 0.58, 230);

  const bg = isDark ? '#0d1f18' : '#f0faf4';

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Garden of Grit</Text>
          <View style={[styles.pointsBadge, { backgroundColor: '#059669' }]}>
            <Text style={styles.pointsText}>{count} pts</Text>
          </View>
        </View>

        {/* Tree */}
        <View style={styles.treeWrap}>
          <WillpowerTree count={count} pulseKey={pulseKey} size={treeSize} />
          <Text style={[styles.stageName, { color: '#40c074' }]}>{STAGE_NAMES[stage]}</Text>
        </View>

        {/* XP Bar */}
        <View style={[styles.xpSection, { backgroundColor: isDark ? '#1a3328' : '#fff' }]}>
          <View style={styles.xpHeader}>
            <Text style={[styles.xpLabel, { color: colors.text }]}>
              {xpInfo.isMax ? 'Maximum power achieved' : `${xpInfo.current}/${xpInfo.needed} → ${STAGE_NAMES[Math.min(stage + 1, STAGE_NAMES.length - 1)]}`}
            </Text>
            <Text style={[styles.xpTotal, { color: colors.textMuted }]}>{count} total</Text>
          </View>
          <View style={[styles.xpBg, { backgroundColor: isDark ? '#0d1f18' : '#e8f5e9' }]}>
            <Animated.View style={[styles.xpFill, { width: barWidth }]} />
          </View>
        </View>

        {/* Main Button */}
        <View style={styles.btnArea}>
          <TouchableOpacity onPress={openPause} activeOpacity={0.88}>
            <Animated.View style={[styles.mainBtn, { transform: [{ scale: btnScale }] }]}>
              <Text style={styles.mainBtnIcon}>🌿</Text>
              <Text style={styles.mainBtnText}>I'M RESISTING</Text>
              <Text style={styles.mainBtnSub}>Tap when you feel like giving up</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <View style={[styles.badgesSection, { backgroundColor: isDark ? '#1a3328' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges Earned</Text>
            <View style={styles.badgesRow}>
              {earnedBadges.map(b => (
                <View key={b.id} style={[styles.badge, { backgroundColor: isDark ? '#0d2e1f' : '#f0faf4' }]}>
                  <Text style={styles.badgeIcon}>{b.icon}</Text>
                  <Text style={[styles.badgeName, { color: colors.text }]}>{b.name}</Text>
                  <Text style={[styles.badgeDesc, { color: colors.textMuted }]}>{b.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Locked badges teaser */}
        {earnedBadges.length < BADGES.length && (
          <View style={[styles.badgesSection, { backgroundColor: isDark ? '#1a3328' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Milestones</Text>
            <View style={styles.badgesRow}>
              {BADGES.filter(b => !b.req(count)).slice(0, 3).map(b => (
                <View key={b.id} style={[styles.badge, styles.badgeLocked, { backgroundColor: isDark ? '#0d2e1f' : '#f0faf4' }]}>
                  <Text style={[styles.badgeIcon, { opacity: 0.3 }]}>{b.icon}</Text>
                  <Text style={[styles.badgeName, { color: colors.textMuted }]}>{b.name}</Text>
                  <Text style={[styles.badgeDesc, { color: colors.textMuted }]}>{b.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={[styles.historySection, { backgroundColor: isDark ? '#1a3328' : '#fff' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Victories</Text>
            {history.map((h, i) => (
              <View key={h.id || i} style={[styles.historyRow, { borderBottomColor: isDark ? '#1b4332' : '#e8f5e9' }]}>
                <Text style={styles.historyDot}>▸</Text>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDate(h.created_at)}</Text>
                {h.label ? <Text style={[styles.historyLabel, { color: colors.text }]}>{h.label}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Pause Overlay */}
      {mode === 'pause' && (
        <Animated.View style={[styles.pauseOverlay, { opacity: pauseOpacity }]}>
          <Animated.View style={[styles.pauseCard, { transform: [{ scale: pauseScale }], backgroundColor: isDark ? '#0d2e1f' : '#fff' }]}>
            {/* Breathing circle */}
            <Animated.View style={[styles.breathCircle, {
              transform: [{ scale: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] }) }],
              opacity: breathAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            }]} />
            <Text style={[styles.pauseTitle, { color: colors.text }]}>You've got this.</Text>
            <Text style={[styles.pauseQ, { color: colors.textMuted }]}>Why are you doing this?</Text>
            <Text style={[styles.pauseHint, { color: colors.textMuted }]}>Breathe. Then choose.</Text>
            <View style={styles.pauseBtns}>
              <TouchableOpacity style={[styles.resistedBtn, { backgroundColor: '#059669' }]} onPress={handleResisted}>
                <Text style={styles.resistedBtnText}>I RESISTED</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.strugglingBtn, { borderColor: isDark ? '#2d6a4f' : '#ccc' }]} onPress={handleStruggling}>
                <Text style={[styles.strugglingBtnText, { color: colors.textMuted }]}>I'm still struggling</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={closePause} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Message Overlay */}
      {overlay && (
        <Animated.View style={[styles.msgOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
          {overlay.isLevelUp && <Text style={styles.levelUpLabel}>LEVEL UP!</Text>}
          <Text style={[styles.msgText, overlay.isLevelUp && styles.levelUpText]}>{overlay.text}</Text>
        </Animated.View>
      )}

      {/* Confetti */}
      {showConfetti && <Confetti key={confettiKey} onDone={() => setShowConfetti(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  pointsBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  pointsText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  treeWrap: { alignItems: 'center', marginVertical: 8 },
  stageName: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  xpSection: { borderRadius: 16, padding: 14, marginVertical: 8 },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  xpLabel: { fontSize: 13, fontWeight: '600' },
  xpTotal: { fontSize: 12 },
  xpBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#40c074', borderRadius: 5 },
  btnArea: { alignItems: 'center', marginVertical: 16 },
  mainBtn: {
    width: W * 0.82,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    shadowColor: '#40c074',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  mainBtnIcon: { fontSize: 30, marginBottom: 6 },
  mainBtnText: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  mainBtnSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  badgesSection: { borderRadius: 16, padding: 14, marginVertical: 6 },
  badgesRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  badge: { borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 90, flex: 1 },
  badgeLocked: { opacity: 0.6 },
  badgeIcon: { fontSize: 26, marginBottom: 4 },
  badgeName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  badgeDesc: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  historySection: { borderRadius: 16, padding: 14, marginVertical: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  historyDot: { color: '#40c074', fontSize: 14 },
  historyDate: { fontSize: 13 },
  historyLabel: { fontSize: 13, flex: 1 },
  // Pause overlay
  pauseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  pauseCard: { width: W * 0.88, borderRadius: 24, padding: 28, alignItems: 'center', overflow: 'hidden' },
  breathCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#40c074',
    marginBottom: 20,
  },
  pauseTitle: { fontSize: 26, fontWeight: '900', marginBottom: 6, textAlign: 'center' },
  pauseQ: { fontSize: 15, textAlign: 'center', marginBottom: 4 },
  pauseHint: { fontSize: 12, textAlign: 'center', marginBottom: 24 },
  pauseBtns: { width: '100%', gap: 12 },
  resistedBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  resistedBtnText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.8 },
  strugglingBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.5 },
  strugglingBtnText: { fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 13 },
  // Message overlay
  msgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 32,
  },
  msgText: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  levelUpLabel: { color: '#40c074', fontSize: 14, fontWeight: '900', letterSpacing: 3, marginBottom: 12 },
  levelUpText: { color: '#40c074', fontSize: 26 },
});
