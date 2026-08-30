import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ACCENT = '#F97316';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const ICON_BY_TYPE = {
  walking: 'walk-outline', running: 'body-outline', cycling: 'bicycle-outline',
  swimming: 'water-outline', strength: 'barbell-outline', sports: 'football-outline',
};

const ActivityLogPage = ({ show, onClose, activities, setActivities, onActivityDeleted }) => {
  if (!show) return null;

  const sorted = [...(activities || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const deleteActivity = (id) => {
    const log = (activities || []).find(a => a.id === id);
    setActivities((activities || []).filter(a => a.id !== id));
    onActivityDeleted && onActivityDeleted(log);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={styles.title}>Activity Log</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={28} color="#ccc" />
              <Text style={styles.emptyStateText}>No activities logged yet.</Text>
            </View>
          ) : (
            <View style={styles.logsList}>
              {sorted.map((a) => {
                const icon = ICON_BY_TYPE[a.type] || 'ellipsis-horizontal-circle-outline';
                const d = new Date(a.timestamp || a.date);
                const dayNum = !isNaN(d) ? d.getDate() : '--';
                const monthAbbr = !isNaN(d) ? MONTHS_SHORT[d.getMonth()] : '';
                const dayAbbr = !isNaN(d) ? WEEKDAYS[d.getDay()] : '';
                const parts = [`${a.durationMin} min`];
                if (a.distance) parts.push(`${a.distance} ${a.distanceUnit || 'km'}`);
                if (a.estimatedCalories) parts.push(`~${a.estimatedCalories} kcal`);

                return (
                  <View key={a.id} style={styles.logItem}>
                    <View style={styles.logLeft}>
                      <View style={styles.logDateBadge}>
                        <Text style={styles.logDateDay}>{dayNum}</Text>
                        <Text style={styles.logDateMonth}>{monthAbbr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={icon} size={14} color={ACCENT} />
                          <Text style={styles.logName}>{a.name}{a.sessionType ? ` · ${a.sessionType}` : ''}</Text>
                        </View>
                        <Text style={styles.logMeta}>{parts.join(' · ')}</Text>
                      </View>
                    </View>
                    <View style={styles.logRight}>
                      <Text style={styles.logDayName}>{dayAbbr}</Text>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteActivity(a.id)}>
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 10000,
  },
  page: {
    width: '100%', maxWidth: 430, alignSelf: 'center',
    height: SCREEN_HEIGHT, flexDirection: 'column', flex: 1,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1F1F1F' },
  content: { flex: 1, padding: 20 },
  emptyState: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyStateText: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  logsList: { flexDirection: 'column' },
  logItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.08)',
    marginBottom: 8,
  },
  logLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  logDateBadge: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.08)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  logDateDay: { fontSize: 14, fontWeight: '700', color: ACCENT, lineHeight: 16 },
  logDateMonth: { fontSize: 9, fontWeight: '600', color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 11 },
  logName: { fontSize: 14, fontWeight: '700', color: '#1F1F1F' },
  logMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  logRight: { flexDirection: 'row', alignItems: 'center' },
  logDayName: { fontSize: 11, color: '#bbb', marginRight: 8 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.06)', alignItems: 'center', justifyContent: 'center',
  },
});

export default ActivityLogPage;
