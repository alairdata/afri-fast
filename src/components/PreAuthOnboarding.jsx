import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  Easing,
} from 'react-native';

const genderOptions = [
  { id: 'Woman', label: 'Female', icon: 'F' },
  { id: 'Man', label: 'Male', icon: 'M' },
  { id: 'Non-binary', label: 'Non-binary', icon: 'NB' },
  { id: 'Prefer not to say', label: 'Prefer not to say', icon: '' },
];

const goalOptions = [
  { id: 'lose', label: 'Lose weight', subtext: 'Reduce body fat safely' },
  { id: 'gain', label: 'Gain weight', subtext: 'Build muscle and mass' },
  { id: 'maintain', label: 'Maintain weight', subtext: "Keep what you've built" },
  { id: 'gutHealth', label: 'Gut health', subtext: 'Improve digestion' },
  { id: 'moreEnergy', label: 'More energy', subtext: 'Feel alert and sustained' },
  { id: 'mentalClarity', label: 'Mental clarity', subtext: 'Focus and reset' },
  { id: 'liveLonger', label: 'Live longer', subtext: 'Support your long-term health' },
];

const conditionOptions = [
  { id: 'Diabetes', label: 'Diabetes' },
  { id: 'High blood pressure', label: 'Hypertension' },
  { id: 'PCOS', label: 'PCOS' },
  { id: 'Ulcer', label: 'Ulcer' },
  { id: 'Pregnant / breastfeeding', label: 'Pregnant / breastfeeding' },
  { id: 'None', label: 'None of the above' },
];

const steps = [
  {
    tag: 'Welcome',
    title: 'What is your\nname?',
    subtitle: 'Your name helps us make your Afri Fast experience feel personal from day one.',
  },
  {
    tag: 'About you',
    title: 'A few body\ndetails',
    subtitle: 'Age, gender, and height help us make the app feel more relevant.',
  },
  {
    tag: 'Your goal',
    title: 'What do you\nwant to achieve?',
    subtitle: "We'll build your experience around this.",
  },
  {
    tag: 'Your weight',
    title: 'Where are you\nstarting from?',
    subtitle: 'Current weight first. Target weight only if it matters for your goal.',
  },
  {
    tag: 'Health',
    title: 'Any health\nconditions?',
    subtitle: "Select all that apply. We'll keep your plan safer and more thoughtful.",
  },
];

const createEmptyData = () => ({
  preferredName: '',
  gender: '',
  age: '',
  height: '',
  heightUnit: 'cm',
  goal: '',
  currentWeight: '',
  targetWeight: '',
  weightUnit: 'kg',
  conditions: [],
});

const parseNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function PreAuthOnboarding({ initialData, onComplete, onSkip }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(() => ({ ...createEmptyData(), ...(initialData || {}) }));
  const [showSuccess, setShowSuccess] = useState(false);
  const fillAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const step = steps[stepIndex];
  const progressWidth = `${((stepIndex + 1) / steps.length) * 100}%`;
  const needsTargetWeight = data.goal === 'lose' || data.goal === 'gain';
  const displayName = data.preferredName.trim() || 'friend';
  const isDark = stepIndex === 0;

  useEffect(() => {
    if (!showSuccess) return;

    fillAnim.setValue(0);
    checkAnim.setValue(0);
    textAnim.setValue(0);
    buttonAnim.setValue(0);

    Animated.sequence([
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 1900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.parallel([
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(textAnim, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, [showSuccess, fillAnim, checkAnim, textAnim, buttonAnim]);

  const update = (patch) => setData((prev) => ({ ...prev, ...patch }));

  const ageValue = parseNumber(data.age);
  const heightValue = parseNumber(data.height);
  const currentWeightValue = parseNumber(data.currentWeight);
  const targetWeightValue = parseNumber(data.targetWeight);

  const ageError =
    data.age.trim() === ''
      ? ''
      : ageValue === null || ageValue < 18
        ? 'Afri Fast is currently designed for adults 18+.'
        : ageValue > 100
          ? 'Please enter a valid age.'
          : '';

  const heightError =
    data.height.trim() === ''
      ? ''
      : data.heightUnit === 'cm'
        ? heightValue === null || heightValue < 120 || heightValue > 230
          ? 'Please enter a height between 120 cm and 230 cm.'
          : ''
        : heightValue === null || heightValue < 4 || heightValue > 8
          ? 'Please enter a height between 4 ft and 8 ft.'
          : '';

  const getWeightError = (value, unit) => {
    if (value === '') return '';
    const parsed = parseNumber(value);
    if (parsed === null) return 'Please enter a valid weight.';
    if (unit === 'kg') {
      if (parsed < 30) return 'Please enter a weight above 30 kg.';
      if (parsed > 136) return 'If you are above 300 lb, please use Afri Fast with a doctor’s guidance.';
      return '';
    }
    if (parsed < 66) return 'Please enter a weight above 66 lb.';
    if (parsed > 300) return 'If you are above 300 lb, please use Afri Fast with a doctor’s guidance.';
    return '';
  };

  const currentWeightError = getWeightError(data.currentWeight, data.weightUnit);
  const targetWeightError = getWeightError(data.targetWeight, data.weightUnit);

  const canContinue = useMemo(() => {
    if (stepIndex === 0) return Boolean(data.preferredName.trim());
    if (stepIndex === 1) {
      return Boolean(data.gender && data.age.trim() && data.height.trim() && !ageError && !heightError);
    }
    if (stepIndex === 2) return Boolean(data.goal);
    if (stepIndex === 3) {
      return Boolean(
        data.currentWeight.trim() &&
        !currentWeightError &&
        (!needsTargetWeight || (data.targetWeight.trim() && !targetWeightError))
      );
    }
    if (stepIndex === 4) return data.conditions.length > 0;
    return false;
  }, [stepIndex, data, needsTargetWeight, ageError, heightError, currentWeightError, targetWeightError]);

  const toggleCondition = (value) => {
    if (value === 'None') {
      update({ conditions: ['None'] });
      return;
    }

    const next = data.conditions.includes(value)
      ? data.conditions.filter((item) => item !== value)
      : [...data.conditions.filter((item) => item !== 'None'), value];

    update({ conditions: next });
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => prev - 1);
  };

  const goNext = () => {
    if (stepIndex === steps.length - 1) {
      setShowSuccess(true);
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const finishOnboarding = () => {
    onComplete({
      ...data,
      completedAt: Date.now(),
      conditions: data.conditions.join(', '),
    });
  };

  const renderOptionCard = ({ label, subtext, icon, selected, onPress }) => (
    <TouchableOpacity
      key={label}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
    >
      <View style={styles.optionLeft}>
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          <Text style={[styles.optionIconText, selected && styles.optionIconTextSelected]}>{icon}</Text>
        </View>
        <View style={styles.optionTextWrap}>
          <Text style={styles.optionName}>{label}</Text>
          {subtext ? <Text style={styles.optionSub}>{subtext}</Text> : null}
        </View>
      </View>
      <View style={[styles.optionCheck, selected && styles.optionCheckSelected]}>
        {selected ? <Ionicons name="checkmark" size={10} color="#0A0F0D" /> : null}
      </View>
    </TouchableOpacity>
  );

  const renderStepContent = () => {
    if (stepIndex === 0) {
      return (
        <View style={styles.nameStage}>
          <View style={styles.waveIconWrap}>
            <Text style={styles.waveEmoji}>👋</Text>
          </View>
          <View style={styles.nameInputCard}>
            <Text style={styles.nameLabel}>NAME</Text>
            <TextInput
              style={styles.bigInput}
              value={data.preferredName}
              onChangeText={(preferredName) => update({ preferredName })}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="words"
              textAlign="left"
            />
          </View>
          {data.preferredName.trim() ? (
            <View style={styles.greetBanner}>
              <Text style={styles.greetEmoji}>👋</Text>
              <Text style={styles.greetText}>
                Nice to meet you, <Text style={styles.greetName}>{data.preferredName.trim()}</Text>!
              </Text>
              <Text style={styles.greetEmoji}>🤝</Text>
            </View>
          ) : null}
        </View>
      );
    }

    if (stepIndex === 1) {
      return (
        <View style={styles.mixedStep}>
          <View style={styles.optionGroup}>
            <Text style={styles.sectionLabel}>Gender</Text>
            <View style={styles.optionsColumn}>
              {genderOptions.map((option) =>
                renderOptionCard({
                  label: option.label,
                  icon: option.icon,
                  selected: data.gender === option.id,
                  onPress: () => update({ gender: option.id }),
                })
              )}
            </View>
          </View>

          <View style={styles.measurementRow}>
            <View style={styles.measurementBlock}>
              <Text style={styles.sectionLabel}>Age</Text>
              <View style={styles.numberRowSmall}>
                <TextInput
                  style={styles.smallNumberInput}
                  value={data.age}
                  onChangeText={(age) => update({ age })}
                  placeholder="25"
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  keyboardType="numeric"
                  textAlign="center"
                />
                <Text style={styles.smallUnit}>yrs</Text>
              </View>
              {ageError ? <Text style={styles.validationText}>{ageError}</Text> : null}
            </View>

            <View style={styles.measurementBlock}>
              <Text style={styles.sectionLabel}>Height</Text>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitToggleBtn, data.heightUnit === 'cm' && styles.unitToggleBtnOn]}
                  onPress={() => update({ heightUnit: 'cm' })}
                >
                  <Text style={[styles.unitToggleText, data.heightUnit === 'cm' && styles.unitToggleTextOn]}>cm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitToggleBtn, data.heightUnit === 'ft' && styles.unitToggleBtnOn]}
                  onPress={() => update({ heightUnit: 'ft' })}
                >
                  <Text style={[styles.unitToggleText, data.heightUnit === 'ft' && styles.unitToggleTextOn]}>ft</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.numberRowSmall}>
                <TextInput
                  style={styles.smallNumberInput}
                  value={data.height}
                  onChangeText={(height) => update({ height })}
                  placeholder={data.heightUnit === 'cm' ? '165' : '5.6'}
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  keyboardType="numeric"
                  textAlign="center"
                />
                <Text style={styles.smallUnit}>{data.heightUnit}</Text>
              </View>
              {heightError ? <Text style={styles.validationText}>{heightError}</Text> : null}
            </View>
          </View>
        </View>
      );
    }

    if (stepIndex === 2) {
      return (
        <View style={styles.optionsColumn}>
          {goalOptions.map((option) =>
            renderOptionCard({
              label: option.label,
              subtext: option.subtext,
              icon: '',
              selected: data.goal === option.id,
              onPress: () => update({ goal: option.id }),
            })
          )}
        </View>
      );
    }

    if (stepIndex === 3) {
      return (
        <View style={styles.centerStage}>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[styles.unitToggleBtn, data.weightUnit === 'kg' && styles.unitToggleBtnOn]}
              onPress={() => update({ weightUnit: 'kg' })}
            >
              <Text style={[styles.unitToggleText, data.weightUnit === 'kg' && styles.unitToggleTextOn]}>kg</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unitToggleBtn, data.weightUnit === 'lbs' && styles.unitToggleBtnOn]}
              onPress={() => update({ weightUnit: 'lbs' })}
            >
              <Text style={[styles.unitToggleText, data.weightUnit === 'lbs' && styles.unitToggleTextOn]}>lbs</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weightGroup}>
            <Text style={styles.sectionLabelCenter}>Current weight</Text>
            <View style={styles.numberRow}>
              <TextInput
                style={styles.numberInput}
                value={data.currentWeight}
                onChangeText={(currentWeight) => update({ currentWeight })}
                placeholder="68"
                placeholderTextColor="rgba(0,0,0,0.2)"
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.numberUnit}>{data.weightUnit}</Text>
            </View>
            {currentWeightError ? <Text style={styles.validationText}>{currentWeightError}</Text> : null}
          </View>

          {needsTargetWeight ? (
            <View style={styles.weightGroup}>
              <Text style={styles.sectionLabelCenter}>Target weight</Text>
              <View style={styles.numberRow}>
                <TextInput
                  style={styles.numberInput}
                  value={data.targetWeight}
                  onChangeText={(targetWeight) => update({ targetWeight })}
                  placeholder="60"
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  keyboardType="numeric"
                  textAlign="center"
                />
                <Text style={styles.numberUnit}>{data.weightUnit}</Text>
              </View>
              {targetWeightError ? <Text style={styles.validationText}>{targetWeightError}</Text> : null}
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.optionsColumn}>
        {conditionOptions.map((option) =>
          renderOptionCard({
            label: option.label,
            icon: option.id === 'None' ? '' : option.label.slice(0, 2),
            selected: data.conditions.includes(option.id),
            onPress: () => toggleCondition(option.id),
          })
        )}
      </View>
    );
  };

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const checkStyle = {
    opacity: checkAnim,
    transform: [
      {
        scale: checkAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  };

  const textStyle = {
    opacity: textAnim,
    transform: [
      {
        translateY: textAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const buttonStyle = {
    opacity: buttonAnim,
    transform: [
      {
        translateY: buttonAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.bgGlowTop, isDark && styles.bgGlowTopDark]} />
      <View style={[styles.bgGlowBottom, isDark && styles.bgGlowBottomDark]} />
      <View style={styles.bgPattern}>
        <View style={styles.bgDot} />
        <View style={styles.bgDot} />
        <View style={styles.bgDot} />
        <View style={styles.bgDot} />
      </View>
      <View style={styles.screenWrap}>
        <View style={styles.slideBody}>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={[styles.backBtn, isDark && styles.backBtnDark, stepIndex === 0 && styles.backBtnHidden]}
              onPress={goBack}
              disabled={stepIndex === 0}
            >
              <Ionicons name="chevron-back" size={14} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'} />
            </TouchableOpacity>
            <Text style={[styles.progressCount, isDark && styles.progressCountDark]}>{`${stepIndex + 1} of ${steps.length}`}</Text>
          </View>

          <View style={[styles.progressBar, isDark && styles.progressBarDark]}>
            <View style={[styles.progressFillStatic, { width: progressWidth }]} />
          </View>

          <Text style={[styles.questionTag, isDark && styles.questionTagDark]}>{step.tag}</Text>
          <Text style={[styles.questionText, isDark && styles.questionTextDark]}>{step.title}</Text>
          <Text style={[styles.questionSub, isDark && styles.questionSubDark]}>{step.subtitle}</Text>

          <ScrollView
            style={styles.contentArea}
            contentContainerStyle={(stepIndex === 0 || stepIndex === 3) ? styles.contentAreaFull : styles.contentAreaPadded}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.ctaBtn, !canContinue && styles.ctaBtnDisabled]}
            onPress={goNext}
            disabled={!canContinue}
          >
            <Text style={[styles.ctaText, !canContinue && styles.ctaTextDisabled]}>
              {stepIndex === steps.length - 1 ? 'See my plan' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

        {showSuccess ? (
          <View style={styles.successOverlay}>
            <View style={styles.successGlowTop} />
            <View style={styles.successGlowBottom} />
            <View style={styles.successPattern}>
              <View style={styles.successDot} />
              <View style={styles.successDot} />
              <View style={styles.successDot} />
              <View style={styles.successDot} />
            </View>
            <Text style={styles.successEyebrow}>Afri Fast</Text>
            <View style={styles.waterWrap}>
              <View style={styles.waterCircle}>
                <Animated.View style={[styles.waterFill, { height: fillHeight }]}>
                  <View style={styles.wave} />
                  <View style={styles.waveSoft} />
                </Animated.View>
              </View>
              <Animated.View style={[styles.waterCheck, checkStyle]}>
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </Animated.View>
            </View>

            <Animated.Text style={[styles.successTitle, textStyle]}>
              {`You're all set,\n${displayName}.`}
            </Animated.Text>
            <Animated.Text style={[styles.successBody, textStyle]}>
              Your Afri Fast setup is ready. Let’s build healthier rhythm, better nourishment, and more intentional fasting.
            </Animated.Text>
            <Animated.View style={buttonStyle}>
              <TouchableOpacity style={styles.successBtn} onPress={finishOnboarding}>
                <Text style={styles.successBtnText}>Start my Afri Fast</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFBF7',
  },
  containerDark: {
    backgroundColor: '#0D0D1C',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -90,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
  },
  bgGlowTopDark: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  bgGlowBottom: {
    position: 'absolute',
    left: -80,
    bottom: 100,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
  },
  bgGlowBottomDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  bgPattern: {
    position: 'absolute',
    top: 120,
    right: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 44,
    opacity: 0.22,
  },
  bgDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C97A1B',
    marginRight: 6,
    marginBottom: 6,
  },
  screenWrap: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  slideBody: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 26,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  backBtnDark: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backBtnHidden: {
    opacity: 0,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.35)',
  },
  progressCountDark: {
    color: 'rgba(255,255,255,0.35)',
  },
  progressBar: {
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(120,113,108,0.16)',
    overflow: 'hidden',
    marginBottom: 26,
  },
  progressBarDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFillStatic: {
    height: '100%',
    backgroundColor: '#0F9D78',
  },
  questionTag: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#0F9D78',
    marginBottom: 10,
    textAlign: 'center',
  },
  questionTagDark: {
    color: '#2DD4A4',
  },
  questionText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111111',
    lineHeight: 34,
    marginBottom: 7,
    textAlign: 'center',
  },
  questionTextDark: {
    color: '#FFFFFF',
  },
  questionSub: {
    fontSize: 12,
    fontWeight: '300',
    color: 'rgba(0,0,0,0.42)',
    lineHeight: 19,
    marginBottom: 14,
    textAlign: 'center',
  },
  questionSubDark: {
    color: 'rgba(255,255,255,0.42)',
  },
  contentArea: {
    flex: 1,
  },
  contentAreaFull: {
    flexGrow: 1,
  },
  contentAreaPadded: {
    paddingBottom: 24,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  nameStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    gap: 20,
  },
  waveIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  waveEmoji: {
    fontSize: 30,
  },
  nameInputCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  nameLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  greetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5C842',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    width: '100%',
    justifyContent: 'center',
    gap: 8,
  },
  greetEmoji: {
    fontSize: 18,
  },
  greetText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B2A00',
  },
  greetName: {
    fontWeight: '800',
    color: '#3B2A00',
  },
  mixedStep: {
    paddingBottom: 24,
    gap: 24,
  },
  optionGroup: {
    gap: 10,
  },
  measurementRow: {
    gap: 24,
  },
  measurementBlock: {
    gap: 10,
    alignItems: 'center',
    width: '100%',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.42)',
    textAlign: 'center',
  },
  sectionLabelCenter: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.42)',
    textAlign: 'center',
    marginBottom: 8,
  },
  bigInput: {
    width: '100%',
    borderWidth: 0,
    paddingVertical: 0,
    fontSize: 22,
    fontWeight: '400',
    color: '#FFFFFF',
    outlineWidth: 0,
    textAlign: 'left',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 9,
    overflow: 'hidden',
    marginBottom: 18,
  },
  unitToggleBtn: {
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  unitToggleBtnOn: {
    backgroundColor: '#0F9D78',
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.4)',
  },
  unitToggleTextOn: {
    color: '#0A0F0D',
    fontWeight: '600',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  numberRowSmall: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
  },
  numberInput: {
    width: 130,
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    paddingVertical: 6,
    fontSize: 44,
    fontWeight: '300',
    color: '#111111',
    outlineWidth: 0,
    textAlign: 'center',
  },
  smallNumberInput: {
    width: 110,
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    paddingVertical: 6,
    fontSize: 32,
    fontWeight: '300',
    color: '#111111',
    outlineWidth: 0,
    textAlign: 'center',
  },
  numberUnit: {
    fontSize: 17,
    fontWeight: '300',
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 6,
  },
  smallUnit: {
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(0,0,0,0.35)',
    marginBottom: 6,
  },
  optionsColumn: {
    gap: 8,
    paddingBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FBFAF7',
  },
  optionCardSelected: {
    borderColor: '#0F9D78',
    backgroundColor: 'rgba(15,157,120,0.08)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: 'rgba(15,157,120,0.15)',
  },
  optionIconText: {
    fontSize: 11,
    color: 'rgba(0,0,0,0.4)',
    fontWeight: '500',
  },
  optionIconTextSelected: {
    color: '#0F9D78',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#111111',
  },
  optionSub: {
    fontSize: 11,
    fontWeight: '300',
    color: 'rgba(0,0,0,0.38)',
    marginTop: 2,
  },
  optionCheck: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckSelected: {
    backgroundColor: '#0F9D78',
    borderColor: '#0F9D78',
  },
  weightGroup: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  validationText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#B45309',
    textAlign: 'center',
    maxWidth: 240,
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 26,
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  ctaBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 15,
    backgroundColor: '#0F9D78',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F9D78',
    shadowOpacity: Platform.OS === 'web' ? 0.18 : 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnDisabled: {
    backgroundColor: 'rgba(16,185,129,0.16)',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A0F0D',
  },
  ctaTextDisabled: {
    color: 'rgba(16,185,129,0.32)',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FCFBF7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 30,
  },
  successGlowTop: {
    position: 'absolute',
    top: -80,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  successGlowBottom: {
    position: 'absolute',
    left: -70,
    bottom: 70,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 157, 120, 0.12)',
  },
  successPattern: {
    position: 'absolute',
    top: 110,
    left: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 44,
    opacity: 0.2,
  },
  successDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C97A1B',
    marginRight: 6,
    marginBottom: 6,
  },
  successEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#9A5A00',
    marginBottom: 18,
  },
  waterWrap: {
    width: 160,
    height: 160,
    marginBottom: 32,
    position: 'relative',
  },
  waterCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: '#0F9D78',
    backgroundColor: '#F5EBD6',
    overflow: 'hidden',
  },
  waterFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F9D78',
  },
  wave: {
    position: 'absolute',
    top: -14,
    left: -20,
    width: 200,
    height: 28,
    backgroundColor: '#0F9D78',
    borderRadius: 999,
  },
  waveSoft: {
    position: 'absolute',
    top: -10,
    left: -20,
    width: 200,
    height: 22,
    backgroundColor: 'rgba(15,157,120,0.4)',
    borderRadius: 999,
  },
  waterCheck: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
    lineHeight: 31,
    marginBottom: 10,
  },
  successBody: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(63,52,40,0.72)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    maxWidth: 290,
  },
  successBtn: {
    paddingVertical: 16,
    paddingHorizontal: 44,
    borderRadius: 15,
    backgroundColor: '#0F9D78',
    shadowColor: '#0F9D78',
    shadowOpacity: Platform.OS === 'web' ? 0.18 : 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  successBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
