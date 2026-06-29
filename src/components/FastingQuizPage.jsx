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
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Questions data
// ---------------------------------------------------------------------------
const QUESTIONS = [
  {
    id: 1,
    text: 'What is your main reason for tracking calories?',
    multi: false,
    options: [
      { label: 'Lose weight / reduce body fat' },
      { label: 'Improve energy and metabolic health' },
      { label: 'Build healthier eating habits' },
      { label: 'Maintain my current weight' },
    ],
  },
  {
    id: 2,
    text: 'Do you have any of the following conditions?',
    multi: true,
    options: [
      { label: 'Type 1 or Type 2 diabetes' },
      { label: 'History of eating disorders' },
      { label: 'Thyroid disorder' },
      { label: 'Chronic kidney disease' },
      { label: 'None of the above' },
    ],
  },
  {
    id: 3,
    text: 'What does your typical day look like?',
    multi: false,
    options: [
      { label: '9-5 desk / office job' },
      { label: 'Shift work or irregular hours' },
      { label: 'Physical / manual labour' },
      { label: 'Flexible / work from home' },
    ],
  },
  {
    id: 4,
    text: 'How would you describe your current eating pattern?',
    multi: false,
    options: [
      { label: 'I eat 3 regular meals a day' },
      { label: 'I graze and snack throughout the day' },
      { label: 'I skip meals often and eat large ones' },
      { label: 'Irregular \u2014 depends on the day' },
    ],
  },
  {
    id: 5,
    text: 'How would you describe your relationship with food?',
    multi: false,
    options: [
      { label: 'Healthy \u2014 eat when hungry, stop when full' },
      { label: 'Emotional eating tendencies' },
      { label: 'I often restrict then overeat' },
      { label: 'I eat on autopilot / out of convenience' },
    ],
  },
  {
    id: 6,
    text: 'How much sleep do you typically get?',
    multi: false,
    options: [
      { label: 'Less than 6 hours' },
      { label: '6-7 hours' },
      { label: '7-9 hours' },
      { label: 'Highly irregular' },
    ],
  },
  {
    id: 7,
    text: 'How active are you on a typical day?',
    multi: false,
    options: [
      { label: 'Very active \u2014 exercise 5+ days a week' },
      { label: 'Moderately active \u2014 3-4 days a week' },
      { label: 'Lightly active \u2014 1-2 days or just walking' },
      { label: "Mostly sedentary \u2014 little to no exercise" },
    ],
  },
  {
    id: 8,
    text: 'Are you on any medications?',
    multi: true,
    options: [
      { label: 'Blood sugar / insulin medication' },
      { label: 'Blood pressure medication' },
      { label: 'Psychiatric / mood medication' },
      { label: 'No medications' },
    ],
  },
  {
    id: 9,
    text: 'How would you rate your stress level?',
    multi: false,
    options: [
      { label: 'Low \u2014 fairly calm' },
      { label: 'Moderate \u2014 manageable' },
      { label: 'High \u2014 chronic stress' },
      { label: 'Very high \u2014 burnout territory' },
    ],
  },
  {
    id: 10,
    text: 'Have you tracked calories before?',
    multi: false,
    options: [
      { label: 'Never tried it' },
      { label: "Tried briefly, didn't stick" },
      { label: 'Done it on and off for months' },
      { label: 'I track consistently and know my numbers' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Plan display names
// ---------------------------------------------------------------------------
const PLAN_NAMES = {
  '1800': 'The Gentle Start',
  '1600': 'The Balanced Cut',
  '1500': 'The Steady Burn',
  '1400': 'The Active Deficit',
  '1300': 'The Focused Cut',
  '1200': 'The Accelerator',
  '2000': 'The Maintenance Mode',
  '2200': 'The Active Fueller',
};

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------
function calculateResult(answers) {
  const scores = { Beginner: 0, Regular: 0, Expert: 0, Weekly: 0 };
  const hardFlags = [];
  const softFlags = [];
  let softNudgeExercise = false;
  let neverTriedOverride = false;
  let experienceSixPlus = false;
  let fatLossGoal = false;
  let habitEater = false;
  let firstTimer = false;

  // --- Q1: goal ---
  const q1 = answers[0];
  if (q1 === 0) { scores.Regular += 2; fatLossGoal = true; }
  if (q1 === 1) { scores.Regular += 2; }
  if (q1 === 2) { scores.Beginner += 2; }
  if (q1 === 3) { scores.Weekly += 2; }

  // --- Q2: conditions (multi) ---
  const q2 = answers[1] || [];
  if (q2.includes(0)) {
    hardFlags.push('You indicated you have diabetes. Aggressive calorie restriction can affect blood sugar. Please consult your doctor before setting a very low calorie target.');
  }
  if (q2.includes(1)) {
    hardFlags.push('You indicated a history of eating disorders. Very low calorie targets may not be appropriate — consider working with a professional.');
  }
  if (q2.includes(2)) {
    softFlags.push('Thyroid conditions can affect metabolism. A moderate calorie target with regular medical check-ins is recommended.');
  }
  if (q2.includes(3)) {
    hardFlags.push('Chronic kidney disease requires careful dietary management. Consult your doctor before setting a calorie goal.');
  }

  // --- Q3: lifestyle ---
  const q3 = answers[2];
  if (q3 === 1) { scores.Weekly += 2; }
  if (q3 === 2) { scores.Expert += 2; }

  // --- Q4: eating pattern ---
  const q4 = answers[3];
  if (q4 === 0) { scores.Regular += 2; }
  if (q4 === 1) { scores.Beginner += 2; habitEater = true; }
  if (q4 === 2) { scores.Beginner += 1; scores.Regular += 1; }
  if (q4 === 3) { scores.Beginner += 2; firstTimer = true; }

  // --- Q5: food relationship ---
  const q5 = answers[4];
  if (q5 === 1) {
    scores.Beginner += 1;
    softFlags.push('Emotional eating tendencies noted. A gentle, flexible calorie goal will serve you better than a very strict one.');
  }
  if (q5 === 2) {
    hardFlags.push('Restrict-then-overeat patterns can be worsened by very low targets. We strongly recommend working with a professional.');
  }
  if (q5 === 3) { scores.Regular += 1; }

  // --- Q6: sleep ---
  const q6 = answers[5];
  if (q6 === 0) {
    scores.Beginner += 2;
    softFlags.push('Low sleep can impair metabolism and increase hunger hormones. Prioritising sleep will amplify your results.');
  }
  if (q6 === 1) { scores.Beginner += 1; scores.Regular += 1; }
  if (q6 === 3) { scores.Weekly += 2; }

  // --- Q7: activity ---
  const q7 = answers[6];
  if (q7 === 0) { scores.Expert += 2; experienceSixPlus = true; }
  if (q7 === 1) { scores.Regular += 2; }
  if (q7 === 2) { scores.Regular += 1; }
  if (q7 === 3) { softNudgeExercise = true; scores.Beginner += 1; }

  // --- Q8: medications (multi) ---
  const q8 = answers[7] || [];
  if (q8.includes(0)) {
    hardFlags.push('Blood sugar / insulin medication requires careful management with calorie changes. Doctor consultation is essential.');
  }
  if (q8.includes(1)) {
    scores.Beginner += 1;
    softFlags.push('Blood pressure medication may be affected by significant dietary changes. Monitor closely and consult your doctor.');
  }
  if (q8.includes(2)) {
    softFlags.push('Some psychiatric medications require consistent food intake. Check with your prescriber before making big changes.');
  }

  // --- Q9: stress ---
  const q9 = answers[8];
  if (q9 === 2) {
    scores.Beginner += 1;
    softFlags.push('High stress raises cortisol and can trigger cravings. A gentle calorie target with flexibility will be more sustainable.');
  }
  if (q9 === 3) {
    scores.Beginner += 2;
    softFlags.push('Very high stress noted. Prioritise adequate nutrition — too low a target can worsen stress response.');
  }

  // --- Q10: tracking experience ---
  const q10 = answers[9];
  if (q10 === 0) { neverTriedOverride = true; firstTimer = true; scores.Beginner += 3; }
  if (q10 === 1) { scores.Beginner += 1; }
  if (q10 === 2) { scores.Regular += 2; }
  if (q10 === 3) { scores.Expert += 2; experienceSixPlus = true; }

  // --- Apply caps ---
  const hasHardFlagDiabetes = (answers[1] || []).includes(0);
  const hasHardFlagEatingDisorder = (answers[1] || []).includes(1);
  const hasHardFlagRestrictBinge = answers[4] === 2;

  if (hasHardFlagDiabetes) { scores.Expert = 0; scores.Weekly = 0; }
  if (hasHardFlagEatingDisorder || hasHardFlagRestrictBinge) { scores.Expert = 0; }
  if (answers[4] === 1) { scores.Expert = 0; }
  if (answers[5] === 0) { scores.Expert = 0; }
  if ((answers[7] || []).includes(2)) { scores.Expert = 0; }
  if (answers[8] === 2 || answers[8] === 3) { scores.Expert = 0; }
  if ((answers[1] || []).includes(2)) { scores.Expert = 0; }

  let winningTier;
  if (neverTriedOverride) {
    winningTier = 'Beginner';
  } else {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    winningTier = (sorted[0][1] === sorted[1][1] && sorted[0][1] > 0) ? 'Custom' : (sorted[0][1] > 0 ? sorted[0][0] : 'Beginner');
  }

  let plan = { id: '1600', cal: 1600 };
  let upgradePath = '';
  let reasoning = '';

  switch (winningTier) {
    case 'Beginner': {
      if (firstTimer || neverTriedOverride) {
        plan = { id: '1800', cal: 1800 };
        reasoning = "Since you're new to calorie tracking, we're starting you with a gentle 1,800 cal/day target. It creates a moderate deficit without feeling restrictive.";
        upgradePath = 'After 3-4 weeks of consistency, you can tighten to 1,600 if you want faster results.';
      } else if (habitEater) {
        plan = { id: '1600', cal: 1600 };
        reasoning = "A 1,600 cal/day target works well for your eating pattern — enough structure to create change without feeling deprived.";
        upgradePath = 'After 4 weeks, consider dropping to 1,500 for a stronger deficit.';
      } else {
        plan = { id: '1600', cal: 1600 };
        reasoning = 'Based on your profile, 1,600 cal/day is a solid starting point — meaningful progress without overwhelming change.';
        upgradePath = 'After 4 weeks of consistency, try 1,500 for more impact.';
      }
      if (hasHardFlagDiabetes) {
        plan = { id: '1800', cal: 1800 };
        reasoning = 'Given your condition, we recommend a conservative 1,800 cal/day target and suggest working with your healthcare provider.';
        upgradePath = "Only reduce further with your doctor's guidance.";
      }
      break;
    }
    case 'Regular': {
      if (fatLossGoal && experienceSixPlus) {
        plan = { id: '1400', cal: 1400 };
        reasoning = 'With your tracking experience and fat loss goals, 1,400 cal/day hits the sweet spot — meaningful deficit with room for nutritious African meals.';
        upgradePath = 'After 4 weeks, assess your progress and adjust if needed.';
      } else {
        plan = { id: '1500', cal: 1500 };
        reasoning = 'A 1,500 cal/day target is well-researched and effective for consistent weight loss. It works well with your lifestyle.';
        upgradePath = 'After 4 weeks, consider 1,400 if you want to accelerate results.';
      }
      break;
    }
    case 'Expert': {
      plan = { id: '1300', cal: 1300 };
      reasoning = 'Your activity level and tracking experience make a 1,300 cal/day target achievable. This creates a strong deficit while fuelling your active lifestyle.';
      upgradePath = 'Monitor energy levels closely — increase to 1,400 on high-activity days if needed.';
      break;
    }
    case 'Weekly': {
      plan = { id: '1600', cal: 1600 };
      reasoning = 'Given your irregular schedule, a flexible 1,600 cal/day target gives you breathing room to adjust day by day without feeling locked in.';
      upgradePath = 'After 4 weeks, tighten to 1,500 once the habit feels natural.';
      break;
    }
    case 'Custom':
    default: {
      plan = { id: '1600', cal: 1600 };
      reasoning = "Your profile is well-balanced. We recommend starting at 1,600 cal/day and adjusting based on your weekly progress.";
      upgradePath = 'Explore our PLUS plans to set a fully personalised calorie target.';
      break;
    }
  }

  if (softNudgeExercise) {
    softFlags.push('Adding even light exercise (walking 20-30 min daily) significantly boosts your calorie deficit without changing your food target.');
  }

  return {
    plan,
    tier: winningTier,
    reasoning,
    upgradePath,
    hardFlags,
    softFlags,
    showDoctorWarning: hardFlags.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const FastingQuizPage = ({ show, onClose, onSelectPlan }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(Array(10).fill(null));
  const [screen, setScreen] = useState('quiz'); // 'quiz' | 'doctor' | 'result'
  const [result, setResult] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const resetQuiz = () => {
    setCurrentQ(0);
    setAnswers(Array(10).fill(null));
    setScreen('quiz');
    setResult(null);
  };

  if (!show) return null;

  const question = QUESTIONS[currentQ];
  const currentAnswer = answers[currentQ];

  const canProceed = currentAnswer !== null && currentAnswer !== undefined &&
    (!question.multi || (Array.isArray(currentAnswer) && currentAnswer.length > 0));

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

  const goNext = () => {
    if (!canProceed) return;
    if (currentQ < 9) {
      animateTransition(() => setCurrentQ(currentQ + 1));
    } else {
      finishQuiz(answers);
    }
  };

  const selectOption = (idx) => {
    const newAnswers = [...answers];
    if (question.multi) {
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
      newAnswers[currentQ] = selected.length > 0 ? selected : null;
      setAnswers(newAnswers);
    } else {
      newAnswers[currentQ] = idx;
      setAnswers(newAnswers);
      // Auto-advance for single-select
      if (currentQ < 9) {
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
    if (question.multi) {
      return Array.isArray(currentAnswer) && currentAnswer.includes(idx);
    }
    return currentAnswer === idx;
  };

  const goBack = () => {
    if (currentQ > 0) {
      animateTransition(() => setCurrentQ(currentQ - 1));
    } else {
      onClose();
    }
  };

  const handleStartPlan = () => {
    if (result) {
      onSelectPlan(result.plan);
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
              Based on your answers, there are some health considerations we want you to be aware of before starting.
            </Text>
            {result.hardFlags.map((flag, i) => (
              <View key={i} style={s.doctorFlagRow}>
                <View style={s.doctorFlagDot} />
                <Text style={s.doctorFlagText}>{flag}</Text>
              </View>
            ))}
            <TouchableOpacity style={s.greenPill} onPress={() => setScreen('result')}>
              <Text style={s.greenPillText}>Continue with a gentle plan</Text>
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
    const planName = PLAN_NAMES[result.plan.id] || 'Custom Plan';
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
            <Text style={s.resultSuper}>Your calorie goal</Text>
            <Text style={s.resultPlanId}>{Number(result.plan.cal).toLocaleString()} cal/day</Text>
            <Text style={s.resultPlanName}>{planName}</Text>

            <View style={s.resultReasonCard}>
              <Text style={s.resultReasonTitle}>Why this fits you</Text>
              <Text style={s.resultReasonBody}>{result.reasoning}</Text>
            </View>

            {result.upgradePath ? (
              <Text style={s.resultUpgrade}>{result.upgradePath}</Text>
            ) : null}

            {result.hardFlags.length > 0 && (
              <View style={s.warningBanner}>
                {result.hardFlags.map((flag, i) => (
                  <Text key={`h${i}`} style={s.warningBannerText}>{flag}</Text>
                ))}
              </View>
            )}

            {result.softFlags.length > 0 && (
              <View style={s.amberBanner}>
                {result.softFlags.map((flag, i) => (
                  <Text key={`s${i}`} style={s.amberBannerText}>{flag}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.greenPill} onPress={handleStartPlan}>
              <Text style={s.greenPillText}>Start this plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.textLink} onPress={resetQuiz}>
              <Text style={s.textLinkLabel}>Retake quiz</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    );
  }

  // ---- Quiz Screen ----
  const progress = (currentQ + 1) / QUESTIONS.length;

  return (
    <View style={s.overlay}>
      <ScrollView scrollEnabled={false} bounces={false} contentContainerStyle={s.page}>
        {/* Stories-style segmented progress */}
        <View style={s.storyBarRow}>
          {QUESTIONS.map((_, i) => (
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

        {/* Stories-style tap zones — left = back, right = forward */}
        <View style={s.storyTapZones} pointerEvents="box-none">
          <TouchableOpacity style={s.storyTapLeft} activeOpacity={1} onPress={goBack} />
          <TouchableOpacity style={s.storyTapRight} activeOpacity={1} onPress={() => { if (!question.multi && canProceed) goNext(); }} />
        </View>

        {/* Question area */}
        <Animated.View style={[s.questionArea, { opacity: fadeAnim }]}>
          <Text style={s.questionText}>{question.text}</Text>
          {question.multi && (
            <Text style={s.multiHint}>Select all that apply</Text>
          )}

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
                  {question.multi && selected && (
                    <Ionicons name="checkmark" size={18} color="#fff" style={s.pillCheck} />
                  )}
                  <Text style={[s.pillText, selected && s.pillTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {question.multi && (
            <TouchableOpacity
              style={[s.greenPill, !canProceed && s.greenPillDisabled, { marginTop: 20 }]}
              onPress={goNext}
              disabled={!canProceed}
            >
              <Text style={[s.greenPillText, !canProceed && s.greenPillTextDisabled]}>
                {currentQ === 9 ? 'See my plan' : 'Continue'}
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

  // Footer

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
  resultPlanId: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  resultPlanName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  resultTierLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 28,
  },
  resultReasonCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 16,
  },
  resultReasonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  resultReasonBody: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
  },
  resultUpgrade: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
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

export default FastingQuizPage;
