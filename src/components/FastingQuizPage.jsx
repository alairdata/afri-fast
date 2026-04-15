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
    text: 'What is your primary goal for fasting?',
    multi: false,
    options: [
      { label: 'Weight / fat loss' },
      { label: 'Metabolic health (blood sugar, insulin)' },
      { label: 'Longevity / cellular repair' },
      { label: 'Simplify eating / reduce decisions' },
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
    text: 'How do you feel about skipping breakfast?',
    multi: false,
    options: [
      { label: 'Fine \u2014 I rarely eat it anyway' },
      { label: 'Hard \u2014 I get irritable or dizzy' },
      { label: 'I eat it out of habit, not hunger' },
      { label: 'I genuinely enjoy breakfast' },
    ],
  },
  {
    id: 5,
    text: 'How would you describe your relationship with food?',
    multi: false,
    options: [
      { label: 'Healthy \u2014 eat when hungry, stop when full' },
      { label: 'Emotional eating tendencies' },
      { label: 'I often restrict then binge' },
      { label: 'I eat on autopilot / convenience' },
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
    text: 'Do you exercise, and when?',
    multi: false,
    options: [
      { label: 'Morning, fasted' },
      { label: 'Morning, fed' },
      { label: 'Evening' },
      { label: "I don't exercise regularly" },
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
    text: 'Have you tried intermittent fasting before?',
    multi: false,
    options: [
      { label: 'Never tried it' },
      { label: "Tried briefly, didn't stick" },
      { label: 'Done it on and off for months' },
      { label: 'Consistent practice for 6+ months' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Plan display names
// ---------------------------------------------------------------------------
const PLAN_NAMES = {
  '10:14': 'The Gentle Start',
  '14:10': 'The Easy Window',
  '15:9': 'The Balanced Fast',
  '16:8': 'The Classic Fast',
  '17:7': 'The Autophagy Boost',
  '18:6': 'The Lean Machine',
  '19:5': 'The Deep Burn',
  '21:3': 'The Warrior Fast',
  '5:2': 'The Weekly Reset',
  '4:3': 'The Accelerator',
};

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------
function calculateResult(answers) {
  const scores = { Beginner: 0, Regular: 0, Expert: 0, Weekly: 0 };
  const hardFlags = [];
  const softFlags = [];
  let suggestEarlyWindow = false;
  let softNudgeExercise = false;
  let neverTriedOverride = false;
  let experienceSixPlus = false;
  let longevityGoal = false;
  let fatLossGoal = false;
  let autophagyGoal = false;
  let habitEater = false;
  let breakfastLover = false;
  let firstTimer = false;

  // --- Q1 ---
  const q1 = answers[0];
  if (q1 === 0) { scores.Regular += 2; fatLossGoal = true; }
  if (q1 === 1) { scores.Regular += 2; }
  if (q1 === 2) { scores.Expert += 1; scores.Weekly += 1; longevityGoal = true; autophagyGoal = true; }
  if (q1 === 3) { scores.Beginner += 2; }

  // --- Q2 (multi) ---
  const q2 = answers[1] || [];
  if (q2.includes(0)) {
    hardFlags.push('You indicated you have diabetes. Fasting can significantly affect blood sugar levels and may require medication adjustments.');
  }
  if (q2.includes(1)) {
    hardFlags.push('You indicated a history of eating disorders. Restrictive eating patterns may not be appropriate without professional guidance.');
  }
  if (q2.includes(2)) {
    softFlags.push('Thyroid conditions can be affected by prolonged fasting. A moderate approach is recommended.');
  }
  if (q2.includes(3)) {
    hardFlags.push('Chronic kidney disease requires careful dietary management. Extended fasting may not be safe without medical supervision.');
  }

  // --- Q3 ---
  const q3 = answers[2];
  if (q3 === 1) { scores.Weekly += 2; }
  if (q3 === 2) { scores.Beginner += 2; }

  // --- Q4 ---
  const q4 = answers[3];
  if (q4 === 0) { scores.Regular += 2; scores.Expert += 2; }
  if (q4 === 1) { scores.Beginner += 3; firstTimer = true; }
  if (q4 === 2) { scores.Beginner += 1; scores.Regular += 1; habitEater = true; }
  if (q4 === 3) { scores.Beginner += 2; suggestEarlyWindow = true; breakfastLover = true; }

  // --- Q5 ---
  const q5 = answers[4];
  if (q5 === 1) {
    scores.Beginner += 1;
    softFlags.push('Emotional eating tendencies noted. Mindful fasting with flexible windows may work best for you.');
  }
  if (q5 === 2) {
    hardFlags.push('Restrict-binge patterns can be worsened by fasting. We strongly recommend working with a mental health professional.');
  }
  if (q5 === 3) { scores.Regular += 1; }

  // --- Q6 ---
  const q6 = answers[5];
  if (q6 === 0) {
    scores.Beginner += 2;
    softFlags.push('Low sleep can impair metabolism and hunger hormones. Prioritising sleep will amplify your fasting results.');
  }
  if (q6 === 1) { scores.Beginner += 1; scores.Regular += 1; }
  if (q6 === 3) { scores.Weekly += 2; }

  // --- Q7 ---
  const q7 = answers[6];
  if (q7 === 1) { scores.Beginner += 1; scores.Regular += 1; suggestEarlyWindow = true; }
  if (q7 === 3) { softNudgeExercise = true; }

  // --- Q8 (multi) ---
  const q8 = answers[7] || [];
  if (q8.includes(0)) {
    hardFlags.push('Blood sugar / insulin medication can cause dangerous lows during fasting. Doctor consultation is essential before starting.');
  }
  if (q8.includes(1)) {
    scores.Beginner += 1;
    softFlags.push('Blood pressure medication may need adjustment with fasting. Monitor closely and consult your doctor.');
  }
  if (q8.includes(2)) {
    softFlags.push('Some psychiatric medications require food for absorption. Check with your prescriber before fasting.');
  }

  // --- Q9 ---
  const q9 = answers[8];
  if (q9 === 2) {
    scores.Beginner += 1;
    softFlags.push('High stress raises cortisol, which can counteract fasting benefits. Consider a gentle approach.');
  }
  if (q9 === 3) {
    scores.Beginner += 2;
    softFlags.push('Very high stress levels noted. A gentle fasting window with adequate nutrition is important.');
  }

  // --- Q10 ---
  const q10 = answers[9];
  if (q10 === 0) { neverTriedOverride = true; firstTimer = true; scores.Beginner += 3; }
  if (q10 === 1) { scores.Beginner += 1; }
  if (q10 === 2) { scores.Regular += 2; }
  if (q10 === 3) { scores.Expert += 2; experienceSixPlus = true; }

  // --- Apply caps from flags ---
  const hasHardFlagDiabetes = (answers[1] || []).includes(0);
  const hasHardFlagEatingDisorder = (answers[1] || []).includes(1);
  const hasHardFlagKidney = (answers[1] || []).includes(3);
  const hasHardFlagRestrictBinge = answers[4] === 2;
  const hasHardFlagInsulinMed = (answers[7] || []).includes(0);

  // Diabetes: cap Beginner only
  if (hasHardFlagDiabetes) {
    scores.Regular = 0; scores.Expert = 0; scores.Weekly = 0;
  }
  // Eating disorder / restrict-binge: no Expert, no Long, no OMAD
  if (hasHardFlagEatingDisorder || hasHardFlagRestrictBinge) {
    scores.Expert = 0;
  }
  // Kidney: no Long
  // Physical labour: cap Regular
  if (answers[2] === 2) {
    scores.Expert = 0;
  }
  // Emotional eating: cap Regular
  if (answers[4] === 1) {
    scores.Expert = 0;
  }
  // Sleep < 6: cap Regular
  if (answers[5] === 0) {
    scores.Expert = 0;
  }
  // Psychiatric meds: cap Regular
  if ((answers[7] || []).includes(2)) {
    scores.Expert = 0;
  }
  // High/very high stress: cap Regular
  if (answers[8] === 2 || answers[8] === 3) {
    scores.Expert = 0;
  }
  // Thyroid: cap Regular
  if ((answers[1] || []).includes(2)) {
    scores.Expert = 0;
  }

  // --- Q10 never tried ALWAYS overrides to Beginner ---
  let winningTier;
  if (neverTriedOverride) {
    winningTier = 'Beginner';
  } else {
    // Find highest tier
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] === sorted[1][1] && sorted[0][1] > 0) {
      // Tie → suggest Custom
      winningTier = 'Custom';
    } else {
      winningTier = sorted[0][1] > 0 ? sorted[0][0] : 'Beginner';
    }
  }

  // --- Determine specific plan within tier ---
  let plan = { id: '16:8', fastHours: 16 };
  let upgradePath = '';
  let reasoning = '';

  switch (winningTier) {
    case 'Beginner': {
      if (firstTimer || neverTriedOverride) {
        plan = { id: '10:14', fastHours: 10 };
        reasoning = 'Since you\'re new to fasting, we\'re starting you with a gentle 10:14 window. This means 10 hours of fasting and 14 hours to eat \u2014 an easy transition.';
        upgradePath = 'After 2-3 weeks of consistency, try upgrading to 14:10.';
      } else if (habitEater || breakfastLover) {
        plan = { id: '14:10', fastHours: 14 };
        reasoning = 'A 14:10 plan gives you a comfortable eating window while introducing the benefits of fasting. Perfect for easing in.';
        upgradePath = 'After 4 weeks, consider moving to 15:9 for more benefits.';
      } else {
        plan = { id: '14:10', fastHours: 14 };
        reasoning = 'Based on your profile, a moderate 14:10 fasting window is the best place to start. It\'s manageable and effective.';
        upgradePath = 'After 4 weeks of consistency, upgrade to 15:9.';
      }
      if (hasHardFlagDiabetes) {
        plan = { id: '10:14', fastHours: 10 };
        reasoning = 'Given your diabetes, we recommend the gentlest fasting window \u2014 10:14. This minimises blood sugar risk while still offering benefits.';
        upgradePath = 'Only increase fasting hours with your doctor\'s approval.';
      }
      break;
    }
    case 'Regular': {
      if (autophagyGoal) {
        plan = { id: '17:7', fastHours: 17 };
        reasoning = 'Your interest in cellular repair pairs well with a 17:7 window. The extended fast promotes autophagy more effectively.';
        upgradePath = 'After 4 weeks, try 18:6 for deeper autophagy benefits.';
      } else if (fatLossGoal && experienceSixPlus) {
        plan = { id: '18:6', fastHours: 18 };
        reasoning = 'With your experience and fat loss goals, 18:6 hits the sweet spot \u2014 long enough for significant metabolic benefits.';
        upgradePath = 'After 4 weeks, you could try 19:5 if comfortable.';
      } else {
        plan = { id: '16:8', fastHours: 16 };
        reasoning = 'The classic 16:8 is the gold standard of intermittent fasting. It\'s flexible, well-researched, and effective for your goals.';
        upgradePath = 'After 4 weeks, consider moving to 18:6 for enhanced results.';
      }
      break;
    }
    case 'Expert': {
      if (longevityGoal) {
        plan = { id: '21:3', fastHours: 21 };
        reasoning = 'Your longevity focus and experience make 21:3 a powerful choice. Deep fasting promotes maximum cellular repair.';
        upgradePath = 'After 4 weeks, you could explore 22:2 or alternate-day protocols.';
      } else {
        plan = { id: '21:3', fastHours: 21 };
        reasoning = 'Your fasting experience qualifies you for an advanced 21:3 window. This maximises fat-burning and autophagy.';
        upgradePath = 'After 4 weeks, consider 22:2 or cycling with 23:1 days.';
      }
      break;
    }
    case 'Weekly': {
      if (fatLossGoal) {
        plan = { id: '4:3', fastHours: 24 };
        reasoning = 'A 4:3 weekly schedule (eating normally 4 days, reduced calories 3 days) is aggressive but effective for fat loss with irregular schedules.';
        upgradePath = 'After 4 weeks, consider cycling with 6:1 for maintenance.';
      } else {
        plan = { id: '5:2', fastHours: 24 };
        reasoning = 'The 5:2 plan (eat normally 5 days, reduced calories 2 days) works great with your schedule. It offers flexibility without daily fasting.';
        upgradePath = 'After 4 weeks, you can try 4:3 for accelerated results.';
      }
      break;
    }
    case 'Custom':
    default: {
      plan = { id: '16:8', fastHours: 16 };
      reasoning = 'Your answers suggest you could benefit from a customised plan. We recommend starting with 16:8 and adjusting based on how you feel.';
      upgradePath = 'Explore our PLUS plans for a fully tailored fasting schedule.';
      break;
    }
  }

  // Long fast eligibility
  if (experienceSixPlus && hardFlags.length === 0 && longevityGoal && winningTier === 'Expert') {
    // Eligible but we still recommend 21:3 as default; mention Long as option
    upgradePath += ' You may also explore 24+ hour fasts under medical guidance.';
  }

  // Early window note
  if (suggestEarlyWindow) {
    reasoning += ' Consider an early eating window (e.g. 7am-3pm) so you can enjoy breakfast.';
  }

  // Exercise nudge
  if (softNudgeExercise) {
    softFlags.push('Adding even light exercise (walking 20-30 min) can significantly boost your fasting results.');
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
            <Text style={s.resultSuper}>Your perfect plan</Text>
            <Text style={s.resultPlanId}>{result.plan.id}</Text>
            <Text style={s.resultPlanName}>{planName}</Text>
            <Text style={s.resultTierLabel}>
              {result.tier === 'Custom' ? 'Custom Plan' : `${result.tier} Tier`}
            </Text>

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
    fontSize: 56,
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
