import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Vibration } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ITEM_H = 48;
const VISIBLE = 5;
const PICKER_H = ITEM_H * VISIBLE;

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

const formatDateLabel = (dateStr) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (dateStr === todayStr) return 'Today';
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return `${DAY_NAMES[d.getDay()]} ${dd} ${MONTH_NAMES[mm - 1]}`;
};

const hours = Array.from({ length: 24 }, (_, i) => i);
const mins  = Array.from({ length: 60 }, (_, i) => i);

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6);
    } else {
      Vibration.vibrate(10);
    }
  } catch (_) {}
};

const PickerCol = ({ items, value, onChange, format, flex }) => {
  const ref = useRef(null);
  const idx = items.indexOf(value);

  useEffect(() => {
    if (idx < 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ref.current?.scrollTo({ y: idx * ITEM_H, animated: false });
      });
    });
  }, []);

  const handleScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    if (i >= 0 && i < items.length) onChange(items[i]);
  };

  const handleScroll = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    if (i >= 0 && i < items.length && items[i] !== value) {
      onChange(items[i]);
      triggerHaptic();
    }
  };

  return (
    <View style={[col.wrap, { flex: flex || 1 }]}>
      <View style={col.selBand} pointerEvents="none" />
      <ScrollView
        ref={ref}
        style={{ height: PICKER_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={ITEM_H}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - idx);
          return (
            <TouchableOpacity
              key={String(item)}
              style={col.item}
              activeOpacity={0.7}
              onPress={() => {
                onChange(item);
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
              }}
            >
              <Text style={[
                col.text,
                dist === 0 && col.textSel,
                dist === 1 && col.textNear,
                dist >= 2 && col.textFar,
              ]}>
                {format ? format(item) : typeof item === 'number' ? String(item).padStart(2, '0') : item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <LinearGradient colors={['#FFFFFF', 'rgba(255,255,255,0)']} style={col.fadeTop} pointerEvents="none" />
      <LinearGradient colors={['rgba(255,255,255,0)', '#FFFFFF']} style={col.fadeBot} pointerEvents="none" />
    </View>
  );
};

const col = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'hidden' },
  selBand: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 6, right: 6,
    height: ITEM_H,
    backgroundColor: 'rgba(5,150,105,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.18)',
    zIndex: 1,
  },
  item:     { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  text:     { fontSize: 18, fontWeight: '500', color: '#1F1F1F' },
  textSel:  { fontSize: 21, fontWeight: '800', color: '#059669' },
  textNear: { fontSize: 17, fontWeight: '400', color: '#9CA3AF' },
  textFar:  { fontSize: 14, fontWeight: '400', color: '#E5E7EB' },
  fadeTop:  { position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2, zIndex: 2 },
  fadeBot:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2, zIndex: 2 },
});

const TimeEditModal = ({
  show, onClose, onSave, editingTime,
  editDateStr, setEditDateStr,
  startHour, startMinute, startSecond,
  endHour, endMinute, endSecond,
  setStartHour, setStartMinute, setStartSecond,
  setEndHour, setEndMinute, setEndSecond,
}) => {
  const dates = useMemo(() => buildDates(), []);

  if (!show) return null;

  const isStart = editingTime === 'start';
  const hour    = isStart ? startHour   : endHour;
  const minute  = isStart ? startMinute : endMinute;
  const setHour = isStart ? setStartHour   : setEndHour;
  const setMin  = isStart ? setStartMinute : setEndMinute;

  const activeDateStr = dates.includes(editDateStr) ? editDateStr : dates[dates.length - 1];

  return (
    <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>

        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.title}>{isStart ? 'Start Time' : 'End Time'}</Text>
          <TouchableOpacity onPress={onSave} style={s.doneBtn}>
            <Text style={s.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Column labels */}
        <View style={s.colLabels}>
          <Text style={[s.colLabel, { flex: 2, textAlign: 'center' }]}>Date</Text>
          <View style={{ width: 1 }} />
          <Text style={[s.colLabel, { flex: 1, textAlign: 'center' }]}>Hour</Text>
          <View style={{ width: 28 }} />
          <Text style={[s.colLabel, { flex: 1, textAlign: 'center' }]}>Min</Text>
        </View>

        {/* Pickers */}
        <View style={s.pickers}>
          <PickerCol items={dates} value={activeDateStr} onChange={setEditDateStr} format={formatDateLabel} flex={2} />
          <View style={s.divider} />
          <PickerCol items={hours} value={hour} onChange={setHour} flex={1} />
          <View style={s.colonWrap}>
            <Text style={s.colonText}>:</Text>
          </View>
          <PickerCol items={mins} value={minute} onChange={setMin} flex={1} />
        </View>

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
    alignItems: 'center',
    zIndex: 1000,
  },
  sheet: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cancelBtn: { minWidth: 70 },
  cancelText: { fontSize: 15, color: '#9CA3AF', fontWeight: '500' },
  title: { fontSize: 16, fontWeight: '700', color: '#111', letterSpacing: -0.3 },
  doneBtn: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 70,
    alignItems: 'center',
  },
  doneText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  colLabels: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(0,0,0,0.28)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pickers: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: PICKER_H * 0.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  colonWrap: {
    width: 28,
    alignItems: 'center',
    paddingBottom: 4,
  },
  colonText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#059669',
  },
});

export default TimeEditModal;
