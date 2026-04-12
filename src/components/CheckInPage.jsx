import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, TextInput, StyleSheet, Dimensions, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// SCREEN_HEIGHT kept for reference only

const CheckInPage = ({
  show,
  onClose,
  feelings,
  setFeelings,
  fastingStatus,
  setFastingStatus,
  hungerLevel,
  setHungerLevel,
  moods,
  setMoods,
  symptoms,
  setSymptoms,
  fastBreak,
  setFastBreak,
  activities,
  setActivities,
  otherFactors,
  setOtherFactors,
  waterCount,
  setWaterCount,
  notes,
  setNotes,
  onSave,
  volumeUnit = 'oz',
  setVolumeUnit,
  onViewWaterLogs,
}) => {
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [waterEntries, setWaterEntries] = useState([]);
  const [checkInDate, setCheckInDate] = useState(new Date());
  const isToday = checkInDate.toDateString() === new Date().toDateString();

  const formatCheckInDate = () => checkInDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const toggleChip = (value, state, setState) => {
    if (state.includes(value)) {
      setState(state.filter(v => v !== value));
    } else {
      setState([...state, value]);
    }
  };

  const toggleSymptom = (value) => {
    if (value === 'Everything feels fine') {
      setSymptoms(['Everything feels fine']);
    } else {
      const newSymptoms = symptoms.filter(s => s !== 'Everything feels fine');
      if (newSymptoms.includes(value)) {
        setSymptoms(newSymptoms.filter(v => v !== value));
      } else {
        setSymptoms([...newSymptoms, value]);
      }
    }
  };

  return (
    <Modal visible={show} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.checkInPageOverlay}>
      <View style={styles.checkInPage}>
        {/* Header */}
        <View style={styles.checkInHeader}>
          <TouchableOpacity style={styles.checkInNavBtn} onPress={() => {
            const prev = new Date(checkInDate);
            prev.setDate(prev.getDate() - 1);
            setCheckInDate(prev);
          }}>
            <Ionicons name="chevron-back" size={22} color="#059669" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.checkInDateWrapper}>
            <Text style={styles.checkInDateText}>{formatCheckInDate()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkInNavBtn, isToday && { opacity: 0.3 }]}
            onPress={() => {
              if (!isToday) {
                const next = new Date(checkInDate);
                next.setDate(next.getDate() + 1);
                if (next <= new Date()) setCheckInDate(next);
              }
            }}
            disabled={isToday}
          >
            <Ionicons name="chevron-forward" size={22} color="#059669" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.checkInContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.checkInContentContainer}>
          {/* Section 1: How do you feel */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>How are you feeling today?</Text>
            <View style={styles.chipsContainer}>
              {['\u{1F60C} Calm', '\u{1F3AF} Focused', '\u26A1 Energized', '\u{1F634} Low energy', '\u{1F37D}\uFE0F Hungry', '\u{1F924} Very hungry', '\u{1F624} Irritable', '\u{1F4AA}\u{1F3FF} Motivated'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    feelings.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleChip(chip, feelings, setFeelings)}
                >
                  <Text style={[styles.chipText, feelings.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 2: Fasting Status */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Fasting status</Text>
            <View style={styles.chipsContainer}>
              {['\u2705 Fasting as planned', '\u23F0 Broke fast early', '\u23F3 Extended fast', '\u{1F374} Eating window day', '\u{1F634} Rest day (no fast)'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    fastingStatus === chip ? styles.chipSelected : null,
                  ]}
                  onPress={() => setFastingStatus(chip)}
                >
                  <Text style={[styles.chipText, fastingStatus === chip ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 3: Hunger Level */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Hunger level</Text>
            <View style={styles.chipsContainer}>
              {['\u{1F60A} Not hungry', '\u{1F914} Slightly hungry', '\u{1F60B} Hungry', '\u{1F924} Very hungry', '\u{1F62B} Extreme hunger'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    hungerLevel === chip ? styles.chipSelected : null,
                  ]}
                  onPress={() => setHungerLevel(chip)}
                >
                  <Text style={[styles.chipText, hungerLevel === chip ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 4: Mood */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Mood</Text>
            <View style={styles.chipsContainer}>
              {['\u{1F60C} Calm', '\u{1F60A} Happy', '\u{1F3AF} Focused', '\u{1F4AA}\u{1F3FF} Motivated', '\u{1F624} Irritable', '\u{1F630} Anxious', '\u{1F614} Low mood', '\u{1F32B}\uFE0F Mentally foggy', '\u{1F61E} Self-critical', '\u{1F613} Stressed'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    moods.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleChip(chip, moods, setMoods)}
                >
                  <Text style={[styles.chipText, moods.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 5: Fasting Body Symptoms */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Fasting-related symptoms</Text>
            <View style={styles.chipsContainer}>
              {['\u2728 Everything feels fine', '\u{1F634} Low energy', '\u{1F635} Dizziness', '\u{1F915} Headache', '\u{1F4AB} Weakness', '\u{1F976} Cold sensitivity', '\u{1F37D}\uFE0F Hunger pains', '\u{1F36B} Cravings', '\u{1F922} Nausea', '\u{1F32B}\uFE0F Brain fog', '\u{1F914} Trouble concentrating', '\u{1F630} Shakiness'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    symptoms.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleSymptom(chip)}
                >
                  <Text style={[styles.chipText, symptoms.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 6: Fast-Break Details */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>How did you break your fast?</Text>
            <View style={styles.chipsContainer}>
              {['\u{1F957} Light meal', '\u{1F354} Heavy meal', '\u{1F969} Protein-focused', '\u{1F35E} Carb-heavy', '\u{1F36C} Sugary foods', '\u26A1 Ate too fast', '\u{1F60A} Felt good after', '\u{1F623} Felt uncomfortable'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    fastBreak.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleChip(chip, fastBreak, setFastBreak)}
                >
                  <Text style={[styles.chipText, fastBreak.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 7: Activity */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Physical activity</Text>
            <View style={styles.chipsContainer}>
              {["\u{1F6AB} Didn't exercise", '\u{1F6B6}\u{1F3FF} Walking', '\u{1F9D8}\u{1F3FF} Yoga / stretching', '\u{1F3CB}\u{1F3FF} Gym', '\u{1F3C3}\u{1F3FF} Cardio', '\u{1F4AA}\u{1F3FF} Strength training', '\u26BD Sports'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    activities.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleChip(chip, activities, setActivities)}
                >
                  <Text style={[styles.chipText, activities.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 8: Other Factors */}
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>Other</Text>
            <View style={styles.chipsContainer}>
              {['\u{1F613} Stress', '\u{1F634} Poor sleep', '\u{1F60A} Good sleep', '\u2708\uFE0F Travel', '\u{1F9D8}\u{1F3FF} Meditation', '\u{1F32C}\uFE0F Breathwork', '\u{1F377} Alcohol', '\u{1F389} Social event', '\u{1F912} Illness / injury'].map((chip) => (
                <Pressable
                  key={chip}
                  style={[
                    styles.chip,
                    otherFactors.includes(chip) ? styles.chipSelected : null,
                  ]}
                  onPress={() => toggleChip(chip, otherFactors, setOtherFactors)}
                >
                  <Text style={[styles.chipText, otherFactors.includes(chip) ? styles.chipTextSelected : null]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Section 9: Hydration */}
          <View style={styles.checkInSection}>
            <View style={styles.waterSectionHeader}>
              <Text style={styles.checkInSectionTitle}>{'\u{1F4A7}'} Water</Text>
              <TouchableOpacity
                style={styles.unitPickerBtn}
                onPress={() => setShowUnitPicker(!showUnitPicker)}
              >
                <Text style={styles.unitPickerBtnText}>{volumeUnit}</Text>
                <Text style={styles.unitPickerArrow}>{showUnitPicker ? '\u25B2' : '\u25BC'}</Text>
              </TouchableOpacity>
            </View>
            {showUnitPicker && (
              <View style={styles.unitPickerDropdown}>
                {['oz', 'mL', 'sachet', 'bottle'].map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.unitPickerOption, volumeUnit === unit && styles.unitPickerOptionActive]}
                    onPress={() => { setVolumeUnit && setVolumeUnit(unit); setShowUnitPicker(false); }}
                  >
                    <Text style={[styles.unitPickerOptionText, volumeUnit === unit && styles.unitPickerOptionTextActive]}>{unit}</Text>
                    {volumeUnit === unit && <Text style={styles.unitPickerCheck}>{'\u2713'}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.waterCard}>
              <View style={styles.waterCounter}>
                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => setWaterCount(Math.max(0, waterCount - 1))}
                >
                  <Text style={{ color: '#059669', fontSize: 20, fontWeight: '700' }}>{'−'}</Text>
                </TouchableOpacity>
                <View style={styles.waterDisplay}>
                  <Text style={styles.waterAmount}>{waterCount}</Text>
                  <Text style={styles.waterTotal}>{volumeUnit}</Text>
                </View>
                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => setWaterCount(waterCount + 1)}
                >
                  <Text style={{ color: '#059669', fontSize: 20, fontWeight: '700' }}>{'+'}</Text>
                </TouchableOpacity>
              </View>

              {/* Saved water entries for this check-in */}
              {waterEntries.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.waterEntriesScroll} contentContainerStyle={styles.waterEntriesScrollContent}>
                  {waterEntries.map((entry, i) => (
                    <TouchableOpacity key={i} style={styles.waterEntryChip} onPress={() => setWaterEntries(waterEntries.filter((_, idx) => idx !== i))}>
                      <Text style={styles.waterEntryText}>{entry.amount} {entry.unit}</Text>
                      <Text style={styles.waterEntryRemove}>{'\u2715'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

            </View>
            <View style={styles.waterActionsRow}>
              <TouchableOpacity onPress={onViewWaterLogs}>
                <Text style={styles.waterViewLogsText}>View all logs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waterAddEntryBtn}
                onPress={() => {
                  if (waterCount > 0) {
                    setWaterEntries([...waterEntries, { amount: waterCount, unit: volumeUnit }]);
                    setWaterCount(0);
                  }
                }}
              >
                <Text style={styles.waterAddEntryText}>+ Save log</Text>
              </TouchableOpacity>
            </View>
          </View>


          {/* Section 11: Notes */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.checkInSection}>
            <Text style={styles.checkInSectionTitle}>{'\u{1F4DD}'} Notes</Text>
            <View style={styles.notesCard}>
              <TextInput
                multiline
                style={styles.notesInput}
                placeholder="Add notes about your fast, hunger, energy, or anything unusual today."
                placeholderTextColor="#999"
                value={notes}
                onChangeText={(text) => setNotes(text)}
              />
            </View>
          </View>
          </KeyboardAvoidingView>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={styles.checkInFooter}>
          <TouchableOpacity style={styles.checkInSaveBtn} onPress={onSave}>
            <Text style={styles.checkInSaveBtnText}>Save Check-In</Text>
          </TouchableOpacity>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  checkInPageOverlay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  checkInPage: {
    flex: 1,
    flexDirection: 'column',
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  checkInNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInDateWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  checkInDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  checkInContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  checkInContentContainer: {
    paddingBottom: 20,
  },
  checkInSection: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.06)',
  },
  checkInSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#059669',
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 13,
    color: '#444',
  },
  chipTextSelected: {
    color: '#fff',
  },
  waterCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.02)',
    borderRadius: 12,
    padding: 20,
    paddingBottom: 24,
  },
  waterCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterDisplay: {
    alignItems: 'center',
    marginHorizontal: 20,
  },
  waterAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  waterTotal: {
    fontSize: 14,
    color: '#999',
    marginLeft: 4,
  },
  waterLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  waterLinkText: {
    fontSize: 13,
    color: '#059669',
  },
  metricsCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.02)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  metricActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    marginRight: 8,
  },
  metricBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  metricLinkText: {
    fontSize: 12,
    color: '#999',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  metricDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginVertical: 8,
  },
  notesCard: {
    backgroundColor: 'rgba(5, 150, 105, 0.02)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  notesInput: {
    width: '100%',
    minHeight: 100,
    fontSize: 14,
    color: '#1F1F1F',
    lineHeight: 21,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    padding: 0,
  },
  checkInFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  checkInSaveBtn: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(5, 150, 105, 1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 6,
  },
  checkInSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  waterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    zIndex: 100,
  },
  unitPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  unitPickerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  unitPickerArrow: {
    fontSize: 8,
    color: '#059669',
  },
  unitPickerDropdown: {
    position: 'absolute',
    right: 0,
    top: 32,
    width: 120,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  unitPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  unitPickerOptionActive: {
    backgroundColor: '#ECFDF5',
  },
  unitPickerOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  unitPickerOptionTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  unitPickerCheck: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '700',
  },
  waterEntriesScroll: {
    marginTop: 12,
    maxHeight: 40,
  },
  waterEntriesScrollContent: {
    gap: 8,
  },
  waterEntryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  waterEntryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  waterEntryRemove: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  waterActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  waterAddEntryBtn: {
    paddingVertical: 8,
  },
  waterAddEntryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  waterViewLogsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
  },
});

export default CheckInPage;
