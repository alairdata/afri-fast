import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, SafeAreaView } from 'react-native';
import { useTheme } from '../lib/theme';
import { getInbox, onInboxChange, markAllSeen } from '../lib/notificationInbox';

const ICONS = {
  meal: { name: 'restaurant-outline', color: '#059669', bg: '#ECFDF5' },
  water: { name: 'water-outline', color: '#2563EB', bg: '#EFF6FF' },
  streak: { name: 'flame-outline', color: '#EA580C', bg: '#FFF7ED' },
  movement: { name: 'walk-outline', color: '#7C3AED', bg: '#F5F3FF' },
  burnout: { name: 'heart-outline', color: '#DB2777', bg: '#FDF2F8' },
  insight: { name: 'bulb-outline', color: '#CA8A04', bg: '#FEFCE8' },
  prediction: { name: 'bulb-outline', color: '#CA8A04', bg: '#FEFCE8' },
};
const DEFAULT_ICON = { name: 'notifications-outline', color: '#059669', bg: '#ECFDF5' };

const timeAgo = (at) => {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// The bell on Today: every nudge Lumi has sent in the last 30 days. Opening it marks them seen.
// Tapping one goes where the notification itself would have gone.
const NotificationsPage = ({ visible, onClose, onOpenItem }) => {
  const { colors } = useTheme();
  const [inbox, setInbox] = useState(getInbox());
  useEffect(() => onInboxChange(setInbox), []);
  // Remember what was new when the page opened, so those keep their dot until it closes.
  const [newSince, setNewSince] = useState(0);
  useEffect(() => {
    if (!visible) return;
    setNewSince(getInbox().seenAt);
    markAllSeen();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.page, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-down" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 10 }} showsVerticalScrollIndicator={false}>
          {inbox.items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="notifications-outline" size={34} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>Lumi's reminders and nudges will show up here.</Text>
            </View>
          ) : inbox.items.map((item) => {
            const icon = ICONS[item.type] || DEFAULT_ICON;
            const isNew = item.at > newSince;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => onOpenItem && onOpenItem(item)}
              >
                <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                    {isNew && <View style={styles.newDot} />}
                  </View>
                  {item.body ? <Text style={[styles.rowBody, { color: colors.textSecondary }]}>{item.body}</Text> : null}
                  <Text style={[styles.rowTime, { color: colors.textMuted }]}>{timeAgo(item.at)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14.5, fontWeight: '700' },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  rowBody: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  rowTime: { fontSize: 11.5, marginTop: 6 },
});

export default NotificationsPage;
