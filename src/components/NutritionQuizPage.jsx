import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  TextInput,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Questions data
// ---------------------------------------------------------------------------
const QUESTIONS = [
  {
    id: 1,
    text: 'What is your biological sex?',
    type: 'single',
    options: [
      { label: 'Male' },
      { label: 'Female' },
    ],
  },
  {
    id: 2,
    text: 'How old are you?',
    type: 'numeric',
    units: ['years'],
    defaultUnit: 'years',
    defaultValue: 25,
    min: 13,
    max: 100,
    step: 1,
  },
  {
    id: 3,
    text: 'What is your current weight?',
    type: 'numeric',
    units: ['kg', 'lbs'],
    defaultUnit: 'kg',
    defaultValue: 70,
    min: 30,
    max: 300,
  },
  {
    id: 4,
    text: 'What is your height?',
    type: 'numeric',
    units: ['cm', 'ft'],
    defaultUnit: 'cm',
    defaultValue: 170,
    min: 100,
    max: 250,
  },
  {
    id: 5,
    text: 'How active are you?',
    type: 'single',
    options: [
      { label: 'Sedentary \u2014 little or no exercise' },
      { label: 'Lightly active \u2014 1-3x per week' },
      { label: 'Moderately active \u2014 3-5x per week' },
      { label: 'Very active \u2014 6-7x per week' },
      { label: 'Athlete / twice-daily training' },
    ],
  },
  {
    id: 6,
    text: 'What is your primary goal?',
    type: 'single',
    options: [
      { label: 'Weight loss' },
      { label: 'Maintenance' },
      { label: 'Muscle gain / bulk' },
      { label: 'Body recomposition' },
      { label: 'Medical / therapeutic' },
    ],
  },
  {
    id: 7,
    text: 'How fast do you want to reach your goal?',
    type: 'single',
    conditional: true, // only show if Q6 = weight loss or muscle gain
    options: [
      { label: 'Slow and steady (0.25 kg/week)' },
      { label: 'Moderate (0.5 kg/week)', badge: 'Recommended' },
      { label: 'Aggressive (0.75-1 kg/week)' },
    ],
  },
  {
    id: 8,
    text: 'Do you have any conditions?',
    type: 'multi',
    options: [
      { label: 'Type 1 or Type 2 diabetes' },
      { label: 'PCOS' },
      { label: 'Thyroid disorder' },
      { label: 'History of eating disorders' },
      { label: 'Kidney disease' },
      { label: 'None of the above' },
    ],
  },
  {
    id: 9,
    text: 'Do you follow a dietary style?',
    type: 'single',
    options: [
      { label: 'No preference / balanced' },
      { label: 'High protein / gym-focused' },
      { label: 'Low carb' },
      { label: 'Vegan / plant-based' },
      { label: "I don't know" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const AGE_MIDPOINTS = [16, 24, 40, 57, 70];
const ACTIVITY_MULTIPLIERS = [1.2, 1.375, 1.55, 1.725, 1.9];
const MACRO_SPLITS = {
  0: { carbs: 0.40, protein: 0.30, fat: 0.30 }, // balanced
  1: { carbs: 0.35, protein: 0.40, fat: 0.25 }, // high protein
  2: { carbs: 0.20, protein: 0.35, fat: 0.45 }, // low carb
  3: { carbs: 0.40, protein: 0.30, fat: 0.30 }, // vegan
  4: { carbs: 0.40, protein: 0.30, fat: 0.30 }, // don't know
};

const TOTAL_QUESTIONS = 9;

// ---------------------------------------------------------------------------
// Calculation engine
// ---------------------------------------------------------------------------
function calculateResult(answers) {
  const hardFlags = [];
  const softFlags = [];
  const notes = [];

  // Q1: sex
  const sex = answers[0]; // 0 = Male, 1 = Female
  const isMale = sex === 0;

  // Q2: age (exact number from stepper)
  const age = answers[1] || 25;
  if (age < 18) {
    softFlags.push('You are under 18. Calorie restriction should be approached with caution and ideally supervised by a healthcare provider.');
  }
  const isElderly = age >= 65;
  if (isElderly) {
    softFlags.push('For adults 65+, calorie deficits are capped at 300 kcal to preserve muscle mass and bone density.');
  }

  // Q3: weight
  const weightData = answers[2] || { value: 70, unit: 'kg' };
  let weightKg = weightData.value;
  if (weightData.unit === 'lbs') {
    weightKg = weightData.value / 2.205;
  }

  // Q4: height
  const heightData = answers[3] || { value: 170, unit: 'cm' };
  let heightCm = heightData.value;
  if (heightData.unit === 'ft') {
    // value stored as total inches when in ft mode, or as cm
    // We store feet and inches separately: { value: totalCm, unit: 'ft', feet, inches }
    if (heightData.feet !== undefined) {
      heightCm = (heightData.feet * 30.48) + ((heightData.inches || 0) * 2.54);
    }
  }

  // Q5: activity
  const activityIdx = answers[4] !== null && answers[4] !== undefined ? answers[4] : 0;
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityIdx] || 1.2;

  // Q6: goal
  const goalIdx = answers[5] !== null && answers[5] !== undefined ? answers[5] : 1;
  const isMedical = goalIdx === 4;
  if (isMedical) {
    hardFlags.push('You selected a medical/therapeutic goal. We strongly recommend working with a registered dietitian or doctor to determine your calorie needs.');
  }

  // Q7: pace (only relevant for weight loss or muscle gain)
  const paceIdx = answers[6];
  const isWeightLoss = goalIdx === 0;
  const isMuscleGain = goalIdx === 2;

  // Q8: conditions (multi)
  const conditions = answers[7] || [];
  const hasDiabetes = conditions.includes(0);
  const hasPCOS = conditions.includes(1);
  const hasThyroid = conditions.includes(2);
  const hasEatingDisorder = conditions.includes(3);
  const hasKidney = conditions.includes(4);

  if (hasDiabetes) {
    hardFlags.push('You indicated diabetes. Calorie and carb management should be supervised by your healthcare team.');
  }
  if (hasPCOS) {
    softFlags.push('PCOS noted. A lower-carb approach may help manage insulin resistance.');
  }
  if (hasThyroid) {
    softFlags.push('Thyroid disorders can affect metabolism. Monitor energy levels and consult your doctor if needed.');
  }
  if (hasEatingDisorder) {
    hardFlags.push('You indicated a history of eating disorders. Tracking calories can be triggering. We recommend speaking with a registered dietitian.');
  }
  if (hasKidney) {
    hardFlags.push('Kidney disease requires careful protein management. High protein intake may not be safe. Consult your nephrologist.');
  }

  // Q9: dietary style
  const dietIdx = answers[8] !== null && answers[8] !== undefined ? answers[8] : 0;
  const macroSplit = MACRO_SPLITS[dietIdx] || MACRO_SPLITS[0];
  if (dietIdx === 3) {
    notes.push('As a vegan, ensure adequate B12, iron, and complete protein sources (combining legumes with grains).');
  }
  if (dietIdx === 4) {
    notes.push('We\'ve set you up with a balanced 40/30/30 split (carbs/protein/fat). This is a great starting point for most people.');
  }

  // --- BMR (Mifflin-St Jeor) ---
  const bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + (isMale ? 5 : -161);

  // --- TDEE ---
  const tdee = bmr * activityMultiplier;

  // --- Goal adjustment ---
  let goalAdjustment = 0;
  if (isWeightLoss) {
    if (paceIdx === 0) goalAdjustment = -250;
    else if (paceIdx === 2) {
      goalAdjustment = -750;
      softFlags.push('Aggressive weight loss (0.75-1 kg/week) is not sustainable long term. Consider a moderate approach after initial weeks.');
    } else goalAdjustment = -500; // default moderate
  } else if (isMuscleGain) {
    if (paceIdx === 0) goalAdjustment = 250;
    else if (paceIdx === 2) goalAdjustment = 750;
    else goalAdjustment = 300; // default moderate
  } else if (goalIdx === 3) {
    // Body recomposition
    goalAdjustment = 0;
  } else if (isMedical) {
    goalAdjustment = 0;
  }

  // Elderly cap: max 300 kcal deficit
  if (isElderly && goalAdjustment < -300) {
    goalAdjustment = -300;
  }

  let calories = Math.round(tdee + goalAdjustment);

  // Safety floors
  const safetyFloor = isMale ? 1500 : 1200;
  if (calories < safetyFloor) {
    calories = safetyFloor;
    softFlags.push(`Your calculated intake was below the safety floor. We've set it to ${safetyFloor} kcal to ensure adequate nutrition.`);
  }

  // --- Macros ---
  let proteinGrams = Math.round((calories * macroSplit.protein) / 4);
  let carbsGrams = Math.round((calories * macroSplit.carbs) / 4);
  let fatGrams = Math.round((calories * macroSplit.fat) / 9);

  // Protein floor: 0.8g per kg bodyweight
  const proteinFloor = Math.round(0.8 * weightKg);
  if (proteinGrams < proteinFloor) {
    const oldProteinCals = proteinGrams * 4;
    proteinGrams = proteinFloor;
    const newProteinCals = proteinGrams * 4;
    const diff = newProteinCals - oldProteinCals;
    // Reduce carbs to compensate
    carbsGrams = Math.max(0, carbsGrams - Math.round(diff / 4));
  }

  // Kidney warning: cap protein
  if (hasKidney && proteinGrams > Math.round(0.6 * weightKg)) {
    proteinGrams = Math.round(0.6 * weightKg);
    notes.push('Protein has been capped at 0.6g/kg due to kidney disease. Consult your nephrologist for personalized guidance.');
  }

  return {
    calories,
    protein: proteinGrams,
    carbs: carbsGrams,
    fats: fatGrams,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    hardFlags,
    softFlags,
    notes,
    showDoctorWarning: hardFlags.length > 0,
    suppressCalories: hasEatingDisorder,
    macroSplit,
    weightKg: Math.round(weightKg * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Helper: get effective question list (skipping Q7 if not applicable)
// ---------------------------------------------------------------------------
function getVisibleQuestions(answers) {
  const goalIdx = answers[5];
  const showPace = goalIdx === 0 || goalIdx === 2; // weight loss or muscle gain
  return QUESTIONS.filter((q, i) => {
    if (i === 6 && !showPace) return false;
    return true;
  });
}

function mapVisibleToRealIndex(visibleIdx, answers) {
  const visibleQuestions = getVisibleQuestions(answers);
  if (visibleIdx < 0 || visibleIdx >= visibleQuestions.length) return -1;
  const q = visibleQuestions[visibleIdx];
  return QUESTIONS.indexOf(q);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const NutritionQuizPage = ({ show, onClose, onSaveGoals }) => {
  const [currentQ, setCurrentQ] = useState(0); // index into visible questions
  const [answers, setAnswers] = useState(Array(TOTAL_QUESTIONS).fill(null));
  const [screen, setScreen] = useState('quiz'); // 'quiz' | 'doctor' | 'result'
  const [result, setResult] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Numeric input state for Q3 and Q4
  const [ageValue, setAgeValue] = useState(25);
  const [weightValue, setWeightValue] = useState(70);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightValue, setHeightValue] = useState(170);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(7);

  const resetQuiz = () => {
    setCurrentQ(0);
    setAnswers(Array(TOTAL_QUESTIONS).fill(null));
    setScreen('quiz');
    setResult(null);
    setWeightValue(70);
    setWeightUnit('kg');
    setHeightValue(170);
    setHeightUnit('cm');
    setHeightFeet(5);
    setHeightInches(7);
  };

  if (!show) return null;

  const visibleQuestions = getVisibleQuestions(answers);
  const totalVisible = visibleQuestions.length;
  const realIdx = mapVisibleToRealIndex(currentQ, answers);
  const question = QUESTIONS[realIdx];
  const currentAnswer = answers[realIdx];

  const isMulti = question.type === 'multi';
  const isNumeric = question.type === 'numeric';
  const isSingle = question.type === 'single';

  const canProceed = (() => {
    if (isNumeric) return true; // always has a value
    if (isMulti) return Array.isArray(currentAnswer) && currentAnswer.length > 0;
    return currentAnswer !== null && currentAnswer !== undefined;
  })();

  const animateTransition = (callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const finishQuiz = (finalAnswers) => {
    const res = calculateResult(finalAnswers);
    setResult(res);
    if (res.showDoctorWarning) {
      setScreen('doctor');
    } else {
      setScreen('result');
    }
  };

  const saveNumericAnswer = () => {
    const newAnswers = [...answers];
    if (realIdx === 1) {
      // age
      newAnswers[1] = ageValue;
    } else if (realIdx === 2) {
      // weight
      newAnswers[2] = { value: weightValue, unit: weightUnit };
    } else if (realIdx === 3) {
      // height
      if (heightUnit === 'ft') {
        newAnswers[3] = { value: heightValue, unit: 'ft', feet: heightFeet, inches: heightInches };
      } else {
        newAnswers[3] = { value: heightValue, unit: 'cm' };
      }
    }
    setAnswers(newAnswers);
    return newAnswers;
  };

  const goNext = () => {
    let finalAnswers = answers;
    if (isNumeric) {
      finalAnswers = saveNumericAnswer();
    }
    if (!canProceed) return;
    if (currentQ < totalVisible - 1) {
      animateTransition(() => setCurrentQ(currentQ + 1));
    } else {
      finishQuiz(finalAnswers);
    }
  };

  const selectOption = (idx) => {
    const newAnswers = [...answers];
    if (isMulti) {
      let selected = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
      const noneIdx = question.options.length - 1; // "None" is always last
      if (idx === noneIdx) {
        selected = [noneIdx];
      } else {
        selected = selected.filter((i) => i !== noneIdx);
        if (selected.includes(idx)) {
          selected = selected.filter((i) => i !== idx);
        } else {
          selected.push(idx);
        }
      }
      newAnswers[realIdx] = selected.length > 0 ? selected : null;
      setAnswers(newAnswers);
    } else {
      newAnswers[realIdx] = idx;
      setAnswers(newAnswers);
      // Auto-advance for single-select
      if (currentQ < totalVisible - 1) {
        setTimeout(() => {
          animateTransition(() => setCurrentQ(currentQ + 1));
        }, 200);
      } else {
        setTimeout(() => {
          finishQuiz(newAnswers);
        }, 200);
      }
    }
  };

  const isSelected = (idx) => {
    if (isMulti) {
      return Array.isArray(currentAnswer) && currentAnswer.includes(idx);
    }
    return currentAnswer === idx;
  };

  const goBack = () => {
    if (isNumeric) {
      saveNumericAnswer();
    }
    if (currentQ > 0) {
      animateTransition(() => setCurrentQ(currentQ - 1));
    } else {
      onClose();
    }
  };

  const handleSaveGoals = () => {
    if (result) {
      onSaveGoals({
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fats: result.fats,
      });
    }
    resetQuiz();
    onClose();
  };

  // ---- Doctor Warning Screen ----
  if (screen === 'doctor' && result) {
    return (
      <View style={s.overlay}>
        <View style={s.page}>
          <View style={s.headerRow}>
            <View style={s.headerSide} />
            <View style={s.headerCenter} />
            <TouchableOpacity onPress={() => { resetQuiz(); onClose(); }} style={s.headerSide} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.scrollBody}
            contentContainerStyle={s.doctorContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.doctorIconCircle}>
              <Ionicons name="shield-checkmark" size={36} color="#D97706" />
            </View>
            <Text style={s.doctorTitle}>Your health comes first</Text>
            <Text style={s.doctorSubtitle}>
              Based on your answers, there are some health considerations we want you to be aware of before proceeding.
            </Text>
            {result.hardFlags.map((flag, i) => (
              <View key={i} style={s.doctorFlagRow}>
                <View style={s.doctorFlagDot} />
                <Text style={s.doctorFlagText}>{flag}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.greenPill} onPress={() => setScreen('result')}>
              <Text style={s.greenPillText}>Continue with my results</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.textLink} onPress={() => { resetQuiz(); onClose(); }}>
              <Text style={s.textLinkLabel}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ---- Result Screen ----
  if (screen === 'result' && result) {
    const hasWarnings = result.hardFlags.length > 0 || result.softFlags.length > 0;

    return (
      <View style={s.overlay}>
        <View style={s.page}>
          <View style={s.headerRow}>
            <View style={s.headerSide} />
            <View style={s.headerCenter} />
            <TouchableOpacity onPress={() => { resetQuiz(); onClose(); }} style={s.headerSide} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#999" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={s.scrollBody}
            contentContainerStyle={s.resultContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.resultSuper}>Your daily target</Text>

            {result.suppressCalories ? (
              <View style={s.resultSuppressedCard}>
                <Ionicons name="heart-outline" size={28} color="#059669" style={{ marginBottom: 12 }} />
                <Text style={s.resultSuppressedText}>
                  We recommend speaking with a registered dietitian to determine a calorie target that is right for you.
                </Text>
              </View>
            ) : (
              <Text style={s.resultCalories}>
                {result.calories.toLocaleString()} kcal
              </Text>
            )}

            {/* Macro breakdown */}
            {!result.suppressCalories && (
              <View style={s.macroContainer}>
                <View style={s.macroBarRow}>
                  <View style={[s.macroBarSegment, { flex: result.protein * 4, backgroundColor: '#3B82F6' }]} />
                  <View style={[s.macroBarSegment, { flex: result.carbs * 4, backgroundColor: '#F59E0B' }]} />
                  <View style={[s.macroBarSegment, { flex: result.fats * 9, backgroundColor: '#EF4444' }]} />
                </View>
                <View style={s.macroLabelsRow}>
                  <View style={s.macroLabel}>
                    <View style={[s.macroDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={s.macroLabelText}>Protein</Text>
                    <Text style={s.macroGrams}>{result.protein}g</Text>
                  </View>
                  <View style={s.macroLabel}>
                    <View style={[s.macroDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={s.macroLabelText}>Carbs</Text>
                    <Text style={s.macroGrams}>{result.carbs}g</Text>
                  </View>
                  <View style={s.macroLabel}>
                    <View style={[s.macroDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={s.macroLabelText}>Fats</Text>
                    <Text style={s.macroGrams}>{result.fats}g</Text>
                  </View>
                </View>
              </View>
            )}

            {/* BMR & TDEE stats */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statValue}>{result.bmr}</Text>
                <Text style={s.statLabel}>BMR (kcal)</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statValue}>{result.tdee}</Text>
                <Text style={s.statLabel}>TDEE (kcal)</Text>
              </View>
            </View>

            {/* Notes */}
            {result.notes.length > 0 && (
              <View style={s.notesCard}>
                {result.notes.map((note, i) => (
                  <Text key={`n${i}`} style={s.noteText}>{note}</Text>
                ))}
              </View>
            )}

            {/* Hard flags */}
            {result.hardFlags.length > 0 && (
              <View style={s.warningBanner}>
                {result.hardFlags.map((flag, i) => (
                  <Text key={`h${i}`} style={s.warningBannerText}>{flag}</Text>
                ))}
              </View>
            )}

            {/* Soft flags */}
            {result.softFlags.length > 0 && (
              <View style={s.amberBanner}>
                {result.softFlags.map((flag, i) => (
                  <Text key={`s${i}`} style={s.amberBannerText}>{flag}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.greenPill} onPress={handleSaveGoals}>
              <Text style={s.greenPillText}>Save these goals</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.textLink} onPress={resetQuiz}>
              <Text style={s.textLinkLabel}>Retake quiz</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ---- Numeric Input Renderer ----
  const renderNumericInput = () => {
    if (realIdx === 1) {
      // Age
      return (
        <View style={s.numericContainer}>
          <View style={s.stepperRow}>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setAgeValue(Math.max(13, ageValue - 1))}
            >
              <Ionicons name="remove" size={28} color="#1F1F1F" />
            </TouchableOpacity>
            <View style={s.numericDisplay}>
              <TextInput
                style={s.numericInput}
                value={String(ageValue)}
                onChangeText={(t) => { const n = parseInt(t) || 0; setAgeValue(Math.min(100, Math.max(0, n))); }}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Text style={s.numericUnit}>years</Text>
            </View>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setAgeValue(Math.min(100, ageValue + 1))}
            >
              <Ionicons name="add" size={28} color="#1F1F1F" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.greenPill, { marginTop: 32 }]} onPress={goNext}>
            <Text style={s.greenPillText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (realIdx === 2) {
      // Weight
      return (
        <View style={s.numericContainer}>
          <View style={s.stepperRow}>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setWeightValue(Math.max(30, weightValue - 1))}
            >
              <Ionicons name="remove" size={28} color="#1F1F1F" />
            </TouchableOpacity>
            <View style={s.numericDisplay}>
              <TextInput
                style={s.numericInput}
                value={String(weightValue)}
                onChangeText={(t) => { const n = parseInt(t) || 0; setWeightValue(Math.min(500, Math.max(0, n))); }}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Text style={s.numericUnit}>{weightUnit}</Text>
            </View>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setWeightValue(Math.min(300, weightValue + 1))}
            >
              <Ionicons name="add" size={28} color="#1F1F1F" />
            </TouchableOpacity>
          </View>
          <View style={s.unitToggleRow}>
            <TouchableOpacity
              style={[s.unitToggle, weightUnit === 'kg' && s.unitToggleActive]}
              onPress={() => {
                if (weightUnit !== 'kg') {
                  setWeightUnit('kg');
                  setWeightValue(Math.round(weightValue / 2.205));
                }
              }}
            >
              <Text style={[s.unitToggleText, weightUnit === 'kg' && s.unitToggleTextActive]}>kg</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.unitToggle, weightUnit === 'lbs' && s.unitToggleActive]}
              onPress={() => {
                if (weightUnit !== 'lbs') {
                  setWeightUnit('lbs');
                  setWeightValue(Math.round(weightValue * 2.205));
                }
              }}
            >
              <Text style={[s.unitToggleText, weightUnit === 'lbs' && s.unitToggleTextActive]}>lbs</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.greenPill, { marginTop: 32 }]} onPress={goNext}>
            <Text style={s.greenPillText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (realIdx === 3) {
      // Height
      if (heightUnit === 'ft') {
        return (
          <View style={s.numericContainer}>
            <View style={s.heightFtRow}>
              {/* Feet */}
              <View style={s.heightFtGroup}>
                <View style={s.stepperRow}>
                  <TouchableOpacity
                    style={s.stepperBtnSmall}
                    onPress={() => setHeightFeet(Math.max(3, heightFeet - 1))}
                  >
                    <Ionicons name="remove" size={22} color="#1F1F1F" />
                  </TouchableOpacity>
                  <View style={s.numericDisplaySmall}>
                    <Text style={s.numericValueSmall}>{heightFeet}</Text>
                    <Text style={s.numericUnitSmall}>ft</Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepperBtnSmall}
                    onPress={() => setHeightFeet(Math.min(8, heightFeet + 1))}
                  >
                    <Ionicons name="add" size={22} color="#1F1F1F" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Inches */}
              <View style={s.heightFtGroup}>
                <View style={s.stepperRow}>
                  <TouchableOpacity
                    style={s.stepperBtnSmall}
                    onPress={() => setHeightInches(Math.max(0, heightInches - 1))}
                  >
                    <Ionicons name="remove" size={22} color="#1F1F1F" />
                  </TouchableOpacity>
                  <View style={s.numericDisplaySmall}>
                    <Text style={s.numericValueSmall}>{heightInches}</Text>
                    <Text style={s.numericUnitSmall}>in</Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepperBtnSmall}
                    onPress={() => setHeightInches(Math.min(11, heightInches + 1))}
                  >
                    <Ionicons name="add" size={22} color="#1F1F1F" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={s.unitToggleRow}>
              <TouchableOpacity
                style={[s.unitToggle, heightUnit === 'cm' && s.unitToggleActive]}
                onPress={() => {
                  setHeightUnit('cm');
                  setHeightValue(Math.round((heightFeet * 30.48) + (heightInches * 2.54)));
                }}
              >
                <Text style={[s.unitToggleText, heightUnit === 'cm' && s.unitToggleTextActive]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.unitToggle, heightUnit === 'ft' && s.unitToggleActive]}
                onPress={() => {}}
              >
                <Text style={[s.unitToggleText, heightUnit === 'ft' && s.unitToggleTextActive]}>ft</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.greenPill, { marginTop: 32 }]} onPress={goNext}>
              <Text style={s.greenPillText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // cm mode
      return (
        <View style={s.numericContainer}>
          <View style={s.stepperRow}>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setHeightValue(Math.max(100, heightValue - 1))}
            >
              <Ionicons name="remove" size={28} color="#1F1F1F" />
            </TouchableOpacity>
            <View style={s.numericDisplay}>
              <TextInput
                style={s.numericInput}
                value={String(heightValue)}
                onChangeText={(t) => { const n = parseInt(t) || 0; setHeightValue(Math.min(250, Math.max(0, n))); }}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
              <Text style={s.numericUnit}>cm</Text>
            </View>
            <TouchableOpacity
              style={s.stepperBtn}
              onPress={() => setHeightValue(Math.min(250, heightValue + 1))}
            >
              <Ionicons name="add" size={28} color="#1F1F1F" />
            </TouchableOpacity>
          </View>
          <View style={s.unitToggleRow}>
            <TouchableOpacity
              style={[s.unitToggle, heightUnit === 'cm' && s.unitToggleActive]}
              onPress={() => {}}
            >
              <Text style={[s.unitToggleText, heightUnit === 'cm' && s.unitToggleTextActive]}>cm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.unitToggle, heightUnit === 'ft' && s.unitToggleActive]}
              onPress={() => {
                setHeightUnit('ft');
                const totalInches = Math.round(heightValue / 2.54);
                setHeightFeet(Math.floor(totalInches / 12));
                setHeightInches(totalInches % 12);
              }}
            >
              <Text style={[s.unitToggleText, heightUnit === 'ft' && s.unitToggleTextActive]}>ft</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.greenPill, { marginTop: 32 }]} onPress={goNext}>
            <Text style={s.greenPillText}>Continue</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  // ---- Quiz Screen ----
  return (
    <View style={s.overlay}>
      <ScrollView scrollEnabled={false} bounces={false} contentContainerStyle={s.page}>
        {/* Stories-style segmented progress */}
        <View style={s.storyBarRow}>
          {visibleQuestions.map((_, i) => (
            <View key={i} style={s.storyBarBg}>
              <View style={[s.storyBarFill, i < currentQ ? { width: '100%' } : i === currentQ ? { width: '100%', opacity: 0.5 } : { width: 0 }]} />
            </View>
          ))}
        </View>

        {/* Header: back arrow left, close X right */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={goBack} style={s.headerSide} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
          </TouchableOpacity>
          <View style={s.headerCenter} />
          <TouchableOpacity onPress={() => { resetQuiz(); onClose(); }} style={s.headerSide} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Stories-style tap zones -- left = back, right = forward */}
        {!isNumeric && (
          <View style={s.storyTapZones} pointerEvents="box-none">
            <TouchableOpacity style={s.storyTapLeft} activeOpacity={1} onPress={goBack} />
            <TouchableOpacity style={s.storyTapRight} activeOpacity={1} onPress={() => { if (!isMulti && canProceed) goNext(); }} />
          </View>
        )}

        {/* Question area */}
        <Animated.View style={[s.questionArea, { opacity: fadeAnim }]}>
          <Text style={s.questionText}>{question.text}</Text>
          {isMulti && (
            <Text style={s.multiHint}>Select all that apply</Text>
          )}

          {isNumeric ? (
            renderNumericInput()
          ) : (
            <View style={s.optionsList}>
              {question.options.map((opt, idx) => {
                const selected = isSelected(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.pill, selected && s.pillSelected]}
                    activeOpacity={0.7}
                    onPress={() => selectOption(idx)}
                  >
                    {isMulti && selected && (
                      <Ionicons name="checkmark" size={18} color="#fff" style={s.pillCheck} />
                    )}
                    <Text style={[s.pillText, selected && s.pillTextSelected]}>
                      {opt.label}
                    </Text>
                    {opt.badge && (
                      <View style={s.badgePill}>
                        <Text style={s.badgeText}>{opt.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {isMulti && (
            <TouchableOpacity
              style={[s.greenPill, !canProceed && s.greenPillDisabled, { marginTop: 20 }]}
              onPress={goNext}
              disabled={!canProceed}
            >
              <Text style={[s.greenPillText, !canProceed && s.greenPillTextDisabled]}>
                {currentQ === totalVisible - 1 ? 'See my results' : 'Continue'}
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    backgroundColor: '#FFFFFF',
  },
  page: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 4 : 8,
  },

  // Stories progress
  storyBarRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 4,
    marginBottom: 4,
  },
  storyBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  storyBarFill: {
    height: 3,
    backgroundColor: '#059669',
    borderRadius: 3,
  },

  // Story tap zones
  storyTapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  storyTapLeft: {
    width: '30%',
    height: '100%',
  },
  storyTapRight: {
    width: '70%',
    height: '100%',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 48,
    zIndex: 2,
  },
  headerSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },

  // Question
  questionArea: {
    flex: 1,
    paddingHorizontal: 24,
    zIndex: 2,
  },
  questionText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    lineHeight: 32,
    marginTop: 20,
    marginBottom: 40,
  },
  multiHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: -28,
    marginBottom: 28,
  },

  // Options
  optionsList: {
    gap: 10,
  },
  pill: {
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pillSelected: {
    backgroundColor: '#059669',
  },
  pillText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  pillCheck: {
    marginRight: 8,
  },

  // Badge (Recommended)
  badgePill: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },

  // Green pill button (reused)
  greenPill: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  greenPillDisabled: {
    backgroundColor: '#E5E7EB',
  },
  greenPillText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  greenPillTextDisabled: {
    color: '#9CA3AF',
  },

  // Text link
  textLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  textLinkLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },

  // ---------- Numeric Input ----------
  numericContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numericDisplay: {
    alignItems: 'center',
    minWidth: 120,
  },
  numericValue: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  numericInput: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1F1F1F',
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  numericUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: -4,
  },
  numericDisplaySmall: {
    alignItems: 'center',
    minWidth: 70,
  },
  numericValueSmall: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1F1F1F',
  },
  numericUnitSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: -2,
  },
  heightFtRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  heightFtGroup: {
    alignItems: 'center',
  },
  unitToggleRow: {
    flexDirection: 'row',
    marginTop: 20,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  unitToggle: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  unitToggleActive: {
    backgroundColor: '#059669',
  },
  unitToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  unitToggleTextActive: {
    color: '#FFFFFF',
  },

  // ---------- Doctor Warning ----------
  doctorContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 40,
  },
  doctorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doctorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    marginBottom: 12,
  },
  doctorSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  doctorFlagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 16,
    paddingLeft: 4,
  },
  doctorFlagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginTop: 7,
    marginRight: 12,
  },
  doctorFlagText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },

  // ---------- Result ----------
  scrollBody: {
    flex: 1,
  },
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 40,
  },
  resultSuper: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  resultCalories: {
    fontSize: 56,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 24,
  },
  resultSuppressedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultSuppressedText: {
    fontSize: 15,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Macros
  macroContainer: {
    width: '100%',
    marginBottom: 24,
  },
  macroBarRow: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  macroBarSegment: {
    height: 12,
  },
  macroLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    alignItems: 'center',
    flex: 1,
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
  },
  macroLabelText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 2,
  },
  macroGrams: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // Notes
  notesCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
    marginBottom: 8,
  },

  // Warnings
  warningBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  warningBannerText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 19,
    marginBottom: 8,
  },
  amberBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  amberBannerText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
    marginBottom: 8,
  },
});

export default NutritionQuizPage;
