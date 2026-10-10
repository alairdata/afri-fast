import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';

const INK = '#16201b';
const INK500 = '#6c7872';
const INK400 = '#97a19b';
const LINE = '#e3e6e1';

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Log a meal by typing it in: no photo, no AI. The way to log for anyone who keeps AI features off
// (App Store guideline 5.1.1(iv): offer an alternative when someone doesn't consent).
const ManualMealForm = ({ selectedMealDate, onSave }) => {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');

  const kcal = Math.round(num(calories));
  const canSave = name.trim().length > 0 && kcal > 0 && kcal <= 10000;

  const save = () => {
    if (!canSave) return;
    const mealDate = selectedMealDate ? new Date(selectedMealDate) : new Date();
    const isToday = mealDate.toDateString() === new Date().toDateString();
    const time = `${isToday ? 'Today' : mealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${mealDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    const food = { name: name.trim(), qty: '1 serving', cal: kcal, protein: num(protein), carbs: num(carbs), fats: num(fats), fiber: 0 };
    onSave({
      id: Date.now(),
      name: food.name,
      calories: kcal,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      fiber: 0,
      time,
      date: mealDate.toDateString(),
      photo: null,
      method: 'manual',
      items: [food.name],
      foods: [food],
    });
  };

  const field = (label, value, set, opts = {}) => (
    <View style={opts.half ? styles.half : null}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder || ''}
        placeholderTextColor={INK400}
        keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
        maxLength={opts.numeric ? 6 : 80}
        returnKeyType="done"
      />
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.intro}>Type what you ate and its calories, from a food label for example. Nothing is sent to AI.</Text>
      {field('What did you eat?', name, setName, { placeholder: 'e.g. Jollof rice and chicken' })}
      {field('Calories (kcal)', calories, setCalories, { numeric: true, placeholder: 'e.g. 650' })}
      <Text style={styles.optional}>Optional</Text>
      <View style={styles.row}>
        {field('Protein (g)', protein, setProtein, { numeric: true, half: true })}
        {field('Carbs (g)', carbs, setCarbs, { numeric: true, half: true })}
        {field('Fat (g)', fats, setFats, { numeric: true, half: true })}
      </View>
      <TouchableOpacity style={[styles.btn, !canSave && styles.btnOff]} disabled={!canSave} onPress={save} activeOpacity={0.85}>
        <Text style={[styles.btnTxt, !canSave && { color: INK400 }]}>Log meal</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 14, lineHeight: 20, color: INK500, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6, marginTop: 12 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: LINE, backgroundColor: '#fff',
    paddingHorizontal: 14, fontSize: 16, color: INK,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  optional: { fontSize: 11.5, fontWeight: '800', color: INK400, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 22 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  btn: { marginTop: 28, height: 54, borderRadius: 14, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: LINE },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ManualMealForm;
