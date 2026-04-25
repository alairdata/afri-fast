import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const buildDates = () => {
  const result = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    result.push(`${yyyy}-${mm}-${dd}`);
  }
  return result;
};

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

const formatDateLabel = (dateStr) => {
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return `${DAY_NAMES[d.getDay()]} ${dd} ${MONTH_NAMES[mm - 1]}`;
};

const TimeEditModal = ({
  show, onClose, onSave, editingTime,
  editDateStr, setEditDateStr,
  startHour, startMinute,
  endHour, endMinute,
  setStartHour, setStartMinute,
  setEndHour, setEndMinute,
}) => {
  const dates = useMemo(() => buildDates(), []);
  const scrollRef = useRef(null);

  const isStart = editingTime === 'start';
  const hour    = isStart ? startHour   : endHour;
  const minute  = isStart ? startMinute : endMinute;
  const setHour = isStart ? setStartHour : setEndHour;
  const setMin  = isStart ? setStartMinute : setEndMinute;
  const activeDateStr = dates.includes(editDateStr) ? editDateStr : dates[dates.length - 1];

  useEffect(() => {
    if (!show) return;
    const idx = dates.indexOf(activeDateStr);
    if (idx >= 0) {
      setTimeout(() => scrollRef.current?.scrollTo({ x: idx * 100, animated: true }), 120);
    }
  }, [show]);

  if (!show) return null;

  const fmtNum = n => String(n).padStart(2, '0');
  const period = hour >= 12 ? 'PM' : 'AM';
  const display12 = hour % 12 || 12;

  return (
    <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity style={s.card} activeOpacity={1} onPress={() => {}}>

        <Text style={s.title}>{isStart ? 'Start Time' : 'End Time'}</Text>

        {/* Date chip strip */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipContent}
        >
          {dates.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setEditDateStr(d)}
              style={[s.chip, activeDateStr === d && s.chipActive]}
            >
              <Text style={[s.chipText, activeDateStr === d && s.chipTextActive]}>
                {formatDateLabel(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time stepper */}
        <View style={s.timeRow}>
          {/* Hour */}
          <View style={s.timeCol}>
            <TouchableOpacity style={s.chevron} onPress={() => setHour((hour + 1) % 24)}>
              <Ionicons name="chevron-up" size={20} color="#059669" />
            </TouchableOpacity>
            <View style={s.numBox}>
              <Text style={s.timeNum}>{fmtNum(display12)}</Text>
            </View>
            <TouchableOpacity style={s.chevron} onPress={() => setHour((hour + 23) % 24)}>
              <Ionicons name="chevron-down" size={20} color="#059669" />
            </TouchableOpacity>
          </View>

          <Text style={s.colon}>:</Text>

          {/* Minute */}
          <View style={s.timeCol}>
            <TouchableOpacity style={s.chevron} onPress={() => setMin((minute + 1) % 60)}>
              <Ionicons name="chevron-up" size={20} color="#059669" />
            </TouchableOpacity>
            <View style={s.numBox}>
              <Text style={s.timeNum}>{fmtNum(minute)}</Text>
            </View>
            <TouchableOpacity style={s.chevron} onPress={() => setMin((minute + 59) % 60)}>
              <Ionicons name="chevron-down" size={20} color="#059669" />
            </TouchableOpacity>
          </View>

          {/* AM/PM */}
          <View style={s.ampmCol}>
            <TouchableOpacity
              style={[s.ampmBtn, hour < 12 && s.ampmBtnActive]}
              onPress={() => { if (hour >= 12) setHour(hour - 12); }}
            >
              <Text style={[s.ampmText, hour < 12 && s.ampmTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ampmBtn, hour >= 12 && s.ampmBtnActive]}
              onPress={() => { if (hour < 12) setHour(hour + 12); }}
            >
              <Text style={[s.ampmText, hour >= 12 && s.ampmTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={s.doneBtn} onPress={onSave}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>

      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingBottom: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    width: '88%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  chipScroll: { width: '100%', marginBottom: 24 },
  chipContent: { gap: 8, paddingHorizontal: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  chipActive: { backgroundColor: '#059669' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  timeCol: { alignItems: 'center', gap: 6 },
  chevron: {
    width: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
  },
  numBox: {
    width: 72,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  timeNum: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -1,
  },
  colon: {
    fontSize: 32,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
    marginHorizontal: 2,
  },
  ampmCol: {
    gap: 8,
    marginLeft: 4,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  ampmBtnActive: { backgroundColor: '#059669' },
  ampmText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  ampmTextActive: { color: '#fff' },
  doneBtn: {
    width: '100%',
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn: { paddingVertical: 6 },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});

export default TimeEditModal;
