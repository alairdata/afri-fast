import React, { useState, useEffect } from 'react';

const FastingApp = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [fastingHours, setFastingHours] = useState(6);
  const [fastingMinutes, setFastingMinutes] = useState(32);
  const [isFasting, setIsFasting] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [hunger, setHunger] = useState('medium');
  const [energy, setEnergy] = useState('low');
  const [mood, setMood] = useState('okay');
  
  // Time edit modal state
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showPlanPage, setShowPlanPage] = useState(false);
  const [showCheckInPage, setShowCheckInPage] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('16:8');
  const [editingTime, setEditingTime] = useState('start'); // 'start' or 'end'
  
  // Check-in state
  const [feelings, setFeelings] = useState([]);
  const [fastingStatus, setFastingStatus] = useState('');
  const [hungerLevel, setHungerLevel] = useState('');
  const [moods, setMoods] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [fastBreak, setFastBreak] = useState([]);
  const [activities, setActivities] = useState([]);
  const [otherFactors, setOtherFactors] = useState([]);
  const [waterCount, setWaterCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! 👋 I noticed your longer fasts may be affecting your energy levels. I'm here to help you optimize your fasting schedule. What would you like to know?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [progressRange, setProgressRange] = useState('7 days');
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showFastingDetails, setShowFastingDetails] = useState(false);
  const [showBMIDetails, setShowBMIDetails] = useState(false);
  const [showCalorieDetails, setShowCalorieDetails] = useState(false);
  const [showHydrationDetails, setShowHydrationDetails] = useState(false);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [weightStatsRange, setWeightStatsRange] = useState('7 days');
  const [showWeightStatsDropdown, setShowWeightStatsDropdown] = useState(false);
  const [calorieRange, setCalorieRange] = useState('7 days');
  const [hydrationStatsRange, setHydrationStatsRange] = useState('7 days');
  const [showHydrationStatsDropdown, setShowHydrationStatsDropdown] = useState(false);
  const [newWaterIntake, setNewWaterIntake] = useState('');
  const [waterUnit, setWaterUnit] = useState('oz');
  const [waterLogs, setWaterLogs] = useState([
    { date: 'Today, Jan 24', amount: 72, unit: 'oz' },
    { date: 'Thu, Jan 23', amount: 64, unit: 'oz' },
    { date: 'Wed, Jan 22', amount: 80, unit: 'oz' },
    { date: 'Tue, Jan 21', amount: 56, unit: 'oz' },
    { date: 'Mon, Jan 20', amount: 72, unit: 'oz' },
    { date: 'Sun, Jan 19', amount: 48, unit: 'oz' },
    { date: 'Sat, Jan 18', amount: 64, unit: 'oz' },
    { date: 'Fri, Jan 17', amount: 72, unit: 'oz' },
    { date: 'Thu, Jan 16', amount: 68, unit: 'oz' },
    { date: 'Wed, Jan 15', amount: 76, unit: 'oz' },
  ]);

  // Meals tab state
  const [mealsActiveSection, setMealsActiveSection] = useState('meals'); // 'meals' or 'recipes'
  const [showLogMealModal, setShowLogMealModal] = useState(false);
  const [showLogMealOptions, setShowLogMealOptions] = useState(false);
  const [logMealMethod, setLogMealMethod] = useState(null); // 'scan', 'write', 'say'
  const [selectedMealDate, setSelectedMealDate] = useState(new Date());
  const [showMakeRecipePage, setShowMakeRecipePage] = useState(false);
  const [showFindRecipePage, setShowFindRecipePage] = useState(false);
  
  // Settings state
  const [userName, setUserName] = useState('Sarah');
  const [userEmail, setUserEmail] = useState('sarah@example.com');
  const [fastingSchedule, setFastingSchedule] = useState('16:8');
  const [fastingReminders, setFastingReminders] = useState(true);
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(120);
  const [carbsGoal, setCarbsGoal] = useState(200);
  const [fatsGoal, setFatsGoal] = useState(65);
  const [hydrationGoal, setHydrationGoal] = useState(72);
  const [notifyFastStart, setNotifyFastStart] = useState(true);
  const [notifyFastEnd, setNotifyFastEnd] = useState(true);
  const [notifyMealReminder, setNotifyMealReminder] = useState(false);
  const [notifyMilestones, setNotifyMilestones] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [volumeUnit, setVolumeUnit] = useState('oz');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showMakeRecipeModal, setShowMakeRecipeModal] = useState(false);
  const [makeRecipeMethod, setMakeRecipeMethod] = useState(null); // 'photo', 'list'
  const [showFindRecipeModal, setShowFindRecipeModal] = useState(false);
  const [mealInput, setMealInput] = useState('');
  const [ingredientInput, setIngredientInput] = useState('');
  const [recipeSearchInput, setRecipeSearchInput] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [detectedFoods, setDetectedFoods] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [recentMeals, setRecentMeals] = useState([
    { id: 1, name: 'Grilled Chicken Salad', calories: 450, time: 'Today, 12:30 PM', items: ['Chicken breast', 'Mixed greens', 'Tomatoes', 'Olive oil'] },
    { id: 2, name: 'Overnight Oats', calories: 380, time: 'Today, 8:00 AM', items: ['Oats', 'Almond milk', 'Banana', 'Honey'] },
    { id: 3, name: 'Salmon & Vegetables', calories: 520, time: 'Yesterday, 7:00 PM', items: ['Salmon fillet', 'Broccoli', 'Brown rice'] },
  ]);
  const [savedRecipes, setSavedRecipes] = useState([
    { id: 1, name: 'Mediterranean Bowl', time: '25 min', calories: 480, image: '🥗', cuisine: 'Mediterranean' },
    { id: 2, name: 'Chicken Stir Fry', time: '20 min', calories: 420, image: '🍳', cuisine: 'Asian' },
    { id: 3, name: 'Avocado Toast', time: '10 min', calories: 320, image: '🥑', cuisine: 'American' },
  ]);
  const [newWeight, setNewWeight] = useState('');
  const [weightLogs, setWeightLogs] = useState([
    { date: 'Jan 24, 2026', weight: 72.5, unit: 'kg' },
    { date: 'Jan 22, 2026', weight: 72.8, unit: 'kg' },
    { date: 'Jan 20, 2026', weight: 73.1, unit: 'kg' },
    { date: 'Jan 18, 2026', weight: 73.4, unit: 'kg' },
    { date: 'Jan 15, 2026', weight: 73.8, unit: 'kg' },
    { date: 'Jan 12, 2026', weight: 74.2, unit: 'kg' },
  ]);

  // Dynamic data based on time range
  const getProgressData = () => {
    switch(progressRange) {
      case '7 days':
        return {
          avgFastLength: '16h 20m',
          completionRate: '82%',
          currentStreak: '6 days',
          longestFast: '21h',
          avgTrend: '↑ Improving',
          rateTrend: '→ Stable',
          streakTrend: '🔥 Great!',
          longestTrend: '↑ New record',
          fastingBars: [14, 16, 12, 0, 18, 15, 10],
          fastingAvg: 14,
          waterBars: [48, 64, 36, 72, 58, 68, 40],
          waterAvg: 55,
          waterGoalMet: '3/7',
          weightChange: '-0.5 kg',
          weeklyChange: '-0.3 kg',
          weightData: 'M0,50 Q30,48 60,52 T120,48 T180,45 T240,42',
          weightPrediction: 'M240,42 L300,35',
          predictedWeight: '-0.8 kg',
          weightLabels: ['Mon', 'Wed', 'Fri', 'Sun', '+7d'],
          totalFastingHours: '85h',
          fastDaysCompleted: '6/7',
          barLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        };
      case '30 days':
        return {
          avgFastLength: '15h 45m',
          completionRate: '78%',
          currentStreak: '6 days',
          longestFast: '22h',
          avgTrend: '↑ Improving',
          rateTrend: '↑ +5%',
          streakTrend: '🔥 Great!',
          longestTrend: '→ Stable',
          fastingBars: [15, 14, 16, 17, 15],
          fastingAvg: 15.4,
          waterBars: [52, 58, 62, 55, 60],
          waterAvg: 57,
          waterGoalMet: '18/30',
          weightChange: '-1.8 kg',
          weeklyChange: '-0.4 kg',
          weightData: 'M0,60 Q40,55 80,58 T160,50 T240,42',
          weightPrediction: 'M240,42 L300,32',
          predictedWeight: '-2.5 kg',
          weightLabels: ['Week 1', 'Week 2', 'Week 3', 'Now', '+30d'],
          totalFastingHours: '362h',
          fastDaysCompleted: '24/30',
          barLabels: ['W1', 'W2', 'W3', 'W4', 'W5'],
        };
      case '90 days':
        return {
          avgFastLength: '15h 30m',
          completionRate: '75%',
          currentStreak: '6 days',
          longestFast: '24h',
          avgTrend: '↑ Improving',
          rateTrend: '↑ +12%',
          streakTrend: '🔥 Great!',
          longestTrend: '↑ New record',
          fastingBars: [14, 15, 16, 15, 16, 17],
          fastingAvg: 15.5,
          waterBars: [50, 54, 58, 60, 62, 65],
          waterAvg: 58,
          waterGoalMet: '52/90',
          weightChange: '-4.2 kg',
          weeklyChange: '-0.35 kg',
          weightData: 'M0,70 Q50,65 100,58 T200,45 T240,38',
          weightPrediction: 'M240,38 L300,25',
          predictedWeight: '-5.8 kg',
          weightLabels: ['Month 1', 'Month 2', 'Now', '+90d'],
          totalFastingHours: '1,024h',
          fastDaysCompleted: '68/90',
          barLabels: ['M1', 'M1.5', 'M2', 'M2.5', 'M3', 'Now'],
        };
      case 'All time':
        return {
          avgFastLength: '15h 15m',
          completionRate: '73%',
          currentStreak: '6 days',
          longestFast: '26h',
          avgTrend: '↑ Improving',
          rateTrend: '↑ +18%',
          streakTrend: '🔥 Great!',
          longestTrend: '↑ Personal best',
          fastingBars: [12, 14, 15, 15, 16, 16],
          fastingAvg: 14.7,
          waterBars: [45, 50, 55, 58, 60, 62],
          waterAvg: 55,
          waterGoalMet: '156/365',
          weightChange: '-8.5 kg',
          weeklyChange: '-0.3 kg',
          weightData: 'M0,80 Q60,70 120,55 T200,40 T240,32',
          weightPrediction: 'M240,32 L300,20',
          predictedWeight: '-10.2 kg',
          weightLabels: ['Start', '6mo', 'Now', '+6mo'],
          totalFastingHours: '2,847h',
          fastDaysCompleted: '267/365',
          barLabels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Now'],
        };
      default:
        return {};
    }
  };

  const progressData = getProgressData();

  const convertWeight = (weight, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return weight;
    if (fromUnit === 'kg' && toUnit === 'lb') return (weight * 2.20462).toFixed(1);
    if (fromUnit === 'lb' && toUnit === 'kg') return (weight / 2.20462).toFixed(1);
    return weight;
  };

  const saveWeight = () => {
    if (!newWeight) return;
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const newLog = { date: dateStr, weight: parseFloat(newWeight), unit: weightUnit };
    setWeightLogs([newLog, ...weightLogs]);
    setNewWeight('');
  };

  const deleteWeightLog = (index) => {
    setWeightLogs(weightLogs.filter((_, i) => i !== index));
  };

  const saveWaterIntake = () => {
    if (!newWaterIntake) return;
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[today.getDay()];
    const dateStr = `${dayName}, ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const newLog = { date: dateStr, amount: parseFloat(newWaterIntake), unit: waterUnit };
    setWaterLogs([newLog, ...waterLogs]);
    setNewWaterIntake('');
  };

  const deleteWaterLog = (index) => {
    setWaterLogs(waterLogs.filter((_, i) => i !== index));
  };

  const convertWaterUnit = (amount, fromUnit, toUnit) => {
    if (fromUnit === toUnit) return amount;
    if (fromUnit === 'oz' && toUnit === 'ml') return Math.round(amount * 29.574);
    if (fromUnit === 'ml' && toUnit === 'oz') return Math.round(amount / 29.574);
    return amount;
  };

  const [startDay, setStartDay] = useState('Today');
  const [startHour, setStartHour] = useState(20);
  const [startMinute, setStartMinute] = useState(0);
  const [startSecond, setStartSecond] = useState(0);
  const [endDay, setEndDay] = useState('Tomorrow');
  const [endHour, setEndHour] = useState(12);
  const [endMinute, setEndMinute] = useState(0);
  const [endSecond, setEndSecond] = useState(0);

  const days = ['Yesterday', 'Today', 'Tomorrow'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutesSeconds = Array.from({ length: 60 }, (_, i) => i);

  const formatTime = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const selectPlan = (plan) => {
    setSelectedPlan(plan.id);
    // Calculate new end time based on plan
    const newEndHour = (startHour + plan.fastHours) % 24;
    setEndHour(newEndHour);
    setEndDay(startHour + plan.fastHours >= 24 ? 'Tomorrow' : 'Today');
    setShowPlanPage(false);
  };

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

  const saveCheckIn = () => {
    setShowCheckInPage(false);
    setIsRefining(true);
    setTimeout(() => {
      setIsRefining(false);
    }, 3000);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "Based on your check-ins, I'd recommend trying a 16:8 schedule on busy days instead of 18:6. This gives you more flexibility while maintaining benefits.",
        "Your energy dips seem to happen around hour 14-16. Try having electrolytes or black coffee during this window to help push through.",
        "I've noticed you feel best when you break your fast with protein-focused meals. Keep that up! It helps stabilize blood sugar.",
        "Consider shifting your eating window earlier on days you report poor sleep. Late eating can affect sleep quality.",
        "Your consistency is great! 6 days in a row is impressive. Remember, it's okay to have rest days when needed."
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      setChatMessages(prev => [...prev, { role: 'assistant', content: randomResponse }]);
      setIsTyping(false);
    }, 1500);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setFastingMinutes(m => {
        if (m >= 59) {
          setFastingHours(h => h + 1);
          return 0;
        }
        return m + 1;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const progress = ((fastingHours * 60 + fastingMinutes) / (16 * 60)) * 100;
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatDate = () => {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getStageInfo = () => {
    if (fastingHours < 4) return { stage: 'Fed State', desc: 'Body is digesting food' };
    if (fastingHours < 8) return { stage: 'Early Fasting', desc: 'Insulin levels dropping' };
    if (fastingHours < 12) return { stage: 'Fat Burning', desc: 'Body switching to fat fuel' };
    if (fastingHours < 16) return { stage: 'Ketosis Entry', desc: 'Ketone production rising' };
    return { stage: 'Deep Ketosis', desc: 'Autophagy may begin' };
  };

  const insights = [
    { title: "Today's fasting stage", subtitle: "Understanding fat burning", color: '#E8F5E9', accent: '#4CAF50' },
    { title: "What to expect at hour 12", subtitle: "Your body at midpoint", color: '#FFF3E0', accent: '#FF9800' },
    { title: "Hydration tip", subtitle: "Stay energized today", color: '#E3F2FD', accent: '#2196F3' },
    { title: "Electrolyte guide", subtitle: "3 min read", color: '#FCE4EC', accent: '#E91E63' },
  ];

  const patternCards = [
    { title: "Best foods to break your fast", time: "5 min read", icon: "🥗" },
    { title: "Common mistakes at your stage", time: "4 min read", icon: "⚠️" },
    { title: "Why energy may feel low", time: "3 min read", icon: "💡" },
    { title: "Optimize your eating window", time: "6 min read", icon: "⏰" },
    { title: "Sleep & fasting connection", time: "4 min read", icon: "😴" },
  ];

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const fastHistory = [true, true, true, false, true, true, null];

  return (
    <div style={styles.container}>
      {/* Background gradient mesh */}
      <div style={styles.bgMesh}></div>
      <div style={styles.bgOrb1}></div>
      <div style={styles.bgOrb2}></div>

      {/* Header */}
      {activeTab === 'today' && (
        <>
        <header style={styles.headerCompact}>
        <div style={styles.avatarSmall}>
          <span style={styles.avatarTextSmall}>JK</span>
        </div>
        <div style={styles.dateContainer}>
          <span style={styles.dateTextSmall}>{formatDate()}</span>
        </div>
        <button style={styles.calendarBtnSmall}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="9" y1="2" x2="9" y2="6" />
            <line x1="15" y1="2" x2="15" y2="6" />
          </svg>
        </button>
      </header>

      <div style={styles.scrollContainer}>
        {/* Primary Status Card */}
        <section style={styles.heroCardCompact}>
          <div style={styles.heroGlowSmall}></div>
          <div style={styles.heroContent}>
            <div style={styles.progressRingSmall}>
              <svg width="180" height="180" style={styles.progressSvg}>
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="50%" stopColor="#A855F7" />
                    <stop offset="100%" stopColor="#C084FC" />
                  </linearGradient>
                  <linearGradient id="refiningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="50%" stopColor="#34D399" />
                    <stop offset="100%" stopColor="#6EE7B7" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="glowStrong">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  cx="90"
                  cy="90"
                  r="80"
                  fill="none"
                  stroke="rgba(124, 58, 237, 0.12)"
                  strokeWidth="8"
                />
                {isRefining ? (
                  <circle
                    cx="90"
                    cy="90"
                    r="80"
                    fill="none"
                    stroke="url(#refiningGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="40 20"
                    filter="url(#glowStrong)"
                    style={{ 
                      animation: 'spin 1s linear infinite',
                      transformOrigin: '90px 90px'
                    }}
                  />
                ) : (
                  <circle
                    cx="90"
                    cy="90"
                    r="80"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 80}
                    strokeDashoffset={2 * Math.PI * 80 - (progress / 100) * 2 * Math.PI * 80}
                    transform="rotate(-90 90 90)"
                    filter="url(#glow)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                )}
              </svg>
              <div style={styles.progressInnerSmall}>
                {isRefining ? (
                  <>
                    <span style={styles.refiningIconSmall}>✨</span>
                    <span style={styles.refiningTextSmall}>Refining...</span>
                  </>
                ) : (
                  <>
                    <span style={styles.fastingLabelSmall}>FASTING</span>
                    <span style={styles.timeDisplayCompact}>
                      {fastingHours}h {fastingMinutes}m
                    </span>
                    <span style={styles.stageTextSmall}>{getStageInfo().stage}</span>
                  </>
                )}
              </div>
            </div>

            {/* Check-in Button - integrated */}
            <button style={styles.checkInBtnIntegrated} onClick={() => setShowCheckInPage(true)}>
              <span style={styles.checkInIcon}>+</span>
              <span style={styles.checkInText}>Check In</span>
            </button>

            <div style={styles.dualButtonsContainerCompact}>
              <div style={styles.dualButtonWrapperCompact}>
                <button style={styles.startFastBtnCompact}>
                  <span style={styles.btnTextDualCompact}>Start Fast</span>
                </button>
                <button style={styles.timeEditBtn} onClick={() => { setEditingTime('start'); setShowTimeModal(true); }}>
                  <span style={styles.buttonTimeLabelSmall}>{startDay}, {formatTime(startHour, startMinute)}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
              <div style={styles.dualButtonWrapperCompact}>
                <button style={styles.endFastBtnCompact}>
                  <span style={{...styles.btnTextDualCompact, color: '#fff'}}>End Fast</span>
                  <div style={styles.btnShine}></div>
                </button>
                <button style={styles.timeEditBtn} onClick={() => setShowPlanPage(true)}>
                  <span style={styles.buttonTimeLabelSmall}>{endDay}, {formatTime(endHour, endMinute)}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Today's Insights */}
        <section style={{...styles.sectionTight, marginTop: '72px'}}>
          <h2 style={styles.sectionTitleTight}>Today's Insights</h2>
          <div style={styles.insightsScrollCompact}>
            {insights.map((insight, i) => (
              <div key={i} style={{...styles.insightCardCompact, backgroundColor: insight.color}}>
                <div style={{...styles.insightAccentSmall, backgroundColor: insight.accent}}></div>
                <h3 style={styles.insightTitleSmall}>{insight.title}</h3>
                <p style={styles.insightSubSmall}>{insight.subtitle}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Education Cards - Scrollable */}
        <section style={{...styles.sectionTight, marginTop: '28px'}}>
          <h2 style={styles.sectionTitleTight}>💡 Just for You</h2>
          <div style={styles.eduScrollCompact}>
            <div style={styles.educationCard}>
              <div style={styles.eduGradient}></div>
              <div style={styles.eduContent}>
                <h3 style={styles.eduTitle}>Hunger spikes are normal around hour 16</h3>
                <p style={styles.eduDesc}>Understanding ghrelin waves can help you push through the hardest moments.</p>
                <button style={styles.eduBtn}>Learn more</button>
              </div>
            </div>
            <div style={{...styles.educationCard, background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)'}}>
              <div style={{...styles.eduGradient, background: 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.2) 0%, transparent 70%)'}}></div>
              <div style={styles.eduContent}>
                <h3 style={styles.eduTitle}>What breaks a fast?</h3>
                <p style={styles.eduDesc}>Learn which foods and drinks will kick you out of your fasted state.</p>
                <button style={styles.eduBtn}>Learn more</button>
              </div>
            </div>
            <div style={{...styles.educationCard, background: 'linear-gradient(135deg, #9333EA 0%, #EC4899 100%)'}}>
              <div style={{...styles.eduGradient, background: 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.2) 0%, transparent 70%)'}}></div>
              <div style={styles.eduContent}>
                <h3 style={styles.eduTitle}>Electrolytes during fasting</h3>
                <p style={styles.eduDesc}>Stay energized and avoid fatigue with proper mineral balance.</p>
                <button style={styles.eduBtn}>Learn more</button>
              </div>
            </div>
          </div>
        </section>

        {/* Based on Your Pattern - Scrollable */}
        <section style={styles.sectionTight}>
          <h2 style={styles.sectionTitleTight}>Based on Your Pattern</h2>
          <div style={styles.patternScrollCompact}>
            {patternCards.map((card, i) => (
              <div key={i} style={styles.patternCardLarge}>
                <span style={styles.patternIconLarge}>{card.icon}</span>
                <h4 style={styles.patternTitleLarge}>{card.title}</h4>
                <span style={styles.patternTimeLarge}>{card.time}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Alert Card */}
        <section style={styles.sectionTight}>
          <div style={styles.alertCard}>
            <div style={styles.alertIcon}>⚡</div>
            <div style={styles.alertContent}>
              <p style={styles.alertText}>We noticed longer fasts may affect your energy. Consider shorter fasts on busy days.</p>
              <button style={styles.alertBtn} onClick={() => setShowChat(true)}>Review insight</button>
            </div>
          </div>
        </section>

        {/* This Week (formerly Fasting History) */}
        <section style={styles.sectionTight}>
          <div style={styles.historyHeader}>
            <h2 style={styles.sectionTitleTightInline}>This Week</h2>
            <button style={styles.seeAllBtn} onClick={() => setActiveTab('progress')}>See all</button>
          </div>
          <div style={styles.historyCard}>
            <div style={styles.historyDots}>
              {weekDays.map((day, i) => (
                <div key={i} style={styles.historyDay}>
                  <div style={{
                    ...styles.historyDot,
                    backgroundColor: fastHistory[i] === null ? '#E0E0E0' : fastHistory[i] ? '#059669' : 'transparent',
                    border: fastHistory[i] === false ? '2px solid #E0E0E0' : 'none'
                  }}>
                    {fastHistory[i] && fastHistory[i] !== null && <span style={styles.dotCheck}>✓</span>}
                  </div>
                  <span style={{...styles.dayLabel, color: i === 6 ? '#059669' : '#9E9E9E'}}>{day}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Your Stats */}
        <section style={styles.sectionTight}>
          <div style={styles.historyHeader}>
            <h2 style={styles.sectionTitleTightInline}>Your Stats</h2>
            <button style={styles.seeAllBtn} onClick={() => setActiveTab('progress')}>See all</button>
          </div>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>16h</span>
              <span style={styles.statLabel}>Avg fast length</span>
              <span style={styles.statBadge}>Good</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>4</span>
              <span style={styles.statLabel}>Weekly fasts</span>
              <span style={{...styles.statBadge, backgroundColor: '#FFF3E0', color: '#E65100'}}>Normal</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>6</span>
              <span style={styles.statLabel}>Day streak</span>
              <span style={{...styles.statBadge, backgroundColor: '#E8F5E9', color: '#2E7D32'}}>🔥</span>
            </div>
          </div>
        </section>

        {/* Sleep & Hydration */}
        <section style={styles.sectionTight}>
          <div style={styles.wellnessCard}>
            <div style={styles.wellnessItem}>
              <span style={styles.wellnessIcon}>😴</span>
              <div style={styles.wellnessInfo}>
                <span style={styles.wellnessLabel}>Sleep score</span>
                <span style={styles.wellnessValue}>78 / 100</span>
              </div>
            </div>
            <div style={styles.wellnessDivider}></div>
            <div style={styles.wellnessItem}>
              <span style={styles.wellnessIcon}>💧</span>
              <div style={styles.wellnessInfo}>
                <span style={styles.wellnessLabel}>Hydration</span>
                <span style={styles.wellnessValue}>4 / 8 glasses</span>
              </div>
            </div>
          </div>
        </section>

        {/* Premium Upsell */}
        <section style={styles.sectionTight}>
          <div style={styles.premiumCard}>
            <div style={styles.premiumGlow}></div>
            <div style={styles.premiumContent}>
              <span style={styles.premiumBadge}>✨ PREMIUM</span>
              <h3 style={styles.premiumTitle}>Unlock personalized fasting insights</h3>
              <ul style={styles.premiumList}>
                <li style={styles.premiumItem}>• AI-powered recommendations</li>
                <li style={styles.premiumItem}>• Advanced analytics</li>
                <li style={styles.premiumItem}>• Custom fasting plans</li>
              </ul>
              <button style={styles.premiumBtn}>
                <span>Start free trial</span>
              </button>
            </div>
          </div>
        </section>

        <div style={styles.bottomSpacer}></div>
      </div>
      </>
      )}

      {/* Progress Tab Content */}
      {activeTab === 'progress' && (
        <div style={styles.progressTab}>
            {/* Header */}
            <div style={styles.progressHeaderCompact}>
              <h1 style={styles.progressTitleCompact}>Progress</h1>
              <button style={styles.filterBtnSmall}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
              </button>
            </div>
            
            {/* Time Range Selector */}
            <div style={styles.timeRangeSelectorCompact}>
              {['7 days', '30 days', '90 days', 'All time'].map((range) => (
                <button
                  key={range}
                  style={{
                    ...styles.timeRangeBtnCompact,
                    ...(progressRange === range ? styles.timeRangeBtnActiveCompact : {})
                  }}
                  onClick={() => setProgressRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            <div style={styles.progressContentCompact}>
              {/* Section 1: Fasting Streaks */}
              <div style={styles.progressSectionCompact}>
                <div style={styles.progressSectionHeader}>
                  <h3 style={styles.progressSectionTitleCompact}>🔥 Streaks</h3>
                  <button style={styles.seeAllBtnSmall} onClick={() => setShowFastingDetails(true)}>See all</button>
                </div>
                <div style={styles.chartCardCompact}>
                  <div style={styles.streaksGridFour}>
                    <div style={styles.streakItemCompact}>
                      <span style={styles.streakValueCompact}>6</span>
                      <span style={styles.streakLabelCompact}>Current streak</span>
                    </div>
                    <div style={styles.streakItemCompact}>
                      <span style={styles.streakValueCompact}>14</span>
                      <span style={styles.streakLabelCompact}>Longest streak</span>
                    </div>
                    <div style={styles.streakItemCompact}>
                      <span style={styles.streakValueCompact}>42</span>
                      <span style={styles.streakLabelCompact}>Total fast days</span>
                    </div>
                    <div style={styles.streakItemCompact}>
                      <span style={styles.streakValueCompact}>{progressData.totalFastingHours}</span>
                      <span style={styles.streakLabelCompact}>Total fast hours</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Two Overview Cards */}
              <div style={styles.progressSectionCompact}>
                <div style={styles.twoCardGridCompact}>
                  <div style={styles.overviewTileCompact}>
                    <span style={styles.overviewValueCompact}>{progressData.avgFastLength}</span>
                    <span style={styles.overviewLabelCompact}>Avg fast length</span>
                    <span style={styles.overviewTrendCompact}>{progressData.avgTrend}</span>
                  </div>
                  <div style={styles.overviewTileCompact}>
                    <span style={styles.overviewValueCompact}>{progressData.completionRate}</span>
                    <span style={styles.overviewLabelCompact}>Completion rate</span>
                    <span style={styles.overviewTrendCompact}>{progressData.rateTrend}</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Current BMI */}
              <div style={styles.progressSectionCompact}>
                <h3 style={styles.progressSectionTitleCompact}>Current BMI</h3>
                <div style={styles.chartCardCompact}>
                  <div style={styles.bmiDisplay}>
                    <div style={styles.bmiValueContainer}>
                      <span style={styles.bmiValue}>22.4</span>
                      <span style={styles.bmiCategory}>Normal</span>
                    </div>
                    <div style={styles.bmiWeightInfo}>
                      <span style={styles.bmiWeightLabel}>Current weight</span>
                      <span style={styles.bmiWeightValue}>72 kg</span>
                    </div>
                  </div>
                  <div style={styles.bmiBarContainer}>
                    <div style={styles.bmiBar}>
                      <div style={styles.bmiBarUnderweight}></div>
                      <div style={styles.bmiBarNormal}></div>
                      <div style={styles.bmiBarOverweight}></div>
                      <div style={styles.bmiBarObese}></div>
                      <div style={{...styles.bmiIndicator, left: `${((22.4 - 15) / (35 - 15)) * 100}%`}}></div>
                    </div>
                    <div style={styles.bmiLabels}>
                      <span style={styles.bmiLabel}>Underweight</span>
                      <span style={styles.bmiLabel}>Normal</span>
                      <span style={styles.bmiLabel}>Overweight</span>
                      <span style={styles.bmiLabel}>Obese</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Weight Trends */}
              <div style={styles.progressSectionCompact}>
                <h3 style={styles.progressSectionTitleCompact}>Weight trend</h3>
                <div style={styles.chartCardCompact}>
                  <div style={styles.lineChartCompact}>
                    <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="weightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="predictionGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Actual weight line */}
                      <path
                        d={progressData.weightData}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        d={`${progressData.weightData} L240,100 L0,100 Z`}
                        fill="url(#weightGradient)"
                      />
                      {/* Prediction line */}
                      <path
                        d={progressData.weightPrediction}
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="5 3"
                      />
                      <path
                        d={`${progressData.weightPrediction} L300,100 L240,100 Z`}
                        fill="url(#predictionGradient)"
                      />
                    </svg>
                  </div>
                  <div style={styles.xAxisLabelsCompact}>
                    {progressData.weightLabels.map((label, i) => (
                      <span key={i} style={{
                        ...styles.xAxisLabelSmall,
                        color: i === progressData.weightLabels.length - 1 ? '#8B5CF6' : '#666',
                        fontWeight: i === progressData.weightLabels.length - 1 ? '600' : '400',
                      }}>{label}</span>
                    ))}
                  </div>
                  <div style={styles.weightStatsCompact}>
                    <div style={styles.weightStatCompact}>
                      <span style={styles.weightStatValueCompact}>{progressData.weightChange}</span>
                      <span style={styles.weightStatLabelCompact}>This period</span>
                    </div>
                    <div style={{...styles.weightStatCompact, background: 'rgba(139, 92, 246, 0.08)'}}>
                      <span style={{...styles.weightStatValueCompact, color: '#8B5CF6'}}>{progressData.predictedWeight}</span>
                      <span style={styles.weightStatLabelCompact}>Predicted</span>
                    </div>
                  </div>
                  <div style={styles.chartLegendCompact}>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#10B981'}}></span> Actual</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#8B5CF6', width: '12px', height: '2px'}}></span> Predicted</span>
                  </div>
                  <div style={styles.weightActionsCompact}>
                    <button style={styles.weightActionBtnCompact} onClick={() => setShowWeightModal(true)}>Log weight</button>
                    <button style={styles.weightActionLinkCompact} onClick={() => setShowWeightModal(true)}>View all logs</button>
                  </div>
                </div>
              </div>

              {/* Section 5: Calorie Intake */}
              <div style={styles.progressSectionCompact}>
                <div style={styles.progressSectionHeader}>
                  <h3 style={styles.progressSectionTitleCompact}>🔥 Calorie Intake</h3>
                  <button style={styles.seeAllBtnSmall} onClick={() => setShowCalorieDetails(true)}>See all</button>
                </div>
                <div style={styles.chartCardCompact}>
                  {/* Multi-line chart for Protein, Carbs, Fats - Smooth curves with animation */}
                  <div style={styles.calorieChartContainer}>
                    <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
                      <style>
                        {`
                          @keyframes drawLine {
                            from { stroke-dashoffset: 500; }
                            to { stroke-dashoffset: 0; }
                          }
                          .animated-line {
                            stroke-dasharray: 500;
                            animation: drawLine 2s ease-out forwards;
                          }
                        `}
                      </style>
                      <defs>
                        <linearGradient id="proteinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Protein line (red) - smooth bezier curve */}
                      <path
                        className="animated-line"
                        d="M0,60 C20,58 30,52 43,55 C56,58 70,68 86,65 C102,62 115,48 129,50 C143,52 158,60 172,58 C186,56 200,44 215,45 C230,46 245,54 258,52 C271,50 285,47 300,48"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Carbs line (orange) - smooth bezier curve */}
                      <path
                        className="animated-line"
                        style={{animationDelay: '0.2s'}}
                        d="M0,40 C20,38 30,32 43,35 C56,38 70,48 86,45 C102,42 115,28 129,30 C143,32 158,40 172,38 C186,36 200,26 215,28 C230,30 245,36 258,35 C271,34 285,31 300,32"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Fats line (purple) - smooth bezier curve */}
                      <path
                        className="animated-line"
                        style={{animationDelay: '0.4s'}}
                        d="M0,75 C20,74 30,70 43,72 C56,74 70,80 86,78 C102,76 115,68 129,70 C143,72 158,76 172,74 C186,72 200,66 215,68 C230,70 245,73 258,72 C271,71 285,64 300,65"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.xAxisLabelsCompact}>
                    {progressData.barLabels.map((label, i) => (
                      <span key={i} style={styles.xAxisLabelSmall}>{label}</span>
                    ))}
                  </div>
                  <div style={styles.chartLegendCompact}>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#EF4444'}}></span> Protein</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#F59E0B'}}></span> Carbs</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#8B5CF6'}}></span> Fats</span>
                  </div>
                  <div style={styles.calorieStatsRow}>
                    <div style={styles.calorieStatItem}>
                      <span style={styles.calorieStatValue}>1,850</span>
                      <span style={styles.calorieStatLabel}>Avg daily cal</span>
                    </div>
                    <div style={styles.calorieStatDivider}></div>
                    <div style={styles.calorieStatItem}>
                      <span style={styles.calorieStatValue}>2,100</span>
                      <span style={styles.calorieStatLabel}>Last log</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 6: Water Intake Trends */}
              <div style={styles.progressSectionCompact}>
                <div style={styles.progressSectionHeader}>
                  <h3 style={styles.progressSectionTitleCompact}>💧 Hydration</h3>
                  <button style={styles.seeAllBtnSmall} onClick={() => setShowHydrationDetails(true)}>See all</button>
                </div>
                <div style={styles.chartCardCompact}>
                  {/* Line chart for hydration - matching calorie intake style */}
                  <div style={styles.calorieChartContainer}>
                    <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
                      <style>
                        {`
                          @keyframes drawWaterLine {
                            from { stroke-dashoffset: 500; }
                            to { stroke-dashoffset: 0; }
                          }
                          .water-line {
                            stroke-dasharray: 500;
                            animation: drawWaterLine 2s ease-out forwards;
                          }
                        `}
                      </style>
                      <defs>
                        <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Goal line */}
                      <line x1="0" y1="30" x2="300" y2="30" stroke="#0EA5E9" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                      {/* Water intake line - smooth bezier curve */}
                      <path
                        d="M0,45 C30,40 50,35 75,38 C100,41 120,50 150,42 C180,34 200,28 225,32 C250,36 275,30 300,35 L300,100 L0,100 Z"
                        fill="url(#waterGradient)"
                      />
                      <path
                        className="water-line"
                        d="M0,45 C30,40 50,35 75,38 C100,41 120,50 150,42 C180,34 200,28 225,32 C250,36 275,30 300,35"
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.xAxisLabelsCompact}>
                    {progressData.barLabels.map((label, i) => (
                      <span key={i} style={styles.xAxisLabelSmall}>{label}</span>
                    ))}
                  </div>
                  <div style={styles.chartLegendCompact}>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#0EA5E9'}}></span> Intake</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#0EA5E9', opacity: 0.4, width: '12px', height: '2px'}}></span> Goal (72 oz)</span>
                  </div>
                  <div style={styles.calorieStatsRow}>
                    <div style={styles.calorieStatItem}>
                      <span style={styles.calorieStatValue}>{progressData.waterAvg} oz</span>
                      <span style={styles.calorieStatLabel}>Avg daily</span>
                    </div>
                    <div style={styles.calorieStatDivider}></div>
                    <div style={styles.calorieStatItem}>
                      <span style={styles.calorieStatValue}>{progressData.waterGoalMet}</span>
                      <span style={styles.calorieStatLabel}>Goal met</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ height: '40px' }}></div>
            </div>
          </div>
      )}

      {/* Meals Tab */}
      {activeTab === 'meals' && (
        <div style={styles.mealsContainerClean}>
          {/* Date Header */}
          <div style={styles.mealsDateHeader}>
            <button 
              style={styles.mealsDateArrow} 
              onClick={() => {
                const newDate = new Date(selectedMealDate);
                newDate.setDate(newDate.getDate() - 1);
                setSelectedMealDate(newDate);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div style={styles.mealsDateDisplay}>
              <span style={styles.mealsDateText}>
                {selectedMealDate.toDateString() === new Date().toDateString() 
                  ? 'Today' 
                  : selectedMealDate.toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
              <span style={styles.mealsDateFull}>
                {selectedMealDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <button 
              style={{
                ...styles.mealsDateArrow, 
                opacity: selectedMealDate.toDateString() === new Date().toDateString() ? 0.3 : 1,
                pointerEvents: selectedMealDate.toDateString() === new Date().toDateString() ? 'none' : 'auto'
              }} 
              onClick={() => {
                const today = new Date();
                const newDate = new Date(selectedMealDate);
                newDate.setDate(newDate.getDate() + 1);
                if (newDate <= today) {
                  setSelectedMealDate(newDate);
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Large Cutlery Display */}
          <div style={styles.cutlerySection}>
            <div style={styles.cutleryContainer}>
              {/* Glow effect rings */}
              <div style={styles.cutleryGlowOuter}></div>
              <div style={styles.cutleryGlowMiddle}></div>
              <div style={styles.cutleryGlowInner}></div>
              {/* Main cutlery circle */}
              <div style={styles.cutleryCircle}>
                <span style={styles.cutleryIcon}>🍽️</span>
              </div>
            </div>

            {/* Log Meal Button - like Check In */}
            <button style={styles.logMealBtnIntegrated} onClick={() => setShowLogMealOptions(true)}>
              <span style={styles.logMealBtnIcon}>+</span>
              <span style={styles.logMealBtnText}>Log Meal</span>
            </button>
          </div>

          {/* Log Meal Options - Full Screen Page */}
          {showLogMealOptions && (
            <div style={styles.logMealOptionsPage}>
              {/* Header */}
              <div style={styles.logMealOptionsPageHeader}>
                <button style={styles.logMealOptionsBackBtn} onClick={() => setShowLogMealOptions(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 style={styles.logMealOptionsPageTitle}>What would you like to do?</h2>
                <div style={{ width: '40px' }}></div>
              </div>

              {/* Rotating Options */}
              <div style={styles.rotatingOptionsContainer}>
                <div style={styles.rotatingOptionsCircle}>
                  {/* Scan Meal - Top */}
                  <button 
                    style={{...styles.rotatingOption, top: '-10px', left: '50%', transform: 'translateX(-50%)'}}
                    onClick={() => { setLogMealMethod('scan'); setShowLogMealOptions(false); setShowLogMealModal(true); }}
                    className="rotating-option-item"
                  >
                    <span style={styles.rotatingOptionIcon}>📸</span>
                    <span style={styles.rotatingOptionText}>Scan</span>
                  </button>
                  
                  {/* Write Meal - Top Right */}
                  <button 
                    style={{...styles.rotatingOption, top: '50px', right: '-5px'}}
                    onClick={() => { setLogMealMethod('write'); setShowLogMealOptions(false); setShowLogMealModal(true); }}
                    className="rotating-option-item"
                  >
                    <span style={styles.rotatingOptionIcon}>✍️</span>
                    <span style={styles.rotatingOptionText}>Write</span>
                  </button>
                  
                  {/* Find Recipe - Bottom Right */}
                  <button 
                    style={{...styles.rotatingOption, bottom: '20px', right: '20px'}}
                    onClick={() => { setShowLogMealOptions(false); setShowFindRecipePage(true); }}
                    className="rotating-option-item"
                  >
                    <span style={styles.rotatingOptionIcon}>🔍</span>
                    <span style={styles.rotatingOptionText}>Find</span>
                  </button>
                  
                  {/* Make Recipe - Bottom Left */}
                  <button 
                    style={{...styles.rotatingOption, bottom: '20px', left: '20px'}}
                    onClick={() => { setShowLogMealOptions(false); setShowMakeRecipePage(true); }}
                    className="rotating-option-item"
                  >
                    <span style={styles.rotatingOptionIcon}>👨‍🍳</span>
                    <span style={styles.rotatingOptionText}>Make</span>
                  </button>
                  
                  {/* Say Meal - Top Left */}
                  <button 
                    style={{...styles.rotatingOption, top: '50px', left: '-5px'}}
                    onClick={() => { setLogMealMethod('say'); setShowLogMealOptions(false); setShowLogMealModal(true); }}
                    className="rotating-option-item"
                  >
                    <span style={styles.rotatingOptionIcon}>🎤</span>
                    <span style={styles.rotatingOptionText}>Say</span>
                  </button>
                </div>
                
                {/* Center Icon */}
                <div style={styles.rotatingCenterIcon}>
                  <span style={styles.rotatingCenterEmoji}>🍽️</span>
                </div>
              </div>

              <p style={styles.rotatingHelpText}>Choose an option</p>
            </div>
          )}

          {/* Today's Nutrition */}
          <div style={styles.nutritionCardClean}>
            <h3 style={styles.nutritionTitleClean}>Today's Nutrition</h3>
            <div style={styles.nutritionStatsClean}>
              <div style={styles.nutritionStatClean}>
                <span style={styles.nutritionValueClean}>1,350</span>
                <span style={styles.nutritionLabelClean}>Calories</span>
              </div>
              <div style={styles.nutritionDividerClean}></div>
              <div style={styles.nutritionStatClean}>
                <span style={styles.nutritionValueClean}>85g</span>
                <span style={styles.nutritionLabelClean}>Protein</span>
              </div>
              <div style={styles.nutritionDividerClean}></div>
              <div style={styles.nutritionStatClean}>
                <span style={styles.nutritionValueClean}>120g</span>
                <span style={styles.nutritionLabelClean}>Carbs</span>
              </div>
              <div style={styles.nutritionDividerClean}></div>
              <div style={styles.nutritionStatClean}>
                <span style={styles.nutritionValueClean}>45g</span>
                <span style={styles.nutritionLabelClean}>Fats</span>
              </div>
            </div>
          </div>

          {/* Recent Meals */}
          <section style={styles.recentMealsSectionClean}>
            <h3 style={styles.recentMealsTitleClean}>Recent Meals</h3>
            <div style={styles.recentMealsListClean}>
              {recentMeals.map((meal) => (
                <div key={meal.id} style={styles.recentMealItemClean}>
                  <div style={styles.recentMealLeftClean}>
                    <div style={styles.recentMealIconClean}>🍽️</div>
                    <div style={styles.recentMealInfoClean}>
                      <span style={styles.recentMealNameClean}>{meal.name}</span>
                      <span style={styles.recentMealTimeClean}>{meal.time}</span>
                    </div>
                  </div>
                  <div style={styles.recentMealRightClean}>
                    <span style={styles.recentMealCaloriesClean}>{meal.calories} cal</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ height: '100px' }}></div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={styles.settingsContainer}>
          {/* Profile Section */}
          <div style={styles.settingsProfileCard}>
            <div style={styles.settingsProfileAvatar}>
              <span style={styles.settingsProfileInitial}>{userName.charAt(0)}</span>
            </div>
            <div style={styles.settingsProfileInfo}>
              <span style={styles.settingsProfileName}>{userName}</span>
              <span style={styles.settingsProfileEmail}>{userEmail}</span>
            </div>
            <button style={styles.settingsEditBtn} onClick={() => setShowEditProfile(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          {/* Fasting Preferences */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>🕐 Fasting Preferences</h3>
            
            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Fasting Schedule</span>
                <span style={styles.settingsItemDesc}>Your default fasting window</span>
              </div>
              <select 
                style={styles.settingsSelect}
                value={fastingSchedule}
                onChange={(e) => setFastingSchedule(e.target.value)}
              >
                <option value="12:12">12:12</option>
                <option value="14:10">14:10</option>
                <option value="16:8">16:8</option>
                <option value="18:6">18:6</option>
                <option value="20:4">20:4</option>
                <option value="OMAD">OMAD</option>
              </select>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Fasting Reminders</span>
                <span style={styles.settingsItemDesc}>Get reminded to start/end fast</span>
              </div>
              <button 
                style={fastingReminders ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setFastingReminders(!fastingReminders)}
              >
                <span style={fastingReminders ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>
          </section>

          {/* Nutrition Goals */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>🎯 Nutrition Goals</h3>
            
            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Daily Calories</span>
              </div>
              <div style={styles.settingsInputWrapper}>
                <input 
                  type="number" 
                  style={styles.settingsInput}
                  value={dailyCalorieGoal}
                  onChange={(e) => setDailyCalorieGoal(Number(e.target.value))}
                />
                <span style={styles.settingsInputUnit}>cal</span>
              </div>
            </div>

            <div style={styles.settingsMacroRow}>
              <div style={styles.settingsMacroItem}>
                <span style={styles.settingsMacroLabel}>Protein</span>
                <div style={styles.settingsMacroInputWrapper}>
                  <input 
                    type="number" 
                    style={styles.settingsMacroInput}
                    value={proteinGoal}
                    onChange={(e) => setProteinGoal(Number(e.target.value))}
                  />
                  <span style={styles.settingsMacroUnit}>g</span>
                </div>
              </div>
              <div style={styles.settingsMacroItem}>
                <span style={styles.settingsMacroLabel}>Carbs</span>
                <div style={styles.settingsMacroInputWrapper}>
                  <input 
                    type="number" 
                    style={styles.settingsMacroInput}
                    value={carbsGoal}
                    onChange={(e) => setCarbsGoal(Number(e.target.value))}
                  />
                  <span style={styles.settingsMacroUnit}>g</span>
                </div>
              </div>
              <div style={styles.settingsMacroItem}>
                <span style={styles.settingsMacroLabel}>Fats</span>
                <div style={styles.settingsMacroInputWrapper}>
                  <input 
                    type="number" 
                    style={styles.settingsMacroInput}
                    value={fatsGoal}
                    onChange={(e) => setFatsGoal(Number(e.target.value))}
                  />
                  <span style={styles.settingsMacroUnit}>g</span>
                </div>
              </div>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Daily Hydration</span>
              </div>
              <div style={styles.settingsInputWrapper}>
                <input 
                  type="number" 
                  style={styles.settingsInput}
                  value={hydrationGoal}
                  onChange={(e) => setHydrationGoal(Number(e.target.value))}
                />
                <span style={styles.settingsInputUnit}>{volumeUnit}</span>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>🔔 Notifications</h3>
            
            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Fast Start Reminder</span>
              </div>
              <button 
                style={notifyFastStart ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setNotifyFastStart(!notifyFastStart)}
              >
                <span style={notifyFastStart ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Fast End Reminder</span>
              </div>
              <button 
                style={notifyFastEnd ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setNotifyFastEnd(!notifyFastEnd)}
              >
                <span style={notifyFastEnd ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Meal Logging Reminder</span>
              </div>
              <button 
                style={notifyMealReminder ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setNotifyMealReminder(!notifyMealReminder)}
              >
                <span style={notifyMealReminder ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Progress Milestones</span>
              </div>
              <button 
                style={notifyMilestones ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setNotifyMilestones(!notifyMilestones)}
              >
                <span style={notifyMilestones ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>
          </section>

          {/* App Settings */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>⚙️ App Settings</h3>
            
            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Dark Mode</span>
              </div>
              <button 
                style={darkMode ? styles.settingsToggleOn : styles.settingsToggleOff}
                onClick={() => setDarkMode(!darkMode)}
              >
                <span style={darkMode ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff}></span>
              </button>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Weight Unit</span>
              </div>
              <div style={styles.settingsSegmentedControl}>
                <button 
                  style={weightUnit === 'kg' ? styles.settingsSegmentActive : styles.settingsSegment}
                  onClick={() => setWeightUnit('kg')}
                >
                  kg
                </button>
                <button 
                  style={weightUnit === 'lbs' ? styles.settingsSegmentActive : styles.settingsSegment}
                  onClick={() => setWeightUnit('lbs')}
                >
                  lbs
                </button>
              </div>
            </div>

            <div style={styles.settingsItem}>
              <div style={styles.settingsItemLeft}>
                <span style={styles.settingsItemLabel}>Volume Unit</span>
              </div>
              <div style={styles.settingsSegmentedControl}>
                <button 
                  style={volumeUnit === 'oz' ? styles.settingsSegmentActive : styles.settingsSegment}
                  onClick={() => setVolumeUnit('oz')}
                >
                  oz
                </button>
                <button 
                  style={volumeUnit === 'ml' ? styles.settingsSegmentActive : styles.settingsSegment}
                  onClick={() => setVolumeUnit('ml')}
                >
                  ml
                </button>
              </div>
            </div>
          </section>

          {/* Data & Privacy */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>🔒 Data & Privacy</h3>
            
            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>📤</span>
                <span style={styles.settingsActionLabel}>Export My Data</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>🗑️</span>
                <span style={styles.settingsActionLabel}>Clear History</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>🛡️</span>
                <span style={styles.settingsActionLabel}>Privacy Settings</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </section>

          {/* Support */}
          <section style={styles.settingsSection}>
            <h3 style={styles.settingsSectionTitle}>💬 Support</h3>
            
            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>❓</span>
                <span style={styles.settingsActionLabel}>Help & FAQ</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>✉️</span>
                <span style={styles.settingsActionLabel}>Contact Support</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <button style={styles.settingsActionItem}>
              <div style={styles.settingsActionLeft}>
                <span style={styles.settingsActionIcon}>⭐</span>
                <span style={styles.settingsActionLabel}>Rate the App</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </section>

          {/* App Version */}
          <div style={styles.settingsVersion}>
            <span style={styles.settingsVersionText}>FastTrack v1.0.0</span>
            <span style={styles.settingsVersionSub}>Made with 💜</span>
          </div>

          <div style={{ height: '100px' }}></div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div style={styles.editProfileOverlay}>
          <div style={styles.editProfileCard}>
            <div style={styles.editProfileHeader}>
              <h3 style={styles.editProfileTitle}>Edit Profile</h3>
              <button style={styles.editProfileClose} onClick={() => setShowEditProfile(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div style={styles.editProfileAvatarSection}>
              <div style={styles.editProfileAvatar}>
                <span style={styles.editProfileAvatarInitial}>{userName.charAt(0)}</span>
              </div>
              <button style={styles.editProfileAvatarBtn}>Change Photo</button>
            </div>

            <div style={styles.editProfileForm}>
              <div style={styles.editProfileField}>
                <label style={styles.editProfileLabel}>Name</label>
                <input 
                  type="text"
                  style={styles.editProfileInput}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div style={styles.editProfileField}>
                <label style={styles.editProfileLabel}>Email</label>
                <input 
                  type="email"
                  style={styles.editProfileInput}
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                />
              </div>
            </div>

            <button style={styles.editProfileSaveBtn} onClick={() => setShowEditProfile(false)}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Make Recipe Page */}
      {showMakeRecipePage && (
        <div style={styles.recipePageOverlay}>
          <div style={styles.recipePage}>
            {/* Header */}
            <div style={styles.recipePageHeader}>
              <button style={styles.recipeBackBtn} onClick={() => setShowMakeRecipePage(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.recipePageTitle}>Make a Recipe</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.recipePageContent}>
              {/* Input Options */}
              <div style={styles.makeRecipeOptions}>
                <button style={styles.makeRecipeOptionBtn} onClick={() => { setMakeRecipeMethod('photo'); setShowMakeRecipeModal(true); }}>
                  <span style={styles.makeRecipeOptionIcon}>📸</span>
                  <div style={styles.makeRecipeOptionText}>
                    <span style={styles.makeRecipeOptionTitle}>Take a Picture</span>
                    <span style={styles.makeRecipeOptionDesc}>Snap your fridge or pantry</span>
                  </div>
                </button>
                <button style={styles.makeRecipeOptionBtn} onClick={() => { setMakeRecipeMethod('list'); setShowMakeRecipeModal(true); }}>
                  <span style={styles.makeRecipeOptionIcon}>📝</span>
                  <div style={styles.makeRecipeOptionText}>
                    <span style={styles.makeRecipeOptionTitle}>List Ingredients</span>
                    <span style={styles.makeRecipeOptionDesc}>Type or say what you have</span>
                  </div>
                </button>
              </div>

              {/* Suggested Recipes Based on Common Ingredients */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>🍳 Quick Ideas</h3>
                <div style={styles.quickIdeasList}>
                  {[
                    { name: 'Classic French Omelette', emoji: '🍳', time: '15 min', ingredients: 'Eggs, butter, herbs' },
                    { name: 'Grilled Cheese Sandwich', emoji: '🥪', time: '10 min', ingredients: 'Bread, cheese, butter' },
                    { name: 'Pasta Aglio e Olio', emoji: '🍝', time: '20 min', ingredients: 'Pasta, garlic, olive oil' },
                  ].map((item, index) => (
                    <div key={index} style={styles.quickIdeaItem}>
                      <span style={styles.quickIdeaEmoji}>{item.emoji}</span>
                      <div style={styles.quickIdeaInfo}>
                        <span style={styles.quickIdeaName}>{item.name}</span>
                        <span style={styles.quickIdeaIngredients}>{item.ingredients}</span>
                      </div>
                      <span style={styles.quickIdeaTime}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Fasting-Friendly */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>🕐 Fasting-Friendly</h3>
                <p style={styles.recipeSectionSubtitle}>Perfect for breaking your fast</p>
                <div style={styles.quickIdeasList}>
                  {[
                    { name: 'Bone Broth Soup', emoji: '🍲', time: '20 min', benefit: 'Gentle on stomach' },
                    { name: 'Egg & Veggie Scramble', emoji: '🍳', time: '10 min', benefit: 'Protein-rich' },
                    { name: 'Smoothie Bowl', emoji: '🫐', time: '5 min', benefit: 'Easy to digest' },
                  ].map((item, index) => (
                    <div key={index} style={styles.quickIdeaItem}>
                      <span style={styles.quickIdeaEmoji}>{item.emoji}</span>
                      <div style={styles.quickIdeaInfo}>
                        <span style={styles.quickIdeaName}>{item.name}</span>
                        <span style={styles.quickIdeaBenefit}>{item.benefit}</span>
                      </div>
                      <span style={styles.quickIdeaTime}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chef's Tips */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>👨‍🍳 Chef's Tips</h3>
                <div style={styles.tipsList}>
                  {[
                    { tip: 'Add lemon juice to avocados to prevent browning', icon: '🍋' },
                    { tip: 'Let meat rest 5 min after cooking for juicier results', icon: '🥩' },
                    { tip: 'Salt pasta water like the sea for best flavor', icon: '🧂' },
                  ].map((item, index) => (
                    <div key={index} style={styles.tipItem}>
                      <span style={styles.tipIcon}>{item.icon}</span>
                      <span style={styles.tipText}>{item.tip}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Find Recipe Page */}
      {showFindRecipePage && (
        <div style={styles.recipePageOverlay}>
          <div style={styles.recipePage}>
            {/* Header */}
            <div style={styles.recipePageHeader}>
              <button style={styles.recipeBackBtn} onClick={() => setShowFindRecipePage(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.recipePageTitle}>Find a Recipe</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.recipePageContent}>
              {/* Search Bar */}
              <div style={styles.recipeSearchBarContainer}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  style={styles.recipeSearchInputNew}
                  placeholder="Search recipes..."
                  value={recipeSearchInput}
                  onChange={(e) => setRecipeSearchInput(e.target.value)}
                />
              </div>

              {/* Cuisine Filters */}
              <div style={styles.cuisineFiltersSection}>
                <div style={styles.cuisineFiltersScroll}>
                  {['All', '🇮🇹 Italian', '🇲🇽 Mexican', '🇯🇵 Japanese', '🇮🇳 Indian', '🇨🇳 Chinese', '🇺🇸 American'].map((cuisine) => (
                    <button 
                      key={cuisine}
                      style={selectedCuisine === cuisine ? styles.cuisineFilterActive : styles.cuisineFilter}
                      onClick={() => setSelectedCuisine(cuisine)}
                    >
                      {cuisine}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending Recipes */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>🔥 Trending Now</h3>
                <div style={styles.trendingList}>
                  {[
                    { rank: 1, name: 'High-Protein Meal Prep', emoji: '🥗', saves: '12.4k', time: '30 min' },
                    { rank: 2, name: 'Salmon Teriyaki Bowl', emoji: '🍣', saves: '9.8k', time: '25 min' },
                    { rank: 3, name: 'Avocado Toast Deluxe', emoji: '🥑', saves: '8.2k', time: '10 min' },
                    { rank: 4, name: 'Greek Chicken Salad', emoji: '🥗', saves: '7.5k', time: '20 min' },
                    { rank: 5, name: 'Overnight Oats', emoji: '🫐', saves: '6.9k', time: '5 min' },
                  ].map((item) => (
                    <div key={item.rank} style={styles.trendingItem}>
                      <span style={styles.trendingRank}>#{item.rank}</span>
                      <span style={styles.trendingEmoji}>{item.emoji}</span>
                      <div style={styles.trendingInfo}>
                        <span style={styles.trendingName}>{item.name}</span>
                        <span style={styles.trendingMeta}>⏱️ {item.time} • ❤️ {item.saves}</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  ))}
                </div>
              </section>

              {/* This Week's Picks */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>⭐ This Week's Picks</h3>
                <div style={styles.featuredCardsScroll}>
                  {[
                    { name: 'Salmon Teriyaki Bowl', emoji: '🍣', time: '25 min', calories: 520, tag: 'High Protein' },
                    { name: 'Avocado Toast Deluxe', emoji: '🥑', time: '10 min', calories: 380, tag: 'Quick & Easy' },
                    { name: 'Greek Salad', emoji: '🥗', time: '15 min', calories: 320, tag: 'Low Carb' },
                  ].map((item, index) => (
                    <div key={index} style={styles.featuredCard}>
                      <div style={styles.featuredCardEmoji}>{item.emoji}</div>
                      <span style={styles.featuredCardTag}>{item.tag}</span>
                      <h4 style={styles.featuredCardName}>{item.name}</h4>
                      <div style={styles.featuredCardMeta}>
                        <span>⏱️ {item.time}</span>
                        <span>🔥 {item.calories} cal</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Popular Categories */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>🏷️ Popular Categories</h3>
                <div style={styles.categoryGrid}>
                  {[
                    { name: 'Breakfast', emoji: '🍳', count: 48 },
                    { name: 'Lunch', emoji: '🥪', count: 65 },
                    { name: 'Dinner', emoji: '🍝', count: 82 },
                    { name: 'Snacks', emoji: '🥜', count: 34 },
                    { name: 'Smoothies', emoji: '🥤', count: 28 },
                    { name: 'Desserts', emoji: '🍰', count: 22 },
                  ].map((cat, index) => (
                    <button key={index} style={styles.categoryItem}>
                      <span style={styles.categoryEmoji}>{cat.emoji}</span>
                      <span style={styles.categoryName}>{cat.name}</span>
                      <span style={styles.categoryCount}>{cat.count} recipes</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Saved Recipes */}
              <section style={styles.recipeSection}>
                <h3 style={styles.recipeSectionTitle}>💾 Saved Recipes</h3>
                <div style={styles.savedRecipesList}>
                  {savedRecipes.map((recipe) => (
                    <div key={recipe.id} style={styles.savedRecipeCard}>
                      <div style={styles.savedRecipeImage}>{recipe.image}</div>
                      <div style={styles.savedRecipeInfo}>
                        <span style={styles.savedRecipeName}>{recipe.name}</span>
                        <div style={styles.savedRecipeMeta}>
                          <span style={styles.savedRecipeTime}>⏱️ {recipe.time}</span>
                          <span style={styles.savedRecipeCalories}>🔥 {recipe.calories} cal</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div style={{ height: '40px' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Log Meal Modal */}
      {showLogMealModal && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => { setShowLogMealModal(false); setLogMealMethod(null); setDetectedFoods([]); setMealInput(''); setVoiceTranscript(''); setIsRecording(false); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>
                {logMealMethod === 'scan' ? '📸 Scan Meal' : logMealMethod === 'write' ? '✍️ Write Meal' : '🎤 Say Meal'}
              </h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              {/* Scan Method */}
              {logMealMethod === 'scan' && (
                <div style={styles.logMealContent}>
                  <div style={styles.cameraPlaceholder}>
                    <div style={styles.cameraIcon}>📸</div>
                    <p style={styles.cameraText}>Tap to take a photo of your meal</p>
                    <button style={styles.cameraBtn} onClick={() => {
                      setIsProcessing(true);
                      setTimeout(() => {
                        setDetectedFoods([
                          { name: 'Grilled Chicken', portion: '150g', calories: 250 },
                          { name: 'Brown Rice', portion: '1 cup', calories: 215 },
                          { name: 'Steamed Broccoli', portion: '100g', calories: 35 },
                        ]);
                        setIsProcessing(false);
                      }, 2000);
                    }}>
                      {isProcessing ? 'Analyzing...' : 'Take Photo'}
                    </button>
                  </div>
                </div>
              )}

              {/* Write Method */}
              {logMealMethod === 'write' && (
                <div style={styles.logMealContent}>
                  <div style={styles.mealInputContainer}>
                    <label style={styles.mealInputLabel}>What did you eat?</label>
                    <textarea
                      style={styles.mealTextarea}
                      placeholder="e.g., grilled chicken, brown rice, broccoli..."
                      value={mealInput}
                      onChange={(e) => setMealInput(e.target.value)}
                    />
                    <button style={styles.analyzeMealBtn} onClick={() => {
                      if (!mealInput) return;
                      setIsProcessing(true);
                      setTimeout(() => {
                        setDetectedFoods([
                          { name: 'Grilled Chicken', portion: '150g', calories: 250 },
                          { name: 'Brown Rice', portion: '1 cup', calories: 215 },
                          { name: 'Broccoli', portion: '100g', calories: 35 },
                        ]);
                        setIsProcessing(false);
                      }, 1500);
                    }}>
                      {isProcessing ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                  </div>
                </div>
              )}

              {/* Say Method */}
              {logMealMethod === 'say' && (
                <div style={styles.logMealContent}>
                  <div style={styles.voiceInputContainerNew}>
                    {/* Real-time transcription display */}
                    <div style={styles.transcriptionBox}>
                      {voiceTranscript ? (
                        <p style={styles.transcriptionText}>{voiceTranscript}</p>
                      ) : (
                        <p style={styles.transcriptionPlaceholder}>
                          {isRecording ? 'Listening...' : 'Your words will appear here'}
                        </p>
                      )}
                      {isRecording && (
                        <div style={styles.recordingWaves}>
                          <span style={{...styles.recordingWave, animationDelay: '0s'}}></span>
                          <span style={{...styles.recordingWave, animationDelay: '0.1s'}}></span>
                          <span style={{...styles.recordingWave, animationDelay: '0.2s'}}></span>
                          <span style={{...styles.recordingWave, animationDelay: '0.3s'}}></span>
                          <span style={{...styles.recordingWave, animationDelay: '0.4s'}}></span>
                        </div>
                      )}
                    </div>

                    {/* Microphone Button */}
                    <div style={styles.microphoneSection}>
                      <button 
                        style={{
                          ...styles.microphoneButtonNew,
                          background: isRecording 
                            ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' 
                            : 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
                          transform: isRecording ? 'scale(1.1)' : 'scale(1)',
                        }}
                        onMouseDown={() => {
                          setIsRecording(true);
                          setVoiceTranscript('');
                          // Simulate real-time transcription
                          const words = ['I', 'had', 'grilled', 'chicken', 'with', 'brown', 'rice', 'and', 'steamed', 'broccoli'];
                          let index = 0;
                          const interval = setInterval(() => {
                            if (index < words.length) {
                              setVoiceTranscript(prev => prev + (prev ? ' ' : '') + words[index]);
                              index++;
                            }
                          }, 300);
                          window.voiceInterval = interval;
                        }}
                        onMouseUp={() => {
                          setIsRecording(false);
                          clearInterval(window.voiceInterval);
                          if (voiceTranscript) {
                            setIsProcessing(true);
                            setTimeout(() => {
                              setDetectedFoods([
                                { name: 'Grilled Chicken', portion: '150g', calories: 250 },
                                { name: 'Brown Rice', portion: '1 cup', calories: 215 },
                                { name: 'Steamed Broccoli', portion: '100g', calories: 35 },
                              ]);
                              setIsProcessing(false);
                            }, 1500);
                          }
                        }}
                        onMouseLeave={() => {
                          if (isRecording) {
                            setIsRecording(false);
                            clearInterval(window.voiceInterval);
                          }
                        }}
                        onTouchStart={() => {
                          setIsRecording(true);
                          setVoiceTranscript('');
                          const words = ['I', 'had', 'grilled', 'chicken', 'with', 'brown', 'rice', 'and', 'steamed', 'broccoli'];
                          let index = 0;
                          const interval = setInterval(() => {
                            if (index < words.length) {
                              setVoiceTranscript(prev => prev + (prev ? ' ' : '') + words[index]);
                              index++;
                            }
                          }, 300);
                          window.voiceInterval = interval;
                        }}
                        onTouchEnd={() => {
                          setIsRecording(false);
                          clearInterval(window.voiceInterval);
                          if (voiceTranscript) {
                            setIsProcessing(true);
                            setTimeout(() => {
                              setDetectedFoods([
                                { name: 'Grilled Chicken', portion: '150g', calories: 250 },
                                { name: 'Brown Rice', portion: '1 cup', calories: 215 },
                                { name: 'Steamed Broccoli', portion: '100g', calories: 35 },
                              ]);
                              setIsProcessing(false);
                            }, 1500);
                          }
                        }}
                      >
                        {/* Studio Microphone SVG */}
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                          <rect x="9" y="2" width="6" height="12" rx="3" />
                          <path d="M5 10a7 7 0 0 0 14 0" />
                          <line x1="12" y1="17" x2="12" y2="22" />
                          <line x1="8" y1="22" x2="16" y2="22" />
                        </svg>
                      </button>
                      <p style={styles.microphoneHint}>
                        {isRecording ? '🔴 Recording... Release to stop' : 'Hold to record'}
                      </p>
                    </div>

                    {/* Processing indicator */}
                    {isProcessing && (
                      <div style={styles.processingIndicator}>
                        <span style={styles.processingSpinner}></span>
                        <span style={styles.processingText}>Detecting foods...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Detected Foods */}
              {detectedFoods.length > 0 && (
                <div style={styles.detectedFoodsSection}>
                  <h3 style={styles.detectedFoodsTitle}>Detected Foods</h3>
                  <div style={styles.detectedFoodsList}>
                    {detectedFoods.map((food, index) => (
                      <div key={index} style={styles.detectedFoodItem}>
                        <div style={styles.detectedFoodInfo}>
                          <span style={styles.detectedFoodName}>{food.name}</span>
                          <span style={styles.detectedFoodPortion}>{food.portion}</span>
                        </div>
                        <span style={styles.detectedFoodCalories}>{food.calories} cal</span>
                      </div>
                    ))}
                  </div>
                  <div style={styles.detectedFoodsTotal}>
                    <span>Total Calories</span>
                    <span style={styles.detectedFoodsTotalValue}>
                      {detectedFoods.reduce((sum, food) => sum + food.calories, 0)} cal
                    </span>
                  </div>
                  <button style={styles.saveMealBtn} onClick={() => {
                    const newMeal = {
                      id: Date.now(),
                      name: detectedFoods.map(f => f.name).join(', ').substring(0, 30) + '...',
                      calories: detectedFoods.reduce((sum, food) => sum + food.calories, 0),
                      time: 'Just now',
                      items: detectedFoods.map(f => f.name),
                    };
                    setRecentMeals([newMeal, ...recentMeals]);
                    setShowLogMealModal(false);
                    setLogMealMethod(null);
                    setDetectedFoods([]);
                    setMealInput('');
                  }}>
                    Save Meal
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Make Recipe Modal */}
      {showMakeRecipeModal && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => { setShowMakeRecipeModal(false); setMakeRecipeMethod(null); setIngredientInput(''); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>
                {makeRecipeMethod === 'photo' ? '📸 Scan Ingredients' : '📝 List Ingredients'}
              </h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              {/* Photo Method */}
              {makeRecipeMethod === 'photo' && (
                <div style={styles.logMealContent}>
                  <div style={styles.cameraPlaceholder}>
                    <div style={styles.cameraIcon}>🍳</div>
                    <p style={styles.cameraText}>Take a photo of your fridge, pantry, or ingredients</p>
                    <button style={styles.cameraBtn}>Take Photo</button>
                  </div>
                  <div style={styles.generatedRecipes}>
                    <h3 style={styles.generatedRecipesTitle}>AI will suggest recipes based on what you have!</h3>
                  </div>
                </div>
              )}

              {/* List Method */}
              {makeRecipeMethod === 'list' && (
                <div style={styles.logMealContent}>
                  <div style={styles.mealInputContainer}>
                    <label style={styles.mealInputLabel}>What ingredients do you have?</label>
                    <textarea
                      style={styles.mealTextarea}
                      placeholder="e.g., eggs, milk, bread, cheese, tomatoes..."
                      value={ingredientInput}
                      onChange={(e) => setIngredientInput(e.target.value)}
                    />
                    <div style={styles.voiceInputRow}>
                      <button style={styles.voiceMiniBtn}>🎤 Say it</button>
                    </div>
                    <button style={styles.analyzeMealBtn}>Generate Recipes</button>
                  </div>
                  <div style={styles.suggestedRecipes}>
                    <h3 style={styles.suggestedRecipesTitle}>Suggested Recipes</h3>
                    <div style={styles.suggestedRecipesList}>
                      <div style={styles.suggestedRecipeItem}>
                        <span style={styles.suggestedRecipeEmoji}>🍳</span>
                        <div style={styles.suggestedRecipeInfo}>
                          <span style={styles.suggestedRecipeName}>Classic French Omelette</span>
                          <span style={styles.suggestedRecipeMeta}>15 min • 320 cal</span>
                        </div>
                      </div>
                      <div style={styles.suggestedRecipeItem}>
                        <span style={styles.suggestedRecipeEmoji}>🥪</span>
                        <div style={styles.suggestedRecipeInfo}>
                          <span style={styles.suggestedRecipeName}>Grilled Cheese Sandwich</span>
                          <span style={styles.suggestedRecipeMeta}>10 min • 450 cal</span>
                        </div>
                      </div>
                      <div style={styles.suggestedRecipeItem}>
                        <span style={styles.suggestedRecipeEmoji}>🥗</span>
                        <div style={styles.suggestedRecipeInfo}>
                          <span style={styles.suggestedRecipeName}>Caprese Salad</span>
                          <span style={styles.suggestedRecipeMeta}>5 min • 280 cal</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Find Recipe Modal */}
      {showFindRecipeModal && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => { setShowFindRecipeModal(false); setRecipeSearchInput(''); }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>🔍 Find Recipe</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              <div style={styles.recipeSearchContainer}>
                <div style={styles.recipeSearchBar}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    style={styles.recipeSearchInput}
                    placeholder="Search recipes or say what you want..."
                    value={recipeSearchInput}
                    onChange={(e) => setRecipeSearchInput(e.target.value)}
                  />
                  <button style={styles.voiceSearchBtn}>🎤</button>
                </div>

                <div style={styles.cuisineFiltersLarge}>
                  <h4 style={styles.cuisineFiltersTitle}>Filter by cuisine</h4>
                  <div style={styles.cuisineFiltersGrid}>
                    {[
                      { name: 'Italian', emoji: '🇮🇹' },
                      { name: 'Mexican', emoji: '🇲🇽' },
                      { name: 'Japanese', emoji: '🇯🇵' },
                      { name: 'Indian', emoji: '🇮🇳' },
                      { name: 'Chinese', emoji: '🇨🇳' },
                      { name: 'Thai', emoji: '🇹🇭' },
                      { name: 'Mediterranean', emoji: '🫒' },
                      { name: 'American', emoji: '🇺🇸' },
                    ].map((cuisine) => (
                      <button key={cuisine.name} style={styles.cuisineGridItem}>
                        <span style={styles.cuisineGridEmoji}>{cuisine.emoji}</span>
                        <span style={styles.cuisineGridName}>{cuisine.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.popularRecipes}>
                  <h4 style={styles.popularRecipesTitle}>Popular Recipes</h4>
                  <div style={styles.popularRecipesList}>
                    {[
                      { name: 'Spaghetti Carbonara', emoji: '🍝', time: '25 min', calories: 580 },
                      { name: 'Chicken Tikka Masala', emoji: '🍛', time: '40 min', calories: 490 },
                      { name: 'Sushi Rolls', emoji: '🍣', time: '45 min', calories: 320 },
                      { name: 'Tacos al Pastor', emoji: '🌮', time: '30 min', calories: 420 },
                    ].map((recipe, index) => (
                      <div key={index} style={styles.popularRecipeItem}>
                        <span style={styles.popularRecipeEmoji}>{recipe.emoji}</span>
                        <div style={styles.popularRecipeInfo}>
                          <span style={styles.popularRecipeName}>{recipe.name}</span>
                          <span style={styles.popularRecipeMeta}>⏱️ {recipe.time} • 🔥 {recipe.calories} cal</span>
                        </div>
                        <button style={styles.popularRecipeBtn}>View</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hydration Details Page */}
      {showHydrationDetails && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            {/* Header */}
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => setShowHydrationDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>Hydration Log</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              {/* Compact Water Input Section */}
              <div style={styles.weightInputCompact}>
                {/* Smaller Dash Circle Display - Water themed */}
                <div style={styles.weightDashContainerSmall}>
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    {/* Background dashes */}
                    {[...Array(36)].map((_, i) => {
                      const angle = (i * 10 - 135) * (Math.PI / 180);
                      const x1 = 80 + 62 * Math.cos(angle);
                      const y1 = 80 + 62 * Math.sin(angle);
                      const x2 = 80 + 70 * Math.cos(angle);
                      const y2 = 80 + 70 * Math.sin(angle);
                      return (
                        <line
                          key={i}
                          x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke={i < 27 ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.08)'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {/* Active dashes based on water intake */}
                    {[...Array(Math.min(27, Math.floor((parseFloat(newWaterIntake) || 64) / 4)))].map((_, i) => {
                      const angle = (i * 10 - 135) * (Math.PI / 180);
                      const x1 = 80 + 62 * Math.cos(angle);
                      const y1 = 80 + 62 * Math.sin(angle);
                      const x2 = 80 + 70 * Math.cos(angle);
                      const y2 = 80 + 70 * Math.sin(angle);
                      return (
                        <line
                          key={`active-${i}`}
                          x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke="url(#waterDashGradient)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <defs>
                      <linearGradient id="waterDashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0EA5E9" />
                        <stop offset="100%" stopColor="#38BDF8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={styles.weightDashCenterSmall}>
                    <input
                      type="number"
                      placeholder={waterUnit === 'oz' ? '64' : '1900'}
                      value={newWaterIntake}
                      onChange={(e) => setNewWaterIntake(e.target.value)}
                      style={{...styles.weightInputMedium, color: '#0EA5E9'}}
                    />
                    <button style={{...styles.unitDropdownSmall, background: 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.15)'}} onClick={() => setWaterUnit(waterUnit === 'oz' ? 'ml' : 'oz')}>
                      <span style={{...styles.unitDropdownTextSmall, color: '#0EA5E9'}}>{waterUnit}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2.5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <button style={{...styles.saveWeightBtnCompact, background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)', boxShadow: '0 6px 20px rgba(14, 165, 233, 0.25)'}} onClick={saveWaterIntake}>
                  <span style={styles.saveWeightBtnTextSmall}>Log Water</span>
                </button>
              </div>

              {/* Hydration Statistics */}
              <div style={styles.weightStatsSection}>
                <div style={styles.weightStatsHeader}>
                  <h3 style={styles.weightStatsSectionTitle}>Hydration Statistics</h3>
                  <div style={styles.weightStatsDropdownContainer}>
                    <button 
                      style={{...styles.weightStatsDropdownBtn, color: '#0EA5E9', background: 'rgba(14, 165, 233, 0.08)', borderColor: 'rgba(14, 165, 233, 0.15)'}}
                      onClick={() => setShowHydrationStatsDropdown(!showHydrationStatsDropdown)}
                    >
                      <span>{hydrationStatsRange}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {showHydrationStatsDropdown && (
                      <div style={styles.weightStatsDropdownMenu}>
                        {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                          <button
                            key={range}
                            style={{
                              ...styles.weightStatsDropdownItem,
                              ...(hydrationStatsRange === range ? {...styles.weightStatsDropdownItemActive, background: 'rgba(14, 165, 233, 0.08)', color: '#0EA5E9'} : {})
                            }}
                            onClick={() => {
                              setHydrationStatsRange(range);
                              setShowHydrationStatsDropdown(false);
                            }}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={styles.weightStatsGrid}>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>💧</span>
                    <span style={styles.weightStatCardValue}>
                      {hydrationStatsRange === '7 days' ? '64 oz' : hydrationStatsRange === '30 days' ? '62 oz' : hydrationStatsRange === '90 days' ? '60 oz' : '58 oz'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Avg daily</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>🎯</span>
                    <span style={styles.weightStatCardValue}>
                      {hydrationStatsRange === '7 days' ? '5/7' : hydrationStatsRange === '30 days' ? '18/30' : hydrationStatsRange === '90 days' ? '52/90' : '150/180'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Goal met</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>📈</span>
                    <span style={styles.weightStatCardValue}>
                      {hydrationStatsRange === '7 days' ? '80 oz' : hydrationStatsRange === '30 days' ? '96 oz' : hydrationStatsRange === '90 days' ? '104 oz' : '112 oz'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Best day</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>📊</span>
                    <span style={styles.weightStatCardValue}>
                      {hydrationStatsRange === '7 days' ? '448 oz' : hydrationStatsRange === '30 days' ? '1,860 oz' : hydrationStatsRange === '90 days' ? '5,400 oz' : '10,440 oz'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Total</span>
                  </div>
                </div>
                <div style={styles.weightStatsMini}>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Streak</span>
                    <span style={styles.weightStatMiniValue}>
                      {hydrationStatsRange === '7 days' ? '3 days' : hydrationStatsRange === '30 days' ? '5 days' : '7 days'}
                    </span>
                  </div>
                  <div style={styles.weightStatMiniDivider}></div>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Lowest</span>
                    <span style={styles.weightStatMiniValue}>
                      {hydrationStatsRange === '7 days' ? '48 oz' : hydrationStatsRange === '30 days' ? '32 oz' : '24 oz'}
                    </span>
                  </div>
                  <div style={styles.weightStatMiniDivider}></div>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Entries</span>
                    <span style={styles.weightStatMiniValue}>{waterLogs.length}</span>
                  </div>
                </div>
              </div>

              {/* Past Water Logs - Last 10 */}
              <div style={styles.pastLogsCompact}>
                <div style={styles.pastLogsHeaderRow}>
                  <h3 style={styles.pastLogsTitleCompact}>Past Logs</h3>
                  <button style={{...styles.exportBtn, color: '#0EA5E9', background: 'rgba(14, 165, 233, 0.08)'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>Export</span>
                  </button>
                </div>
                <div style={styles.logsListCompact}>
                  {waterLogs.slice(0, 10).map((log, index) => {
                    const displayAmount = waterUnit === log.unit 
                      ? log.amount 
                      : convertWaterUnit(log.amount, log.unit, waterUnit);
                    const goalMet = log.amount >= 72;
                    
                    return (
                      <div key={index} style={styles.logItemCompact}>
                        <div style={styles.logItemLeftCompact}>
                          <div style={{...styles.logDateBadgeSmall, background: goalMet ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)' : 'rgba(0, 0, 0, 0.04)'}}>
                            <span style={{...styles.logDateDaySmall, color: goalMet ? '#0EA5E9' : '#888'}}>{log.date.split(',')[0]}</span>
                          </div>
                          <div style={styles.logItemInfoCompact}>
                            <span style={{...styles.logWeightCompact, color: goalMet ? '#0EA5E9' : '#1F1F1F'}}>{displayAmount} {waterUnit}</span>
                            <span style={styles.logDateCompact}>{log.date}</span>
                          </div>
                        </div>
                        <div style={styles.logItemRightCompact}>
                          <span style={{
                            ...styles.logDiffSmall,
                            color: goalMet ? '#10B981' : '#F59E0B',
                            background: goalMet ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          }}>
                            {goalMet ? '✓ Goal' : `${Math.round((log.amount / 72) * 100)}%`}
                          </span>
                          <button style={{...styles.logDeleteBtnSmall, background: 'rgba(239, 68, 68, 0.06)'}} onClick={() => deleteWaterLog(index)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calorie Details Page */}
      {showCalorieDetails && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            {/* Header */}
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => setShowCalorieDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>Calorie Details</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            {/* Time Range Filter */}
            <div style={styles.detailsTimeRange}>
              {['7 days', '30 days', '90 days', 'All time'].map((range) => (
                <button
                  key={range}
                  style={{
                    ...styles.detailsTimeBtn,
                    ...(calorieRange === range ? styles.detailsTimeBtnActive : {})
                  }}
                  onClick={() => setCalorieRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            <div style={styles.weightPageContent}>
              {/* Calorie Statistics - Compact 4 in a row */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Calorie Statistics</h3>
                <div style={styles.calorieStatsGridCompact}>
                  <div style={styles.calorieStatCardCompact}>
                    <span style={styles.calorieStatCardIconSmall}>🔥</span>
                    <span style={styles.calorieStatCardValueSmall}>
                      {calorieRange === '7 days' ? '1,850' : calorieRange === '30 days' ? '1,920' : calorieRange === '90 days' ? '1,880' : '1,900'}
                    </span>
                    <span style={styles.calorieStatCardLabelSmall}>Avg daily</span>
                  </div>
                  <div style={styles.calorieStatCardCompact}>
                    <span style={styles.calorieStatCardIconSmall}>📊</span>
                    <span style={styles.calorieStatCardValueSmall}>
                      {calorieRange === '7 days' ? '12.9k' : calorieRange === '30 days' ? '57.6k' : calorieRange === '90 days' ? '169k' : '365k'}
                    </span>
                    <span style={styles.calorieStatCardLabelSmall}>Total cal</span>
                  </div>
                  <div style={styles.calorieStatCardCompact}>
                    <span style={styles.calorieStatCardIconSmall}>📈</span>
                    <span style={styles.calorieStatCardValueSmall}>
                      {calorieRange === '7 days' ? '2,400' : calorieRange === '30 days' ? '2,650' : calorieRange === '90 days' ? '2,800' : '3,100'}
                    </span>
                    <span style={styles.calorieStatCardLabelSmall}>Highest</span>
                  </div>
                  <div style={styles.calorieStatCardCompact}>
                    <span style={styles.calorieStatCardIconSmall}>📉</span>
                    <span style={styles.calorieStatCardValueSmall}>
                      {calorieRange === '7 days' ? '1,450' : calorieRange === '30 days' ? '1,200' : calorieRange === '90 days' ? '1,100' : '950'}
                    </span>
                    <span style={styles.calorieStatCardLabelSmall}>Lowest</span>
                  </div>
                </div>
              </div>

              {/* Protein Intake Trend */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>🥩 Protein Intake</h3>
                <div style={styles.macroCardCompact}>
                  <div style={styles.macroChartContainerSmall}>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <style>
                        {`
                          @keyframes drawMacroLine {
                            from { stroke-dashoffset: 400; }
                            to { stroke-dashoffset: 0; }
                          }
                          .macro-line {
                            stroke-dasharray: 400;
                            animation: drawMacroLine 1.5s ease-out forwards;
                          }
                        `}
                      </style>
                      <defs>
                        <linearGradient id="proteinFillDetail" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,40 C30,38 50,30 75,32 C100,34 120,42 150,35 C180,28 200,22 225,25 C250,28 275,32 300,28 L300,60 L0,60 Z"
                        fill="url(#proteinFillDetail)"
                      />
                      <path
                        className="macro-line"
                        d="M0,40 C30,38 50,30 75,32 C100,34 120,42 150,35 C180,28 200,22 225,25 C250,28 275,32 300,28"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.macroStatsRowCompact}>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '125g' : calorieRange === '30 days' ? '132g' : '128g'}</span>
                      <span style={styles.macroStatLabelSmall}>Avg daily</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '27%' : calorieRange === '30 days' ? '28%' : '27%'}</span>
                      <span style={styles.macroStatLabelSmall}>Of total</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={{...styles.macroStatValueSmall, color: '#10B981'}}>+5%</span>
                      <span style={styles.macroStatLabelSmall}>vs prior</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Carbs Intake Trend */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>🍞 Carbohydrate Intake</h3>
                <div style={styles.macroCardCompact}>
                  <div style={styles.macroChartContainerSmall}>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="carbsFillDetail" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,35 C30,32 50,25 75,28 C100,31 120,38 150,30 C180,22 200,18 225,22 C250,26 275,30 300,25 L300,60 L0,60 Z"
                        fill="url(#carbsFillDetail)"
                      />
                      <path
                        className="macro-line"
                        style={{animationDelay: '0.2s'}}
                        d="M0,35 C30,32 50,25 75,28 C100,31 120,38 150,30 C180,22 200,18 225,22 C250,26 275,30 300,25"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.macroStatsRowCompact}>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '185g' : calorieRange === '30 days' ? '195g' : '190g'}</span>
                      <span style={styles.macroStatLabelSmall}>Avg daily</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '40%' : calorieRange === '30 days' ? '41%' : '40%'}</span>
                      <span style={styles.macroStatLabelSmall}>Of total</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={{...styles.macroStatValueSmall, color: '#EF4444'}}>-3%</span>
                      <span style={styles.macroStatLabelSmall}>vs prior</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fats Intake Trend */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>🥑 Fat Intake</h3>
                <div style={styles.macroCardCompact}>
                  <div style={styles.macroChartContainerSmall}>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="fatsFillDetail" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,42 C30,40 50,35 75,38 C100,41 120,45 150,40 C180,35 200,30 225,33 C250,36 275,38 300,32 L300,60 L0,60 Z"
                        fill="url(#fatsFillDetail)"
                      />
                      <path
                        className="macro-line"
                        style={{animationDelay: '0.4s'}}
                        d="M0,42 C30,40 50,35 75,38 C100,41 120,45 150,40 C180,35 200,30 225,33 C250,36 275,38 300,32"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.macroStatsRowCompact}>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '68g' : calorieRange === '30 days' ? '72g' : '70g'}</span>
                      <span style={styles.macroStatLabelSmall}>Avg daily</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '33%' : calorieRange === '30 days' ? '31%' : '33%'}</span>
                      <span style={styles.macroStatLabelSmall}>Of total</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={{...styles.macroStatValueSmall, color: '#10B981'}}>+2%</span>
                      <span style={styles.macroStatLabelSmall}>vs prior</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fiber Intake Trend */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>🥬 Fiber Intake</h3>
                <div style={styles.macroCardCompact}>
                  <div style={styles.macroChartContainerSmall}>
                    <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="fiberFillDetail" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,45 C30,42 50,38 75,40 C100,42 120,48 150,42 C180,36 200,32 225,35 C250,38 275,40 300,35 L300,60 L0,60 Z"
                        fill="url(#fiberFillDetail)"
                      />
                      <path
                        className="macro-line"
                        style={{animationDelay: '0.6s'}}
                        d="M0,45 C30,42 50,38 75,40 C100,42 120,48 150,42 C180,36 200,32 225,35 C250,38 275,40 300,35"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div style={styles.macroStatsRowCompact}>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '28g' : calorieRange === '30 days' ? '25g' : '26g'}</span>
                      <span style={styles.macroStatLabelSmall}>Avg daily</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={styles.macroStatValueSmall}>{calorieRange === '7 days' ? '93%' : calorieRange === '30 days' ? '83%' : '87%'}</span>
                      <span style={styles.macroStatLabelSmall}>Of goal</span>
                    </div>
                    <div style={styles.macroStatItemCompact}>
                      <span style={{...styles.macroStatValueSmall, color: '#10B981'}}>+8%</span>
                      <span style={styles.macroStatLabelSmall}>vs prior</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Macro Distribution */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Macro Distribution</h3>
                <div style={styles.macroCardCompact}>
                  <div style={styles.macroDistribution}>
                    <div style={styles.macroDistBarCompact}>
                      <div style={{...styles.macroDistSegment, width: '27%', background: '#EF4444', borderRadius: '6px 0 0 6px'}}></div>
                      <div style={{...styles.macroDistSegment, width: '40%', background: '#F59E0B'}}></div>
                      <div style={{...styles.macroDistSegment, width: '33%', background: '#8B5CF6', borderRadius: '0 6px 6px 0'}}></div>
                    </div>
                    <div style={styles.macroDistLegendCompact}>
                      <div style={styles.macroDistItemCompact}>
                        <span style={{...styles.macroDistDotSmall, background: '#EF4444'}}></span>
                        <span style={styles.macroDistLabelSmall}>Protein 27%</span>
                      </div>
                      <div style={styles.macroDistItemCompact}>
                        <span style={{...styles.macroDistDotSmall, background: '#F59E0B'}}></span>
                        <span style={styles.macroDistLabelSmall}>Carbs 40%</span>
                      </div>
                      <div style={styles.macroDistItemCompact}>
                        <span style={{...styles.macroDistDotSmall, background: '#8B5CF6'}}></span>
                        <span style={styles.macroDistLabelSmall}>Fats 33%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BMI Details Page */}
      {showBMIDetails && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            {/* Header */}
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => setShowBMIDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>BMI & Weight</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              {/* Current BMI */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Current BMI</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.bmiDisplayLarge}>
                    <div style={styles.bmiValueContainerLarge}>
                      <span style={styles.bmiValueLarge}>22.4</span>
                      <span style={styles.bmiCategoryLarge}>Normal</span>
                    </div>
                    <div style={styles.bmiMetrics}>
                      <div style={styles.bmiMetricItem}>
                        <span style={styles.bmiMetricValue}>72 kg</span>
                        <span style={styles.bmiMetricLabel}>Weight</span>
                      </div>
                      <div style={styles.bmiMetricDivider}></div>
                      <div style={styles.bmiMetricItem}>
                        <span style={styles.bmiMetricValue}>179 cm</span>
                        <span style={styles.bmiMetricLabel}>Height</span>
                      </div>
                    </div>
                  </div>
                  <div style={styles.bmiBarContainerLarge}>
                    <div style={styles.bmiBarLarge}>
                      <div style={styles.bmiBarUnderweightLarge}></div>
                      <div style={styles.bmiBarNormalLarge}></div>
                      <div style={styles.bmiBarOverweightLarge}></div>
                      <div style={styles.bmiBarObeseLarge}></div>
                      <div style={{...styles.bmiIndicatorLarge, left: `${((22.4 - 15) / (35 - 15)) * 100}%`}}></div>
                    </div>
                    <div style={styles.bmiScaleNumbers}>
                      <span>15</span>
                      <span>18.5</span>
                      <span>25</span>
                      <span>30</span>
                      <span>35</span>
                    </div>
                    <div style={styles.bmiLabelsLarge}>
                      <span style={styles.bmiLabelLarge}>Underweight</span>
                      <span style={{...styles.bmiLabelLarge, color: '#10B981'}}>Normal</span>
                      <span style={styles.bmiLabelLarge}>Overweight</span>
                      <span style={styles.bmiLabelLarge}>Obese</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weight Trend */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Weight Trend</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.lineChartCompact}>
                    <svg width="100%" height="120" viewBox="0 0 300 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="weightGradientBMI" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="predictionGradientBMI" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={progressData.weightData}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        d={`${progressData.weightData} L240,120 L0,120 Z`}
                        fill="url(#weightGradientBMI)"
                      />
                      <path
                        d={progressData.weightPrediction}
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray="5 3"
                      />
                      <path
                        d={`${progressData.weightPrediction} L300,120 L240,120 Z`}
                        fill="url(#predictionGradientBMI)"
                      />
                    </svg>
                  </div>
                  <div style={styles.xAxisLabelsCompact}>
                    {progressData.weightLabels.map((label, i) => (
                      <span key={i} style={{
                        ...styles.xAxisLabelSmall,
                        color: i === progressData.weightLabels.length - 1 ? '#8B5CF6' : '#666',
                        fontWeight: i === progressData.weightLabels.length - 1 ? '600' : '400',
                      }}>{label}</span>
                    ))}
                  </div>
                  <div style={styles.weightStatsCompact}>
                    <div style={styles.weightStatCompact}>
                      <span style={styles.weightStatValueCompact}>{progressData.weightChange}</span>
                      <span style={styles.weightStatLabelCompact}>This period</span>
                    </div>
                    <div style={{...styles.weightStatCompact, background: 'rgba(139, 92, 246, 0.08)'}}>
                      <span style={{...styles.weightStatValueCompact, color: '#8B5CF6'}}>{progressData.predictedWeight}</span>
                      <span style={styles.weightStatLabelCompact}>Predicted</span>
                    </div>
                  </div>
                  <div style={styles.chartLegendCompact}>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#10B981'}}></span> Actual</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#8B5CF6', width: '12px', height: '2px'}}></span> Predicted</span>
                  </div>
                </div>
              </div>

              {/* Weight Actions */}
              <div style={styles.detailSection}>
                <div style={styles.bmiActionsRow}>
                  <button style={styles.bmiActionBtn} onClick={() => { setShowBMIDetails(false); setShowWeightModal(true); }}>
                    <span style={styles.bmiActionIcon}>⚖️</span>
                    <span style={styles.bmiActionText}>Log weight</span>
                  </button>
                  <button style={styles.bmiActionBtnOutline} onClick={() => { setShowBMIDetails(false); setShowWeightModal(true); }}>
                    <span style={styles.bmiActionIcon}>📋</span>
                    <span style={styles.bmiActionText}>View all logs</span>
                  </button>
                </div>
              </div>

              {/* BMI Info */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>BMI Categories</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.bmiInfoRow}>
                    <span style={{...styles.bmiInfoDot, background: '#3B82F6'}}></span>
                    <span style={styles.bmiInfoLabel}>Underweight</span>
                    <span style={styles.bmiInfoRange}>&lt; 18.5</span>
                  </div>
                  <div style={styles.bmiInfoRow}>
                    <span style={{...styles.bmiInfoDot, background: '#10B981'}}></span>
                    <span style={styles.bmiInfoLabel}>Normal</span>
                    <span style={styles.bmiInfoRange}>18.5 - 24.9</span>
                  </div>
                  <div style={styles.bmiInfoRow}>
                    <span style={{...styles.bmiInfoDot, background: '#F59E0B'}}></span>
                    <span style={styles.bmiInfoLabel}>Overweight</span>
                    <span style={styles.bmiInfoRange}>25 - 29.9</span>
                  </div>
                  <div style={{...styles.bmiInfoRow, borderBottom: 'none', paddingBottom: 0, marginBottom: 0}}>
                    <span style={{...styles.bmiInfoDot, background: '#EF4444'}}></span>
                    <span style={styles.bmiInfoLabel}>Obese</span>
                    <span style={styles.bmiInfoRange}>≥ 30</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fasting Details Page */}
      {showFastingDetails && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            {/* Header */}
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => setShowFastingDetails(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>Fasting Details</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            {/* Time Range Filter */}
            <div style={styles.detailsTimeRange}>
              {['7 days', '30 days', '90 days', 'All time'].map((range) => (
                <button
                  key={range}
                  style={{
                    ...styles.detailsTimeBtn,
                    ...(progressRange === range ? styles.detailsTimeBtnActive : {})
                  }}
                  onClick={() => setProgressRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            <div style={styles.weightPageContent}>
              {/* Fasting Overview */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Fasting Overview</h3>
                <div style={styles.detailCardsGrid}>
                  <div style={styles.detailCard}>
                    <span style={styles.detailCardValue}>{progressData.avgFastLength}</span>
                    <span style={styles.detailCardLabel}>Avg fasting length</span>
                  </div>
                  <div style={styles.detailCard}>
                    <span style={styles.detailCardValue}>{progressData.completionRate}</span>
                    <span style={styles.detailCardLabel}>Avg fast completion</span>
                  </div>
                </div>
              </div>

              {/* Fasting Consistency Bar Chart + Trend Table */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Fasting Consistency</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.barChartWithAvg}>
                    <div style={styles.avgLineContainerTall}>
                      <div style={{...styles.avgLine, bottom: `${(progressData.fastingAvg / 24) * 100}%`}}></div>
                    </div>
                    <div style={styles.barChartTall}>
                      {progressData.fastingBars.map((val, i) => (
                        <div key={i} style={styles.barGroup}>
                          <div style={styles.barContainerTall}>
                            <div style={{
                              ...styles.bar,
                              height: `${(val / 24) * 100}%`,
                              background: val === 0 ? '#E5E7EB' : 'linear-gradient(180deg, #8B5CF6 0%, #C4B5FD 100%)',
                            }}></div>
                          </div>
                          <span style={styles.barLabelSmall}>{progressData.barLabels[i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={styles.chartLegendCompact}>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#8B5CF6'}}></span> Completed</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#E5E7EB'}}></span> Missed</span>
                    <span style={styles.legendItemSmall}><span style={{...styles.legendDotSmall, background: '#F59E0B', width: '12px', height: '2px'}}></span> Avg ({progressData.fastingAvg}h)</span>
                  </div>
                  
                  <div style={styles.trendDivider}></div>
                  
                  <div style={styles.trendRow}>
                    <span style={styles.trendLabel}>This week vs last week</span>
                    <span style={styles.trendValuePositive}>{progressRange === '7 days' ? '+12%' : progressRange === '30 days' ? '+8%' : progressRange === '90 days' ? '+15%' : '+22%'} ↑</span>
                  </div>
                  <div style={styles.trendRow}>
                    <span style={styles.trendLabel}>Period trend</span>
                    <span style={styles.trendValuePositive}>Improving</span>
                  </div>
                  <div style={styles.trendRow}>
                    <span style={styles.trendLabel}>Best day for fasting</span>
                    <span style={styles.trendValue}>{progressRange === '7 days' ? 'Tuesday' : progressRange === '30 days' ? 'Wednesday' : 'Tuesday'}</span>
                  </div>
                  <div style={{...styles.trendRow, borderBottom: 'none', marginBottom: 0, paddingBottom: 0}}>
                    <span style={styles.trendLabel}>Most skipped day</span>
                    <span style={styles.trendValueNegative}>{progressRange === '7 days' ? 'Saturday' : progressRange === '30 days' ? 'Sunday' : 'Saturday'}</span>
                  </div>
                </div>
              </div>

              {/* How Your Body Responds */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>How Your Body Responds</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.bodyResponseItem}>
                    <span style={styles.bodyResponseLabel}>Energy during fasts</span>
                    <div style={styles.bodyResponseBar}>
                      <div style={{...styles.bodyResponseFill, width: progressRange === '7 days' ? '70%' : progressRange === '30 days' ? '75%' : '72%', background: '#10B981'}}></div>
                    </div>
                    <span style={styles.bodyResponseValue}>{progressRange === '7 days' ? 'Good' : progressRange === '30 days' ? 'Great' : 'Good'}</span>
                  </div>
                  <div style={styles.bodyResponseItem}>
                    <span style={styles.bodyResponseLabel}>Focus & clarity</span>
                    <div style={styles.bodyResponseBar}>
                      <div style={{...styles.bodyResponseFill, width: progressRange === '7 days' ? '85%' : progressRange === '30 days' ? '80%' : '82%', background: '#8B5CF6'}}></div>
                    </div>
                    <span style={styles.bodyResponseValue}>{progressRange === '7 days' ? 'Excellent' : 'Great'}</span>
                  </div>
                  <div style={{...styles.bodyResponseItem, marginBottom: 0}}>
                    <span style={styles.bodyResponseLabel}>Mood stability</span>
                    <div style={styles.bodyResponseBar}>
                      <div style={{...styles.bodyResponseFill, width: progressRange === '7 days' ? '60%' : progressRange === '30 days' ? '68%' : '65%', background: '#F59E0B'}}></div>
                    </div>
                    <span style={styles.bodyResponseValue}>{progressRange === '7 days' ? 'Moderate' : 'Good'}</span>
                  </div>
                </div>
              </div>

              {/* At a Glance */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>At a Glance</h3>
                <div style={styles.detailCardsGrid}>
                  <div style={styles.detailCard}>
                    <span style={styles.detailCardEmoji}>😋</span>
                    <span style={styles.detailCardValue}>{progressRange === '7 days' ? 'Medium' : progressRange === '30 days' ? 'Low' : 'Medium'}</span>
                    <span style={styles.detailCardLabel}>Avg hunger level</span>
                  </div>
                  <div style={styles.detailCard}>
                    <span style={styles.detailCardEmoji}>⚡</span>
                    <span style={styles.detailCardValue}>{progressRange === '7 days' ? 'Low energy' : progressRange === '30 days' ? 'Cravings' : 'Low energy'}</span>
                    <span style={styles.detailCardLabel}>Common symptom</span>
                  </div>
                </div>
              </div>

              {/* Common Symptoms - Donut Chart */}
              <div style={styles.detailSection}>
                <h3 style={styles.detailSectionTitle}>Common Symptoms</h3>
                <div style={styles.detailCardFull}>
                  <div style={styles.donutChartContainer}>
                    <div style={styles.donutChart}>
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r="54" fill="none" stroke="#E5E7EB" strokeWidth="16" />
                        {/* Low energy - 45% (largest) */}
                        <circle 
                          cx="70" cy="70" r="54" fill="none" 
                          stroke="#EF4444" strokeWidth="16"
                          strokeDasharray={`${(progressRange === '7 days' ? 0.45 : progressRange === '30 days' ? 0.35 : 0.40) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                          strokeDashoffset="0"
                          transform="rotate(-90 70 70)"
                          strokeLinecap="round"
                        />
                        {/* Brain fog - 30% */}
                        <circle 
                          cx="70" cy="70" r="54" fill="none" 
                          stroke="#F59E0B" strokeWidth="16"
                          strokeDasharray={`${(progressRange === '7 days' ? 0.30 : progressRange === '30 days' ? 0.25 : 0.28) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                          strokeDashoffset={`${-(progressRange === '7 days' ? 0.45 : progressRange === '30 days' ? 0.35 : 0.40) * 2 * Math.PI * 54}`}
                          transform="rotate(-90 70 70)"
                          strokeLinecap="round"
                        />
                        {/* Cravings - 15% */}
                        <circle 
                          cx="70" cy="70" r="54" fill="none" 
                          stroke="#8B5CF6" strokeWidth="16"
                          strokeDasharray={`${(progressRange === '7 days' ? 0.15 : progressRange === '30 days' ? 0.22 : 0.18) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                          strokeDashoffset={`${-(progressRange === '7 days' ? 0.75 : progressRange === '30 days' ? 0.60 : 0.68) * 2 * Math.PI * 54}`}
                          transform="rotate(-90 70 70)"
                          strokeLinecap="round"
                        />
                        {/* No symptoms - 10% */}
                        <circle 
                          cx="70" cy="70" r="54" fill="none" 
                          stroke="#10B981" strokeWidth="16"
                          strokeDasharray={`${(progressRange === '7 days' ? 0.10 : progressRange === '30 days' ? 0.18 : 0.14) * 2 * Math.PI * 54} ${2 * Math.PI * 54}`}
                          strokeDashoffset={`${-(progressRange === '7 days' ? 0.90 : progressRange === '30 days' ? 0.82 : 0.86) * 2 * Math.PI * 54}`}
                          transform="rotate(-90 70 70)"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={styles.donutCenter}>
                        <span style={styles.donutCenterValue}>{progressRange === '7 days' ? '45%' : progressRange === '30 days' ? '35%' : '40%'}</span>
                        <span style={styles.donutCenterLabel}>Low energy</span>
                      </div>
                    </div>
                    <div style={styles.donutLegend}>
                      <div style={styles.donutLegendItem}>
                        <span style={{...styles.donutLegendDot, background: '#EF4444'}}></span>
                        <span style={styles.donutLegendText}>Low energy</span>
                        <span style={styles.donutLegendPercent}>{progressRange === '7 days' ? '45%' : progressRange === '30 days' ? '35%' : '40%'}</span>
                      </div>
                      <div style={styles.donutLegendItem}>
                        <span style={{...styles.donutLegendDot, background: '#F59E0B'}}></span>
                        <span style={styles.donutLegendText}>Brain fog</span>
                        <span style={styles.donutLegendPercent}>{progressRange === '7 days' ? '30%' : progressRange === '30 days' ? '25%' : '28%'}</span>
                      </div>
                      <div style={styles.donutLegendItem}>
                        <span style={{...styles.donutLegendDot, background: '#8B5CF6'}}></span>
                        <span style={styles.donutLegendText}>Cravings</span>
                        <span style={styles.donutLegendPercent}>{progressRange === '7 days' ? '15%' : progressRange === '30 days' ? '22%' : '18%'}</span>
                      </div>
                      <div style={styles.donutLegendItem}>
                        <span style={{...styles.donutLegendDot, background: '#10B981'}}></span>
                        <span style={styles.donutLegendText}>No symptoms</span>
                        <span style={styles.donutLegendPercent}>{progressRange === '7 days' ? '10%' : progressRange === '30 days' ? '18%' : '14%'}</span>
                      </div>
                    </div>
                  </div>
                  <p style={styles.symptomInsight}>💡 {progressRange === '7 days' ? 'You experience fewer symptoms during 16-18h fasts' : progressRange === '30 days' ? 'Your symptoms have decreased by 15% this month' : 'Longer fasts tend to have more symptoms'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weight Logging Page */}
      {showWeightModal && (
        <div style={styles.weightPageOverlay}>
          <div style={styles.weightPage}>
            {/* Header */}
            <div style={styles.weightPageHeader}>
              <button style={styles.weightBackBtn} onClick={() => setShowWeightModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 style={styles.weightPageTitle}>Weight Log</h2>
              <div style={{ width: '40px' }}></div>
            </div>

            <div style={styles.weightPageContent}>
              {/* Compact Weight Input Section */}
              <div style={styles.weightInputCompact}>
                {/* Smaller Dash Circle Display */}
                <div style={styles.weightDashContainerSmall}>
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    {/* Background dashes */}
                    {[...Array(36)].map((_, i) => {
                      const angle = (i * 10 - 135) * (Math.PI / 180);
                      const x1 = 80 + 62 * Math.cos(angle);
                      const y1 = 80 + 62 * Math.sin(angle);
                      const x2 = 80 + 70 * Math.cos(angle);
                      const y2 = 80 + 70 * Math.sin(angle);
                      return (
                        <line
                          key={i}
                          x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke={i < 27 ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {/* Active dashes based on weight */}
                    {[...Array(Math.min(27, Math.floor((parseFloat(newWeight) || 72) / 4)))].map((_, i) => {
                      const angle = (i * 10 - 135) * (Math.PI / 180);
                      const x1 = 80 + 62 * Math.cos(angle);
                      const y1 = 80 + 62 * Math.sin(angle);
                      const x2 = 80 + 70 * Math.cos(angle);
                      const y2 = 80 + 70 * Math.sin(angle);
                      return (
                        <line
                          key={`active-${i}`}
                          x1={x1} y1={y1} x2={x2} y2={y2}
                          stroke="url(#dashGradientSmall)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <defs>
                      <linearGradient id="dashGradientSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#A855F7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={styles.weightDashCenterSmall}>
                    <input
                      type="number"
                      placeholder={weightUnit === 'kg' ? '72' : '160'}
                      value={newWeight}
                      onChange={(e) => setNewWeight(e.target.value)}
                      style={styles.weightInputMedium}
                    />
                    <button style={styles.unitDropdownSmall} onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lb' : 'kg')}>
                      <span style={styles.unitDropdownTextSmall}>{weightUnit}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <button style={styles.saveWeightBtnCompact} onClick={saveWeight}>
                  <span style={styles.saveWeightBtnTextSmall}>Save Weight</span>
                </button>
              </div>

              {/* Weight Statistics */}
              <div style={styles.weightStatsSection}>
                <div style={styles.weightStatsHeader}>
                  <h3 style={styles.weightStatsSectionTitle}>Weight Statistics</h3>
                  <div style={styles.weightStatsDropdownContainer}>
                    <button 
                      style={styles.weightStatsDropdownBtn}
                      onClick={() => setShowWeightStatsDropdown(!showWeightStatsDropdown)}
                    >
                      <span>{weightStatsRange}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {showWeightStatsDropdown && (
                      <div style={styles.weightStatsDropdownMenu}>
                        {['7 days', '30 days', '90 days', '180 days', 'All time'].map((range) => (
                          <button
                            key={range}
                            style={{
                              ...styles.weightStatsDropdownItem,
                              ...(weightStatsRange === range ? styles.weightStatsDropdownItemActive : {})
                            }}
                            onClick={() => {
                              setWeightStatsRange(range);
                              setShowWeightStatsDropdown(false);
                            }}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={styles.weightStatsGrid}>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>📉</span>
                    <span style={styles.weightStatCardValue}>
                      {weightStatsRange === '7 days' ? '-0.8 kg' : 
                       weightStatsRange === '30 days' ? '-1.2 kg' : 
                       weightStatsRange === '90 days' ? '-0.9 kg' : 
                       weightStatsRange === '180 days' ? '-0.7 kg' : '-0.6 kg'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Avg weekly loss</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>📈</span>
                    <span style={styles.weightStatCardValue}>
                      {weightStatsRange === '7 days' ? '+0.3 kg' : 
                       weightStatsRange === '30 days' ? '+0.4 kg' : 
                       weightStatsRange === '90 days' ? '+0.5 kg' : 
                       weightStatsRange === '180 days' ? '+0.4 kg' : '+0.3 kg'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Avg weekly gain</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>🎯</span>
                    <span style={styles.weightStatCardValue}>
                      {weightStatsRange === '7 days' ? '-0.5 kg' : 
                       weightStatsRange === '30 days' ? '-2.5 kg' : 
                       weightStatsRange === '90 days' ? '-4.8 kg' : 
                       weightStatsRange === '180 days' ? '-7.2 kg' : '-9.5 kg'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Total change</span>
                  </div>
                  <div style={styles.weightStatCard}>
                    <span style={styles.weightStatIcon}>⚖️</span>
                    <span style={styles.weightStatCardValue}>
                      {weightStatsRange === '7 days' ? '71.8 kg' : 
                       weightStatsRange === '30 days' ? '72.4 kg' : 
                       weightStatsRange === '90 days' ? '73.1 kg' : 
                       weightStatsRange === '180 days' ? '74.2 kg' : '75.0 kg'}
                    </span>
                    <span style={styles.weightStatCardLabel}>Avg weight</span>
                  </div>
                </div>
                <div style={styles.weightStatsMini}>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Highest</span>
                    <span style={styles.weightStatMiniValue}>
                      {weightStatsRange === '7 days' ? '72.3 kg' : 
                       weightStatsRange === '30 days' ? '74.5 kg' : 
                       weightStatsRange === '90 days' ? '76.2 kg' : 
                       weightStatsRange === '180 days' ? '78.5 kg' : '81.0 kg'}
                    </span>
                  </div>
                  <div style={styles.weightStatMiniDivider}></div>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Lowest</span>
                    <span style={styles.weightStatMiniValue}>
                      {weightStatsRange === '7 days' ? '71.2 kg' : 
                       weightStatsRange === '30 days' ? '69.8 kg' : 
                       weightStatsRange === '90 days' ? '69.5 kg' : 
                       weightStatsRange === '180 days' ? '69.2 kg' : '68.8 kg'}
                    </span>
                  </div>
                  <div style={styles.weightStatMiniDivider}></div>
                  <div style={styles.weightStatMiniItem}>
                    <span style={styles.weightStatMiniLabel}>Entries</span>
                    <span style={styles.weightStatMiniValue}>
                      {weightStatsRange === '7 days' ? '5' : 
                       weightStatsRange === '30 days' ? '18' : 
                       weightStatsRange === '90 days' ? '52' : 
                       weightStatsRange === '180 days' ? '98' : weightLogs.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Past Logs Section - Compact */}
              <div style={styles.pastLogsCompact}>
                <div style={styles.pastLogsHeaderRow}>
                  <h3 style={styles.pastLogsTitleCompact}>Past Logs</h3>
                  <button style={styles.exportBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>Export</span>
                  </button>
                </div>
                <div style={styles.logsListCompact}>
                  {weightLogs.slice(0, 15).map((log, index) => {
                    const displayWeight = weightUnit === log.unit 
                      ? log.weight 
                      : convertWeight(log.weight, log.unit, weightUnit);
                    const prevWeight = index < weightLogs.length - 1 
                      ? (weightUnit === weightLogs[index + 1].unit 
                          ? weightLogs[index + 1].weight 
                          : convertWeight(weightLogs[index + 1].weight, weightLogs[index + 1].unit, weightUnit))
                      : null;
                    const diff = prevWeight ? (displayWeight - prevWeight).toFixed(1) : null;
                    const isGain = diff > 0;
                    
                    return (
                      <div key={index} style={styles.logItemCompact}>
                        <div style={styles.logItemLeftCompact}>
                          <div style={styles.logDateBadgeSmall}>
                            <span style={styles.logDateDaySmall}>{log.date.split(',')[0].substring(0, 3)}</span>
                          </div>
                          <div style={styles.logItemInfoCompact}>
                            <span style={styles.logWeightCompact}>{displayWeight} {weightUnit}</span>
                            <span style={styles.logDateCompact}>{log.date}</span>
                          </div>
                        </div>
                        <div style={styles.logItemRightCompact}>
                          {diff && (
                            <span style={{
                              ...styles.logDiffSmall,
                              color: isGain ? '#EF4444' : '#10B981',
                              background: isGain ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            }}>
                              {isGain ? '+' : ''}{diff}
                            </span>
                          )}
                          <button style={styles.logDeleteBtnSmall} onClick={() => deleteWeightLog(index)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Interface */}
      {showChat && (
        <div style={styles.chatOverlay}>
          <div style={styles.chatContainer}>
            {/* Chat Header */}
            <div style={styles.chatHeader}>
              <button style={styles.chatBackBtn} onClick={() => setShowChat(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div style={styles.chatHeaderInfo}>
                <div style={styles.chatAvatar}>
                  <span>🤖</span>
                </div>
                <div>
                  <h3 style={styles.chatHeaderTitle}>Fasting Assistant</h3>
                  <p style={styles.chatHeaderStatus}>
                    {isTyping ? 'Typing...' : 'Online'}
                  </p>
                </div>
              </div>
              <button style={styles.chatMenuBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>

            {/* Chat Messages */}
            <div style={styles.chatMessages}>
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    ...styles.chatBubbleWrapper,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={styles.chatBubbleAvatar}>🤖</div>
                  )}
                  <div
                    style={{
                      ...styles.chatBubble,
                      ...(msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant),
                    }}
                  >
                    <p style={styles.chatBubbleText}>{msg.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={styles.chatBubbleWrapper}>
                  <div style={styles.chatBubbleAvatar}>🤖</div>
                  <div style={{...styles.chatBubble, ...styles.chatBubbleAssistant}}>
                    <div style={styles.typingIndicator}>
                      <span style={styles.typingDot}></span>
                      <span style={{...styles.typingDot, animationDelay: '0.2s'}}></span>
                      <span style={{...styles.typingDot, animationDelay: '0.4s'}}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions */}
            <div style={styles.chatSuggestions}>
              {['Why am I tired?', 'Best fasting schedule?', 'Tips for hunger'].map((suggestion, i) => (
                <button
                  key={i}
                  style={styles.chatSuggestionBtn}
                  onClick={() => {
                    setChatInput(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Chat Input */}
            <div style={styles.chatInputContainer}>
              <input
                type="text"
                placeholder="Ask about your fasting insights..."
                style={styles.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button 
                style={{
                  ...styles.chatSendBtn,
                  opacity: chatInput.trim() ? 1 : 0.5,
                }}
                onClick={sendMessage}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Page */}
      {showCheckInPage && (
        <div style={styles.checkInPageOverlay}>
          <div style={styles.checkInPage}>
            {/* Header */}
            <div style={styles.checkInHeader}>
              <button style={styles.checkInBackBtn} onClick={() => setShowCheckInPage(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div style={styles.checkInHeaderCenter}>
                <h2 style={styles.checkInTitle}>Today</h2>
                <p style={styles.checkInSubtitle}>Fasting day 10</p>
              </div>
              <div style={styles.checkInNavBtns}>
                <button style={styles.checkInNavBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button style={styles.checkInNavBtn}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div style={styles.searchBarContainer}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Search logs" style={styles.searchInput} />
            </div>

            <div style={styles.checkInContent}>
              {/* Section 1: How do you feel */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>How are you feeling today?</h3>
                <div style={styles.chipsContainer}>
                  {['😌 Calm', '🎯 Focused', '⚡ Energized', '😴 Low energy', '🍽️ Hungry', '🤤 Very hungry', '😤 Irritable', '💪 Motivated'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(feelings.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleChip(chip, feelings, setFeelings)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Fasting Status */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Fasting status</h3>
                <div style={styles.chipsContainer}>
                  {['✅ Fasting as planned', '⏰ Broke fast early', '⏳ Extended fast', '🍴 Eating window day', '😴 Rest day (no fast)'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(fastingStatus === chip ? styles.chipSelected : {})
                      }}
                      onClick={() => setFastingStatus(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 3: Hunger Level */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Hunger level</h3>
                <div style={styles.chipsContainer}>
                  {['😊 Not hungry', '🤔 Slightly hungry', '😋 Hungry', '🤤 Very hungry', '😫 Extreme hunger'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(hungerLevel === chip ? styles.chipSelected : {})
                      }}
                      onClick={() => setHungerLevel(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 4: Mood */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Mood</h3>
                <div style={styles.chipsContainer}>
                  {['😌 Calm', '😊 Happy', '🎯 Focused', '💪 Motivated', '😤 Irritable', '😰 Anxious', '😔 Low mood', '🌫️ Mentally foggy', '😞 Self-critical', '😓 Stressed'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(moods.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleChip(chip, moods, setMoods)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 5: Fasting Body Symptoms */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Fasting-related symptoms</h3>
                <div style={styles.chipsContainer}>
                  {['✨ Everything feels fine', '😴 Low energy', '😵 Dizziness', '🤕 Headache', '💫 Weakness', '🥶 Cold sensitivity', '🍽️ Hunger pains', '🍫 Cravings', '🤢 Nausea', '🌫️ Brain fog', '🤔 Trouble concentrating', '😰 Shakiness'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(symptoms.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleSymptom(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 6: Fast-Break Details */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>How did you break your fast?</h3>
                <div style={styles.chipsContainer}>
                  {['🥗 Light meal', '🍔 Heavy meal', '🥩 Protein-focused', '🍞 Carb-heavy', '🍬 Sugary foods', '⚡ Ate too fast', '😊 Felt good after', '😣 Felt uncomfortable'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(fastBreak.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleChip(chip, fastBreak, setFastBreak)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 7: Activity */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Physical activity</h3>
                <div style={styles.chipsContainer}>
                  {["🚫 Didn't exercise", '🚶 Walking', '🧘 Yoga / stretching', '🏋️ Gym', '🏃 Cardio', '💪 Strength training', '⚽ Sports'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(activities.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleChip(chip, activities, setActivities)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 8: Other Factors */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Other</h3>
                <div style={styles.chipsContainer}>
                  {['😓 Stress', '😴 Poor sleep', '😊 Good sleep', '✈️ Travel', '🧘 Meditation', '🌬️ Breathwork', '🍷 Alcohol', '🎉 Social event', '🤒 Illness / injury'].map((chip) => (
                    <button
                      key={chip}
                      style={{
                        ...styles.chip,
                        ...(otherFactors.includes(chip) ? styles.chipSelected : {})
                      }}
                      onClick={() => toggleChip(chip, otherFactors, setOtherFactors)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 9: Hydration */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>💧 Water</h3>
                <div style={styles.waterCard}>
                  <div style={styles.waterCounter}>
                    <button 
                      style={styles.waterBtn}
                      onClick={() => setWaterCount(Math.max(0, waterCount - 8))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <div style={styles.waterDisplay}>
                      <span style={styles.waterAmount}>{waterCount}</span>
                      <span style={styles.waterTotal}>/ 72 fl oz</span>
                    </div>
                    <button 
                      style={styles.waterBtn}
                      onClick={() => setWaterCount(waterCount + 8)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                  <button style={styles.waterLink}>Reminders and settings →</button>
                </div>
              </div>

              {/* Section 10: Body Metrics */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>Body metrics</h3>
                <div style={styles.metricsCard}>
                  <div style={styles.metricRow}>
                    <div style={styles.metricInfo}>
                      <span style={styles.metricLabel}>⚖️ Weight</span>
                    </div>
                    <div style={styles.metricActions}>
                      <button style={styles.metricBtn}>Log weight</button>
                      <button style={styles.metricLink}>View chart</button>
                    </div>
                  </div>
                  <div style={styles.metricDivider}></div>
                  <div style={styles.metricRow}>
                    <div style={styles.metricInfo}>
                      <span style={styles.metricLabel}>🌡️ Body temperature</span>
                    </div>
                    <div style={styles.metricActions}>
                      <button style={styles.metricBtn}>Log temp</button>
                      <button style={styles.metricLink}>View chart</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 11: Notes */}
              <div style={styles.checkInSection}>
                <h3 style={styles.checkInSectionTitle}>📝 Notes</h3>
                <div style={styles.notesCard}>
                  <textarea
                    style={styles.notesInput}
                    placeholder="Add notes about your fast, hunger, energy, or anything unusual today."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ height: '100px' }}></div>
            </div>

            {/* Save Button */}
            <div style={styles.checkInFooter}>
              <button style={styles.checkInSaveBtn} onClick={saveCheckIn}>
                Save Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fasting Plan Selection Page */}
      {showPlanPage && (
        <div style={styles.planPageOverlay}>
          <div style={styles.planPage}>
            <div style={styles.planPageHeader}>
              <div>
                <h2 style={styles.planPageTitle}>Fasting times</h2>
                <p style={styles.planPageHeaderSub}>Choose your preferred fasting time</p>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowPlanPage(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div style={styles.plansList}>
              {/* Beginner Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#ECFDF5'}}>
                  <h3 style={styles.sectionLabel}>Beginner</h3>
                  <p style={styles.sectionSub}>Perfect for starting your fasting journey</p>
                </div>
                <div style={styles.planCardsScroll}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardGreen,
                      ...(selectedPlan === '10:14' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '10:14', fastHours: 10 })}
                  >
                    <span style={styles.planRatio}>10:14</span>
                    <span style={styles.planCardText}>Fast for 10 hours, eat within a 14 hour window</span>
                    {selectedPlan === '10:14' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardGreen,
                      ...(selectedPlan === '14:10' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '14:10', fastHours: 14 })}
                  >
                    <span style={styles.planRatio}>14:10</span>
                    <span style={styles.planCardText}>14 hours of fasting with a 10 hour eating period</span>
                    {selectedPlan === '14:10' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardGreen,
                      ...(selectedPlan === '15:9' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '15:9', fastHours: 15 })}
                  >
                    <span style={styles.planRatio}>15:9</span>
                    <span style={styles.planCardText}>15 hour fast paired with 9 hours to enjoy meals</span>
                    {selectedPlan === '15:9' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                </div>
              </div>

              {/* Regular Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#FFFBEB'}}>
                  <h3 style={styles.sectionLabel}>Regular</h3>
                  <p style={styles.sectionSub}>Unlock the full benefits of intermittent fasting</p>
                </div>
                <div style={styles.planCardsScroll}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardYellow,
                      ...(selectedPlan === '16:8' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '16:8', fastHours: 16 })}
                  >
                    <span style={styles.planRatio}>16:8</span>
                    <span style={styles.planCardText}>The classic 16 hour fast with 8 hour eating window</span>
                    {selectedPlan === '16:8' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardYellow,
                      ...(selectedPlan === '17:7' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '17:7', fastHours: 17 })}
                  >
                    <span style={styles.planRatio}>17:7</span>
                    <span style={styles.planCardText}>Go a bit longer with 17 hours fasting, 7 hours eating</span>
                    {selectedPlan === '17:7' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardYellow,
                      ...(selectedPlan === '18:6' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '18:6', fastHours: 18 })}
                  >
                    <span style={styles.planRatio}>18:6</span>
                    <span style={styles.planCardText}>18 hours without food, 6 hour window for meals</span>
                    {selectedPlan === '18:6' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardYellow,
                      ...(selectedPlan === '19:5' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '19:5', fastHours: 19 })}
                  >
                    <span style={styles.planRatio}>19:5</span>
                    <span style={styles.planCardText}>Push further with 19 hours fasting, 5 hour eating</span>
                    {selectedPlan === '19:5' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                </div>
              </div>

              {/* Expert Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#FFF7ED'}}>
                  <h3 style={styles.sectionLabel}>Expert</h3>
                  <p style={styles.sectionSub}>For experienced fasters ready to level up</p>
                </div>
                <div style={styles.planCardsScroll}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardOrange,
                      ...(selectedPlan === '21:3' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '21:3', fastHours: 21 })}
                  >
                    <span style={styles.planRatio}>21:3</span>
                    <span style={styles.planCardText}>Intense 21 hour fast with a tight 3 hour eating window</span>
                    {selectedPlan === '21:3' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardOrange,
                      ...(selectedPlan === '22:2' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '22:2', fastHours: 22 })}
                  >
                    <span style={styles.planRatio}>22:2</span>
                    <span style={styles.planCardText}>22 hours fasting, just 2 hours to eat your meals</span>
                    {selectedPlan === '22:2' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardOrange,
                      ...(selectedPlan === '23:1' ? styles.planCardSelectedNew : {})
                    }}
                    onClick={() => selectPlan({ id: '23:1', fastHours: 23 })}
                  >
                    <span style={styles.planRatio}>23:1</span>
                    <span style={styles.planCardText}>One meal a day - 23 hours fasting, 1 hour to eat</span>
                    {selectedPlan === '23:1' && <div style={styles.selectedCheck}>✓</div>}
                  </button>
                </div>
              </div>

              {/* Weekly Schedules Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#EFF6FF'}}>
                  <h3 style={styles.sectionLabel}>Weekly schedules</h3>
                  <p style={styles.sectionSub}>Flexible plans that work around your week</p>
                </div>
                <div style={styles.planCardsScroll}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardBlue,
                    }}
                    onClick={() => {/* Show paywall */}}
                  >
                    <div style={styles.planCardTop}>
                      <span style={styles.planRatio}>4:3</span>
                      <span style={styles.plusBadge}>PLUS</span>
                    </div>
                    <span style={styles.planCardText}>Eat normally for 4 days, fast for 3 days each week</span>
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardBlue,
                    }}
                    onClick={() => {/* Show paywall */}}
                  >
                    <div style={styles.planCardTop}>
                      <span style={styles.planRatio}>5:2</span>
                      <span style={styles.plusBadge}>PLUS</span>
                    </div>
                    <span style={styles.planCardText}>5 regular eating days with 2 fasting days weekly</span>
                  </button>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardBlue,
                    }}
                    onClick={() => {/* Show paywall */}}
                  >
                    <div style={styles.planCardTop}>
                      <span style={styles.planRatio}>6:1</span>
                      <span style={styles.plusBadge}>PLUS</span>
                    </div>
                    <span style={styles.planCardText}>Eat for 6 days, dedicate 1 day to fasting</span>
                  </button>
                </div>
              </div>

              {/* Custom Schedule Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#F5F3FF'}}>
                  <h3 style={styles.sectionLabel}>Custom schedule</h3>
                  <p style={styles.sectionSub}>Design a plan that fits your unique lifestyle</p>
                </div>
                <div style={styles.planCardsWrapper}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardPurple,
                      width: '100%',
                    }}
                    onClick={() => {/* Show paywall */}}
                  >
                    <div style={styles.planCardTop}>
                      <span style={styles.planRatio}>Custom</span>
                      <span style={styles.plusBadge}>PLUS</span>
                    </div>
                    <span style={styles.planCardText}>Build your own fasting schedule tailored to your goals</span>
                  </button>
                </div>
              </div>

              {/* Long Fasts Section */}
              <div style={styles.planSection}>
                <div style={{...styles.sectionHeader, backgroundColor: '#FDF2F8'}}>
                  <h3 style={styles.sectionLabel}>Long fasts</h3>
                  <p style={styles.sectionSub}>Take on a bigger challenge when you're ready</p>
                </div>
                <div style={styles.planCardsWrapper}>
                  <button
                    style={{
                      ...styles.planCardNew,
                      ...styles.planCardPink,
                      width: '100%',
                    }}
                    onClick={() => {/* Show paywall */}}
                  >
                    <div style={styles.planCardTop}>
                      <span style={styles.planRatio}>Long</span>
                      <span style={styles.plusBadge}>PLUS</span>
                    </div>
                    <span style={styles.planCardText}>Extended fasting beyond 24 hours for special occasions</span>
                  </button>
                </div>
              </div>

              <div style={{ height: '40px' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Time Edit Modal */}
      {showTimeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowTimeModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {editingTime === 'start' ? 'Edit Start Time' : 'Edit End Time'}
              </h3>
              <button style={styles.modalClose} onClick={() => setShowTimeModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div style={styles.pickerContainer}>
              <div style={styles.pickerColumn}>
                <span style={styles.pickerLabel}>Day</span>
                <div style={styles.scrollPicker}>
                  {days.map((day) => (
                    <button
                      key={day}
                      style={{
                        ...styles.pickerItem,
                        ...(editingTime === 'start' ? startDay : endDay) === day ? styles.pickerItemActive : {}
                      }}
                      onClick={() => editingTime === 'start' ? setStartDay(day) : setEndDay(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={styles.pickerColumn}>
                <span style={styles.pickerLabel}>Hour</span>
                <div style={styles.scrollPicker}>
                  {hours.map((hour) => (
                    <button
                      key={hour}
                      style={{
                        ...styles.pickerItem,
                        ...(editingTime === 'start' ? startHour : endHour) === hour ? styles.pickerItemActive : {}
                      }}
                      onClick={() => editingTime === 'start' ? setStartHour(hour) : setEndHour(hour)}
                    >
                      {hour.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={styles.pickerColumn}>
                <span style={styles.pickerLabel}>Min</span>
                <div style={styles.scrollPicker}>
                  {minutesSeconds.map((min) => (
                    <button
                      key={min}
                      style={{
                        ...styles.pickerItem,
                        ...(editingTime === 'start' ? startMinute : endMinute) === min ? styles.pickerItemActive : {}
                      }}
                      onClick={() => editingTime === 'start' ? setStartMinute(min) : setEndMinute(min)}
                    >
                      {min.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={styles.pickerColumn}>
                <span style={styles.pickerLabel}>Sec</span>
                <div style={styles.scrollPicker}>
                  {minutesSeconds.map((sec) => (
                    <button
                      key={sec}
                      style={{
                        ...styles.pickerItem,
                        ...(editingTime === 'start' ? startSecond : endSecond) === sec ? styles.pickerItemActive : {}
                      }}
                      onClick={() => editingTime === 'start' ? setStartSecond(sec) : setEndSecond(sec)}
                    >
                      {sec.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <button style={styles.saveBtn} onClick={() => setShowTimeModal(false)}>
              <span style={styles.saveBtnText}>Save</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <nav style={styles.tabBar}>
        <button style={activeTab === 'today' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('today')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill={activeTab === 'today' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={activeTab === 'today' ? 0 : 2}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <span style={activeTab === 'today' ? styles.tabLabel : styles.tabLabelInactive}>Today</span>
        </button>
        <button style={activeTab === 'meals' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('meals')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8h1a4 4 0 010 8h-1" />
            <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
          <span style={activeTab === 'meals' ? styles.tabLabel : styles.tabLabelInactive}>Meals</span>
        </button>
        <button style={activeTab === 'progress' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('progress')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M18 17V9M13 17V5M8 17v-3" />
          </svg>
          <span style={activeTab === 'progress' ? styles.tabLabel : styles.tabLabelInactive}>Progress</span>
        </button>
        <button style={activeTab === 'settings' ? styles.tabActive : styles.tab} onClick={() => setActiveTab('settings')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <span style={activeTab === 'settings' ? styles.tabLabel : styles.tabLabelInactive}>Settings</span>
        </button>
      </nav>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes rotateCircle {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes counterRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        
        @keyframes soundWave {
          0% { height: 8px; }
          100% { height: 28px; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .rotating-option-item {
          transition: box-shadow 0.2s ease;
        }
        
        .rotating-option-item:active {
          box-shadow: 0 8px 28px rgba(124, 58, 237, 0.3) !important;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        
        .progress-content::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '430px',
    minHeight: '100vh',
    margin: '0 auto',
    background: 'linear-gradient(180deg, #FAFBFF 0%, #F5F3FF 50%, #FDF4FF 100%)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  },
  bgMesh: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '400px',
    background: 'radial-gradient(ellipse at 30% 0%, rgba(167, 139, 250, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(236, 72, 153, 0.1) 0%, transparent 40%)',
    pointerEvents: 'none',
  },
  bgOrb1: {
    position: 'fixed',
    top: '-100px',
    right: '-100px',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
    animation: 'float 8s ease-in-out infinite',
    pointerEvents: 'none',
  },
  bgOrb2: {
    position: 'fixed',
    bottom: '200px',
    left: '-150px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236, 72, 153, 0.06) 0%, transparent 70%)',
    animation: 'float 10s ease-in-out infinite reverse',
    pointerEvents: 'none',
  },
  header: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: 'rgba(250, 251, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 100,
    borderBottom: '1px solid rgba(124, 58, 237, 0.08)',
  },
  headerCompact: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'rgba(250, 251, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    zIndex: 100,
    borderBottom: '1px solid rgba(124, 58, 237, 0.08)',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
  },
  avatarSmall: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
  },
  avatarText: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  avatarTextSmall: {
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
  },
  dateContainer: {
    flex: 1,
    textAlign: 'center',
  },
  dateText: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#1F1F1F',
    letterSpacing: '-0.2px',
  },
  dateTextSmall: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1F1F1F',
  },
  calendarBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
    transition: 'all 0.2s ease',
  },
  calendarBtnSmall: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  scrollContainer: {
    padding: '0 20px',
    paddingBottom: '100px',
  },
  heroCard: {
    position: 'relative',
    marginTop: '16px',
    padding: '24px 20px 20px',
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '28px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
    animation: 'fadeInUp 0.6s ease-out',
  },
  heroCardCompact: {
    position: 'relative',
    marginTop: '8px',
    padding: '16px 16px 14px',
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '24px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    backdropFilter: 'blur(10px)',
    overflow: 'hidden',
    animation: 'fadeInUp 0.6s ease-out',
  },
  heroGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
    animation: 'pulse 4s ease-in-out infinite',
  },
  heroGlowSmall: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 70%)',
  },
  heroContent: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1,
  },
  progressRing: {
    position: 'relative',
    width: '220px',
    height: '220px',
  },
  progressRingSmall: {
    position: 'relative',
    width: '180px',
    height: '180px',
  },
  progressSvg: {
    transform: 'rotate(0deg)',
  },
  progressInner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  progressInnerSmall: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  fastingLabel: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: '#059669',
    marginBottom: '4px',
  },
  fastingLabelSmall: {
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '2px',
    color: '#059669',
    marginBottom: '2px',
  },
  timeDisplay: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '48px',
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: '-2px',
    lineHeight: 1,
  },
  timeDisplaySmall: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '38px',
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: '-2px',
    lineHeight: 1,
  },
  timeDisplayCompact: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '32px',
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: '-1px',
    lineHeight: 1,
  },
  stageText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#059669',
    marginTop: '8px',
  },
  stageTextSmall: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    marginTop: '6px',
  },
  stageDesc: {
    fontSize: '13px',
    color: '#666',
    marginTop: '4px',
  },
  refiningIcon: {
    fontSize: '28px',
    marginBottom: '6px',
    animation: 'pulse 1s ease-in-out infinite',
  },
  refiningText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10B981',
    lineHeight: 1.3,
  },
  refiningTextSmall: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#10B981',
    lineHeight: 1.3,
  },
  refiningIconSmall: {
    fontSize: '24px',
    marginBottom: '4px',
    animation: 'pulse 1s ease-in-out infinite',
  },
  checkInBtnIntegrated: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 20px',
    borderRadius: '20px',
    border: '1.5px solid rgba(124, 58, 237, 0.2)',
    background: 'rgba(124, 58, 237, 0.06)',
    cursor: 'pointer',
    marginTop: '8px',
    marginBottom: '8px',
    fontFamily: "'DM Sans', sans-serif",
  },
  checkInIcon: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#059669',
  },
  checkInText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
  },
  dualButtonsContainer: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
    width: '100%',
    justifyContent: 'center',
  },
  dualButtonsContainerCompact: {
    display: 'flex',
    gap: '10px',
    marginTop: '0px',
    width: '100%',
    justifyContent: 'center',
  },
  dualButtonWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  dualButtonWrapperCompact: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  startFastBtn: {
    position: 'relative',
    padding: '14px 28px',
    background: 'rgba(124, 58, 237, 0.1)',
    border: '2px solid rgba(124, 58, 237, 0.3)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  startFastBtnCompact: {
    position: 'relative',
    padding: '10px 20px',
    background: 'rgba(124, 58, 237, 0.1)',
    border: '2px solid rgba(124, 58, 237, 0.3)',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  endFastBtn: {
    position: 'relative',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(124, 58, 237, 0.2)',
    transition: 'all 0.3s ease',
  },
  endFastBtnCompact: {
    position: 'relative',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: '0 6px 16px rgba(124, 58, 237, 0.35)',
  },
  btnTextDual: {
    position: 'relative',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    zIndex: 1,
  },
  btnTextDualCompact: {
    position: 'relative',
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    zIndex: 1,
  },
  buttonTimeLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '500',
  },
  buttonTimeLabelSmall: {
    fontSize: '11px',
    color: '#666',
    fontWeight: '500',
  },
  dualButtonWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  startFastBtn: {
    position: 'relative',
    padding: '14px 28px',
    background: 'rgba(124, 58, 237, 0.1)',
    border: '2px solid rgba(124, 58, 237, 0.3)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  endFastBtn: {
    position: 'relative',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(124, 58, 237, 0.2)',
    transition: 'all 0.3s ease',
  },
  btnTextDual: {
    position: 'relative',
    fontSize: '14px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    zIndex: 1,
  },
  btnTextStart: {
    color: '#059669',
  },
  btnTextEnd: {
    color: '#fff',
  },
  buttonTimeLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '500',
  },
  timeEditBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  modalContent: {
    width: '100%',
    maxWidth: '430px',
    background: '#fff',
    borderRadius: '28px 28px 0 0',
    padding: '24px',
    paddingBottom: '40px',
    animation: 'slideUp 0.3s ease',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  modalClose: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
  },
  pickerContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  pickerColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  scrollPicker: {
    height: '180px',
    overflowY: 'auto',
    width: '100%',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '4px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '16px',
  },
  pickerItem: {
    padding: '12px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  },
  pickerItemActive: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  saveBtn: {
    width: '100%',
    padding: '18px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
  },
  saveBtnText: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
  },
  planPageOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#FAFBFF',
    zIndex: 1000,
    animation: 'slideInRight 0.3s ease',
  },
  planPage: {
    width: '100%',
    maxWidth: '430px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  planPageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  planPageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  planPageHeaderSub: {
    fontSize: '14px',
    color: '#666',
    margin: '4px 0 0 0',
  },
  closeBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
    flexShrink: 0,
  },
  plansList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 20px',
  },
  planSection: {
    marginTop: '20px',
  },
  sectionHeader: {
    padding: '14px 16px',
    borderRadius: '16px 16px 0 0',
  },
  sectionLabel: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  sectionSub: {
    fontSize: '13px',
    color: '#666',
    margin: '2px 0 0 0',
  },
  planCardsScroll: {
    display: 'flex',
    gap: '10px',
    background: '#fff',
    padding: '12px',
    borderRadius: '0 0 16px 16px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderTop: 'none',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  planCardsWrapper: {
    display: 'flex',
    gap: '10px',
    background: '#fff',
    padding: '12px',
    borderRadius: '0 0 16px 16px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderTop: 'none',
  },
  planCardNew: {
    flexShrink: 0,
    width: '140px',
    padding: '16px',
    borderRadius: '14px',
    border: '2px solid transparent',
    cursor: 'pointer',
    textAlign: 'left',
    position: 'relative',
    transition: 'all 0.2s ease',
  },
  planCardGreen: {
    background: '#ECFDF5',
  },
  planCardYellow: {
    background: '#FFFBEB',
  },
  planCardOrange: {
    background: '#FFF7ED',
  },
  planCardBlue: {
    background: '#EFF6FF',
  },
  planCardPurple: {
    background: '#F5F3FF',
  },
  planCardPink: {
    background: '#FDF2F8',
  },
  planCardSelectedNew: {
    border: '2px solid #059669',
    boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.1)',
  },
  planCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  planRatio: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  planCardText: {
    fontSize: '12px',
    color: '#666',
    lineHeight: 1.4,
    display: 'block',
  },
  selectedCheck: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#059669',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
  },
  plusBadge: {
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  // Check-In Page Styles
  checkInPageOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#F8FAFC',
    zIndex: 1000,
    animation: 'slideInRight 0.3s ease',
  },
  checkInPage: {
    width: '100%',
    maxWidth: '430px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  checkInHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  checkInBackBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  checkInHeaderCenter: {
    textAlign: 'center',
  },
  checkInTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  checkInSubtitle: {
    fontSize: '13px',
    color: '#059669',
    margin: '2px 0 0 0',
    fontWeight: '500',
  },
  checkInNavBtns: {
    display: 'flex',
    gap: '4px',
  },
  checkInNavBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
  },
  searchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '12px 20px',
    padding: '12px 16px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#1F1F1F',
    background: 'transparent',
    fontFamily: "'DM Sans', sans-serif",
  },
  checkInContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 20px',
  },
  checkInSection: {
    marginTop: '20px',
    background: '#fff',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.06)',
  },
  checkInSectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  chipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    padding: '10px 14px',
    borderRadius: '20px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    background: 'rgba(124, 58, 237, 0.04)',
    fontSize: '13px',
    color: '#444',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'DM Sans', sans-serif",
  },
  chipSelected: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    border: '1px solid transparent',
  },
  waterCard: {
    background: 'rgba(124, 58, 237, 0.02)',
    borderRadius: '12px',
    padding: '16px',
  },
  waterCounter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  waterBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  waterDisplay: {
    textAlign: 'center',
  },
  waterAmount: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  waterTotal: {
    fontSize: '14px',
    color: '#999',
    marginLeft: '4px',
  },
  waterLink: {
    display: 'block',
    width: '100%',
    marginTop: '16px',
    padding: '0',
    border: 'none',
    background: 'none',
    fontSize: '13px',
    color: '#059669',
    cursor: 'pointer',
    textAlign: 'center',
    fontFamily: "'DM Sans', sans-serif",
  },
  metricsCard: {
    background: 'rgba(124, 58, 237, 0.02)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  metricInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  metricLabel: {
    fontSize: '14px',
    color: '#1F1F1F',
  },
  metricActions: {
    display: 'flex',
    gap: '8px',
  },
  metricBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.1)',
    fontSize: '12px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  metricLink: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    background: 'none',
    fontSize: '12px',
    color: '#999',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  metricDivider: {
    height: '1px',
    background: 'rgba(0, 0, 0, 0.06)',
    margin: '8px 0',
  },
  notesCard: {
    background: 'rgba(124, 58, 237, 0.02)',
    borderRadius: '12px',
    padding: '12px 16px',
  },
  notesInput: {
    width: '100%',
    minHeight: '100px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#1F1F1F',
    resize: 'none',
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.5,
    background: 'transparent',
  },
  checkInFooter: {
    padding: '16px 20px 32px',
    background: '#fff',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  checkInSaveBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: '14px',
    border: 'none',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
    fontFamily: "'DM Sans', sans-serif",
  },
  // Chat Interface Styles
  chatOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#F8FAFC',
    zIndex: 1000,
    animation: 'slideInRight 0.3s ease',
  },
  chatContainer: {
    width: '100%',
    maxWidth: '430px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#F8FAFC',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    gap: '12px',
  },
  chatBackBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
    flexShrink: 0,
  },
  chatHeaderInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chatAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
  },
  chatHeaderTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  chatHeaderStatus: {
    fontSize: '12px',
    color: '#10B981',
    margin: '2px 0 0 0',
    fontWeight: '500',
  },
  chatMenuBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#666',
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chatBubbleWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
  },
  chatBubbleAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
  },
  chatBubble: {
    maxWidth: '75%',
    padding: '14px 18px',
    borderRadius: '20px',
  },
  chatBubbleAssistant: {
    background: '#fff',
    borderBottomLeftRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  },
  chatBubbleUser: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    borderBottomRightRadius: '4px',
  },
  chatBubbleText: {
    fontSize: '14px',
    lineHeight: 1.5,
    margin: 0,
    color: 'inherit',
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0',
  },
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#999',
    animation: 'bounce 1s infinite',
  },
  chatSuggestions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  chatSuggestionBtn: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: '1px solid rgba(124, 58, 237, 0.2)',
    background: '#fff',
    fontSize: '13px',
    color: '#059669',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: '500',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '12px',
    padding: '16px 20px 32px',
    background: '#fff',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  chatInput: {
    flex: 1,
    padding: '14px 18px',
    borderRadius: '24px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    fontSize: '14px',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    background: '#F8FAFC',
  },
  chatSendBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
  },
  // Progress Tab Styles
  progressTab: {
    width: '100%',
    height: 'calc(100vh - 80px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#F8FAFC',
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  progressHeaderCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  progressTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  progressTitleCompact: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  filterBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  filterBtnSmall: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  timeRangeSelector: {
    display: 'flex',
    gap: '8px',
    padding: '12px 20px',
    background: '#fff',
  },
  timeRangeSelectorCompact: {
    display: 'flex',
    gap: '6px',
    padding: '8px 16px',
    background: '#fff',
  },
  timeRangeBtn: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.04)',
    fontSize: '13px',
    fontWeight: '500',
    color: '#666',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s ease',
  },
  timeRangeBtnCompact: {
    flex: 1,
    padding: '8px 8px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.04)',
    fontSize: '11px',
    fontWeight: '500',
    color: '#666',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  timeRangeBtnActive: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  timeRangeBtnActiveCompact: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  progressContent: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0 20px 20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  progressContentCompact: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '0 16px 20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  progressSection: {
    marginTop: '20px',
  },
  progressSectionCompact: {
    marginTop: '12px',
  },
  progressSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressSectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  progressSectionTitleCompact: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 8px 0',
  },
  seeAllBtnSmall: {
    background: 'none',
    border: 'none',
    color: '#059669',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  twoCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  twoCardGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  overviewTileLarge: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '6px',
  },
  overviewTileCompact: {
    background: '#fff',
    borderRadius: '14px',
    padding: '14px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '2px',
  },
  overviewValueLarge: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  overviewValueCompact: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  overviewLabelLarge: {
    fontSize: '13px',
    color: '#666',
  },
  overviewLabelCompact: {
    fontSize: '11px',
    color: '#666',
  },
  overviewTrendLarge: {
    fontSize: '12px',
    color: '#059669',
    fontWeight: '500',
    marginTop: '4px',
  },
  overviewTrendCompact: {
    fontSize: '10px',
    color: '#059669',
    fontWeight: '500',
  },
  overviewTile: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  overviewValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  overviewLabel: {
    fontSize: '12px',
    color: '#666',
  },
  overviewTrend: {
    fontSize: '11px',
    color: '#059669',
    fontWeight: '500',
    marginTop: '4px',
  },
  chartCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  chartCardCompact: {
    background: '#fff',
    borderRadius: '14px',
    padding: '12px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  streaksGridFour: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  streakItemCompact: {
    textAlign: 'center',
  },
  streakValueCompact: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
    display: 'block',
  },
  streakLabelCompact: {
    fontSize: '9px',
    color: '#666',
    display: 'block',
    marginTop: '2px',
  },
  barChart: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '120px',
    padding: '0 8px',
    position: 'relative',
  },
  barChartCompact: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '80px',
    padding: '0 4px',
    position: 'relative',
  },
  barContainerCompact: {
    width: '100%',
    height: '65px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barLabelSmall: {
    fontSize: '9px',
    color: '#999',
    marginTop: '4px',
  },
  chartLegendCompact: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '8px',
  },
  legendItemSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '9px',
    color: '#666',
  },
  legendDotSmall: {
    width: '6px',
    height: '6px',
    borderRadius: '3px',
  },
  lineChartCompact: {
    marginBottom: '6px',
  },
  xAxisLabelsCompact: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 4px 0',
    borderTop: '1px solid #E5E7EB',
    marginTop: '4px',
  },
  xAxisLabelSmall: {
    fontSize: '9px',
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  weightStatsCompact: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  weightStatCompact: {
    flex: 1,
    background: 'rgba(16, 185, 129, 0.08)',
    borderRadius: '10px',
    padding: '10px',
    textAlign: 'center',
  },
  weightStatValueCompact: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#10B981',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  weightStatLabelCompact: {
    fontSize: '9px',
    color: '#666',
    display: 'block',
    marginTop: '2px',
  },
  weightActionsCompact: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
  },
  weightActionBtnCompact: {
    flex: 1,
    padding: '8px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  weightActionLinkCompact: {
    flex: 1,
    padding: '8px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  barChartWithAvg: {
    position: 'relative',
  },
  avgLineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '28px',
    pointerEvents: 'none',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '2px',
    background: '#F59E0B',
    display: 'flex',
    alignItems: 'center',
  },
  avgLineBlue: {
    background: '#3B82F6',
  },
  avgLineLabel: {
    position: 'absolute',
    right: '0',
    top: '-18px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#F59E0B',
    background: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  goalLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '2px',
    background: '#10B981',
    borderStyle: 'dashed',
  },
  goalLineLabel: {
    position: 'absolute',
    left: '0',
    top: '-18px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#10B981',
    background: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  barValue: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '4px',
    textAlign: 'center',
  },
  xAxisLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 8px 0',
    borderTop: '1px solid #E5E7EB',
    marginTop: '8px',
  },
  xAxisLabel: {
    fontSize: '11px',
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  barGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  barContainer: {
    width: '100%',
    height: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '70%',
    maxWidth: '30px',
    borderRadius: '6px 6px 2px 2px',
    transition: 'height 0.3s ease',
  },
  goalLine: {
    position: 'absolute',
    top: '28%',
    left: 0,
    right: 0,
    height: '2px',
    background: '#E5E7EB',
    borderRadius: '1px',
  },
  barLabel: {
    fontSize: '11px',
    color: '#999',
    fontWeight: '500',
  },
  chartLegend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#666',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
  },
  lineChart: {
    width: '100%',
    marginBottom: '12px',
  },
  chartInsight: {
    fontSize: '13px',
    color: '#666',
    margin: 0,
    padding: '12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '10px',
  },
  weightStats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
  },
  weightStat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(16, 185, 129, 0.08)',
    borderRadius: '10px',
  },
  weightStatValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#10B981',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  weightStatLabel: {
    fontSize: '11px',
    color: '#666',
    marginTop: '2px',
  },
  weightActions: {
    display: 'flex',
    gap: '8px',
  },
  weightActionBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.1)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  weightActionLink: {
    flex: 1,
    padding: '10px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    color: '#666',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  waterStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
  },
  waterStatItem: {
    fontSize: '12px',
    color: '#666',
  },
  hungerDistribution: {
    marginBottom: '16px',
  },
  hungerLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#444',
    display: 'block',
    marginBottom: '10px',
  },
  hungerBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  hungerBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  hungerBarLabel: {
    fontSize: '12px',
    color: '#666',
    width: '60px',
  },
  hungerBarBg: {
    flex: 1,
    height: '8px',
    background: 'rgba(124, 58, 237, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  hungerBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #059669 0%, #A855F7 100%)',
    borderRadius: '4px',
  },
  hungerBarPercent: {
    fontSize: '12px',
    color: '#666',
    width: '35px',
    textAlign: 'right',
  },
  symptomsList: {
    marginBottom: '12px',
  },
  symptomsLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#444',
    display: 'block',
    marginBottom: '10px',
  },
  symptomTags: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  symptomTag: {
    padding: '8px 12px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#444',
  },
  moodGrid: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  moodItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  moodEmoji: {
    fontSize: '28px',
    marginBottom: '8px',
  },
  moodLabel: {
    fontSize: '11px',
    color: '#666',
  },
  moodValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    marginTop: '2px',
  },
  streaksGrid: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  streakItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  streakValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#059669',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  streakLabel: {
    fontSize: '11px',
    color: '#666',
    textAlign: 'center',
  },
  streakProgress: {
    marginTop: '8px',
  },
  streakProgressBar: {
    height: '8px',
    background: 'rgba(124, 58, 237, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  streakProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #059669 0%, #A855F7 100%)',
    borderRadius: '4px',
  },
  streakProgressText: {
    fontSize: '12px',
    color: '#666',
    display: 'block',
    textAlign: 'center',
    marginTop: '8px',
  },
  weeklySummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  weeklySummaryItem: {
    padding: '12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
    textAlign: 'center',
  },
  weeklySummaryValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  weeklySummaryLabel: {
    fontSize: '11px',
    color: '#666',
    display: 'block',
    marginTop: '4px',
  },
  viewDetailsBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.1)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  insightsCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '12px',
  },
  insightCard: {
    padding: '14px 16px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
  },
  insightText: {
    fontSize: '13px',
    color: '#444',
    lineHeight: 1.4,
  },
  exploreInsightsBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  exportCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    fontSize: '14px',
    color: '#444',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  // Weight Page Styles
  weightPageOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#F8FAFC',
    zIndex: 1100,
    animation: 'slideInRight 0.3s ease',
  },
  weightPage: {
    width: '100%',
    maxWidth: '430px',
    margin: '0 auto',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  weightPageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  weightBackBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(124, 58, 237, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  weightPageTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  weightPageContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  weightInputSection: {
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },
  weightInputTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 16px 0',
  },
  unitToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  unitBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    background: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s ease',
  },
  unitBtnActive: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    border: '1px solid transparent',
  },
  weightInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#fff',
    borderRadius: '12px',
    padding: '4px 16px 4px 4px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    marginBottom: '16px',
  },
  weightInput: {
    flex: 1,
    padding: '14px 12px',
    border: 'none',
    outline: 'none',
    fontSize: '24px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
    background: 'transparent',
  },
  weightInputUnit: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#999',
  },
  saveWeightBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  pastLogsSection: {
    marginTop: '8px',
  },
  pastLogsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  logItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  },
  logInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  logDate: {
    fontSize: '12px',
    color: '#999',
  },
  logWeight: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  logActions: {
    display: 'flex',
    gap: '8px',
  },
  logDeleteBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(239, 68, 68, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#EF4444',
  },
  // Sleek Weight Input Styles
  weightInputSleek: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
  },
  weightDashContainer: {
    position: 'relative',
    width: '220px',
    height: '220px',
  },
  weightDashCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  weightInputLarge: {
    width: '120px',
    fontSize: '48px',
    fontWeight: '700',
    fontFamily: "'Space Grotesk', sans-serif",
    textAlign: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1F1F1F',
    outline: 'none',
  },
  unitDropdown: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 14px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: '1.5px solid rgba(124, 58, 237, 0.2)',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  unitDropdownText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  saveWeightBtnSleek: {
    width: '100%',
    maxWidth: '280px',
    padding: '16px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    marginTop: '24px',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)',
  },
  saveWeightBtnText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  // Sleek Past Logs Styles
  pastLogsSleek: {
    padding: '0 20px 20px',
  },
  pastLogsTitleSleek: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: '12px',
  },
  logsListSleek: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  logItemSleek: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  logItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logDateBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDateDay: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#059669',
  },
  logItemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  logWeightSleek: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  logDateFull: {
    fontSize: '12px',
    color: '#888',
  },
  logItemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logDiff: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '8px',
  },
  logDeleteBtnSleek: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    background: 'rgba(239, 68, 68, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#EF4444',
  },
  // Compact Weight Input Styles
  weightInputCompact: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 20px 16px',
  },
  weightDashContainerSmall: {
    position: 'relative',
    width: '160px',
    height: '160px',
  },
  weightDashCenterSmall: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  weightInputMedium: {
    width: '90px',
    fontSize: '36px',
    fontWeight: '700',
    fontFamily: "'Space Grotesk', sans-serif",
    textAlign: 'center',
    border: 'none',
    background: 'transparent',
    color: '#1F1F1F',
    outline: 'none',
  },
  unitDropdownSmall: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 10px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: '1px solid rgba(124, 58, 237, 0.15)',
    borderRadius: '14px',
    cursor: 'pointer',
  },
  unitDropdownTextSmall: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#059669',
  },
  saveWeightBtnCompact: {
    width: '100%',
    maxWidth: '200px',
    padding: '12px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    marginTop: '12px',
    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.25)',
  },
  saveWeightBtnTextSmall: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  },
  // Weight Statistics Section
  weightStatsSection: {
    padding: '0 20px 16px',
  },
  weightStatsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  weightStatsSectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: 0,
  },
  weightStatsDropdownContainer: {
    position: 'relative',
  },
  weightStatsDropdownBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: '1px solid rgba(124, 58, 237, 0.15)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    color: '#059669',
  },
  weightStatsDropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '120px',
  },
  weightStatsDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#444',
    fontFamily: "'DM Sans', sans-serif",
  },
  weightStatsDropdownItemActive: {
    background: 'rgba(124, 58, 237, 0.08)',
    color: '#059669',
    fontWeight: '600',
  },
  weightStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '10px',
  },
  weightStatCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '10px 6px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  weightStatIcon: {
    fontSize: '16px',
    display: 'block',
    marginBottom: '4px',
  },
  weightStatCardValue: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  weightStatCardLabel: {
    fontSize: '8px',
    color: '#888',
    display: 'block',
    marginTop: '2px',
  },
  weightStatsMini: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '10px',
    padding: '10px',
    gap: '12px',
  },
  weightStatMiniItem: {
    textAlign: 'center',
  },
  weightStatMiniLabel: {
    fontSize: '10px',
    color: '#888',
    display: 'block',
  },
  weightStatMiniValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  weightStatMiniDivider: {
    width: '1px',
    height: '24px',
    background: 'rgba(124, 58, 237, 0.15)',
  },
  // Compact Past Logs
  pastLogsCompact: {
    padding: '0 20px 20px',
  },
  pastLogsHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  pastLogsTitleCompact: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: 0,
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#059669',
    fontSize: '12px',
    fontWeight: '600',
  },
  logsListCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  logItemCompact: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid rgba(124, 58, 237, 0.06)',
  },
  logItemLeftCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logDateBadgeSmall: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDateDaySmall: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#059669',
  },
  logItemInfoCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  logWeightCompact: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  logDateCompact: {
    fontSize: '10px',
    color: '#888',
  },
  logItemRightCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logDiffSmall: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '6px',
  },
  logDeleteBtnSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(239, 68, 68, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#EF4444',
  },
  // Fasting Details Page Styles
  detailSection: {
    marginBottom: '16px',
  },
  detailSectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: '10px',
  },
  detailCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  detailCard: {
    background: '#fff',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    textAlign: 'center',
  },
  detailCardEmoji: {
    fontSize: '24px',
    display: 'block',
    marginBottom: '6px',
  },
  detailCardValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
    display: 'block',
  },
  detailCardLabel: {
    fontSize: '11px',
    color: '#666',
    display: 'block',
    marginTop: '4px',
  },
  detailCardFull: {
    background: '#fff',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  trendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '10px',
    marginBottom: '10px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
  },
  trendLabel: {
    fontSize: '13px',
    color: '#666',
  },
  trendValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  trendValuePositive: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#10B981',
  },
  trendValueNegative: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#EF4444',
  },
  bodyResponseItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  bodyResponseLabel: {
    fontSize: '12px',
    color: '#666',
    width: '100px',
    flexShrink: 0,
  },
  bodyResponseBar: {
    flex: 1,
    height: '8px',
    background: 'rgba(0, 0, 0, 0.06)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  bodyResponseFill: {
    height: '100%',
    borderRadius: '4px',
  },
  bodyResponseValue: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#1F1F1F',
    width: '60px',
    textAlign: 'right',
  },
  symptomTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  symptomTag: {
    padding: '6px 12px',
    background: 'rgba(239, 68, 68, 0.08)',
    borderRadius: '20px',
    fontSize: '11px',
    color: '#EF4444',
    fontWeight: '500',
  },
  symptomTagGood: {
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.08)',
    borderRadius: '20px',
    fontSize: '11px',
    color: '#10B981',
    fontWeight: '500',
  },
  symptomInsight: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
    padding: '10px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '8px',
  },
  // Bar chart for details page
  barChartDetail: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100px',
    padding: '0 4px',
    position: 'relative',
  },
  barChartTall: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '140px',
    padding: '0 4px',
    position: 'relative',
  },
  barContainerDetail: {
    width: '100%',
    height: '80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barContainerTall: {
    width: '100%',
    height: '120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  avgLineContainerTall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '24px',
    pointerEvents: 'none',
  },
  trendDivider: {
    height: '1px',
    background: 'rgba(0, 0, 0, 0.06)',
    margin: '16px 0',
  },
  // Time range filter for Fasting Details page
  detailsTimeRange: {
    display: 'flex',
    gap: '6px',
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  },
  detailsTimeBtn: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: '10px',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.04)',
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  detailsTimeBtnActive: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    color: '#fff',
    fontWeight: '600',
  },
  // BMI Display Styles
  bmiDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  bmiValueContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  bmiValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  bmiCategory: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#10B981',
    padding: '4px 10px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '6px',
  },
  bmiWeightInfo: {
    textAlign: 'right',
  },
  bmiWeightLabel: {
    fontSize: '10px',
    color: '#666',
    display: 'block',
  },
  bmiWeightValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  bmiBarContainer: {
    marginTop: '8px',
  },
  bmiBar: {
    height: '10px',
    borderRadius: '5px',
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  bmiBarUnderweight: {
    width: '17.5%',
    background: '#3B82F6',
  },
  bmiBarNormal: {
    width: '32.5%',
    background: '#10B981',
  },
  bmiBarOverweight: {
    width: '25%',
    background: '#F59E0B',
  },
  bmiBarObese: {
    width: '25%',
    background: '#EF4444',
  },
  bmiIndicator: {
    position: 'absolute',
    top: '-3px',
    width: '4px',
    height: '16px',
    background: '#1F1F1F',
    borderRadius: '2px',
    transform: 'translateX(-50%)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  bmiLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
  },
  bmiLabel: {
    fontSize: '8px',
    color: '#888',
    textAlign: 'center',
    flex: 1,
  },
  // BMI Details Page Styles
  bmiDisplayLarge: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  bmiValueContainerLarge: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  bmiValueLarge: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
    lineHeight: 1,
  },
  bmiCategoryLarge: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10B981',
  },
  bmiMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  bmiMetricItem: {
    textAlign: 'center',
  },
  bmiMetricValue: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F1F1F',
    display: 'block',
  },
  bmiMetricLabel: {
    fontSize: '11px',
    color: '#666',
  },
  bmiMetricDivider: {
    width: '1px',
    height: '30px',
    background: 'rgba(0,0,0,0.1)',
  },
  bmiBarContainerLarge: {
    marginTop: '16px',
  },
  bmiBarLarge: {
    height: '14px',
    borderRadius: '7px',
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  bmiBarUnderweightLarge: {
    width: '17.5%',
    background: '#3B82F6',
  },
  bmiBarNormalLarge: {
    width: '32.5%',
    background: '#10B981',
  },
  bmiBarOverweightLarge: {
    width: '25%',
    background: '#F59E0B',
  },
  bmiBarObeseLarge: {
    width: '25%',
    background: '#EF4444',
  },
  bmiIndicatorLarge: {
    position: 'absolute',
    top: '-4px',
    width: '6px',
    height: '22px',
    background: '#1F1F1F',
    borderRadius: '3px',
    transform: 'translateX(-50%)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  bmiScaleNumbers: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '10px',
    color: '#888',
  },
  bmiLabelsLarge: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '4px',
  },
  bmiLabelLarge: {
    fontSize: '10px',
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  bmiActionsRow: {
    display: 'flex',
    gap: '10px',
  },
  bmiActionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#fff',
  },
  bmiActionBtnOutline: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: '1.5px solid rgba(124, 58, 237, 0.2)',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#059669',
  },
  bmiActionIcon: {
    fontSize: '18px',
  },
  bmiActionText: {
    fontSize: '14px',
    fontWeight: '600',
  },
  bmiInfoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '12px',
    marginBottom: '12px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
  },
  bmiInfoDot: {
    width: '12px',
    height: '12px',
    borderRadius: '4px',
  },
  bmiInfoLabel: {
    flex: 1,
    fontSize: '14px',
    color: '#1F1F1F',
  },
  bmiInfoRange: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
  },
  // Calorie Intake Styles
  calorieChartContainer: {
    marginBottom: '6px',
  },
  calorieStatsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '10px',
    padding: '10px',
    marginTop: '10px',
    gap: '20px',
  },
  calorieStatItem: {
    textAlign: 'center',
  },
  calorieStatValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  calorieStatLabel: {
    fontSize: '10px',
    color: '#888',
  },
  calorieStatDivider: {
    width: '1px',
    height: '28px',
    background: 'rgba(124, 58, 237, 0.15)',
  },
  // Calorie Details Page Styles
  calorieStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  calorieStatCard: {
    background: '#fff',
    borderRadius: '14px',
    padding: '14px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  calorieStatCardIcon: {
    fontSize: '20px',
    display: 'block',
    marginBottom: '6px',
  },
  calorieStatCardValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  calorieStatCardLabel: {
    fontSize: '10px',
    color: '#888',
    display: 'block',
    marginTop: '2px',
  },
  macroChartContainer: {
    marginBottom: '8px',
  },
  macroStatsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '10px 0 0',
    borderTop: '1px solid rgba(0,0,0,0.04)',
  },
  macroStatItem: {
    textAlign: 'center',
  },
  macroStatValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  macroStatLabel: {
    fontSize: '10px',
    color: '#888',
  },
  macroDistribution: {
    padding: '8px 0',
  },
  macroDistBar: {
    display: 'flex',
    height: '14px',
    borderRadius: '7px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  macroDistSegment: {
    height: '100%',
  },
  macroDistLegend: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  macroDistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  macroDistDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
  },
  macroDistLabel: {
    fontSize: '12px',
    color: '#444',
    fontWeight: '500',
  },
  // Compact Calorie Details Styles
  calorieStatsGridCompact: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  calorieStatCardCompact: {
    background: '#fff',
    borderRadius: '10px',
    padding: '10px 6px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  calorieStatCardIconSmall: {
    fontSize: '16px',
    display: 'block',
    marginBottom: '4px',
  },
  calorieStatCardValueSmall: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  calorieStatCardLabelSmall: {
    fontSize: '8px',
    color: '#888',
    display: 'block',
    marginTop: '2px',
  },
  macroCardCompact: {
    background: '#fff',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  macroChartContainerSmall: {
    marginBottom: '6px',
  },
  macroStatsRowCompact: {
    display: 'flex',
    justifyContent: 'space-around',
    paddingTop: '8px',
    borderTop: '1px solid rgba(0,0,0,0.04)',
  },
  macroStatItemCompact: {
    textAlign: 'center',
  },
  macroStatValueSmall: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#1F1F1F',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  macroStatLabelSmall: {
    fontSize: '9px',
    color: '#888',
  },
  macroDistBarCompact: {
    display: 'flex',
    height: '10px',
    borderRadius: '5px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  macroDistLegendCompact: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  macroDistItemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  macroDistDotSmall: {
    width: '8px',
    height: '8px',
    borderRadius: '2px',
  },
  macroDistLabelSmall: {
    fontSize: '10px',
    color: '#444',
    fontWeight: '500',
  },
  // Compact Hunger Section Styles
  hungerLabelSmall: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1F1F1F',
    display: 'block',
    marginBottom: '8px',
  },
  hungerBarsCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  hungerBarRowCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  hungerBarLabelSmall: {
    fontSize: '10px',
    color: '#666',
    width: '50px',
  },
  hungerBarBgSmall: {
    flex: 1,
    height: '6px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  hungerBarFillSmall: {
    height: '100%',
    background: 'linear-gradient(90deg, #8B5CF6 0%, #A855F7 100%)',
    borderRadius: '3px',
  },
  hungerBarPercentSmall: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#059669',
    width: '30px',
    textAlign: 'right',
  },
  symptomsListCompact: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(0, 0, 0, 0.04)',
  },
  symptomsLabelSmall: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1F1F1F',
    display: 'block',
    marginBottom: '8px',
  },
  symptomTagsCompact: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  symptomTagSmall: {
    padding: '5px 10px',
    background: 'rgba(124, 58, 237, 0.06)',
    borderRadius: '8px',
    fontSize: '10px',
    color: '#666',
  },
  // Meals Tab Styles
  mealsContainerClean: {
    padding: '60px 20px 20px',
    minHeight: '100vh',
    background: '#FAFAFA',
  },
  mealsDateHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0 12px',
  },
  mealsDateArrow: {
    width: '36px',
    height: '36px',
    borderRadius: '18px',
    background: '#fff',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  mealsDateDisplay: {
    textAlign: 'center',
  },
  mealsDateText: {
    display: 'block',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  mealsDateFull: {
    display: 'block',
    fontSize: '12px',
    color: '#888',
    marginTop: '2px',
  },
  cutlerySection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 0 16px',
  },
  cutleryContainer: {
    position: 'relative',
    width: '180px',
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutleryGlowOuter: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    borderRadius: '90px',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
    animation: 'pulse 3s ease-in-out infinite',
  },
  cutleryGlowMiddle: {
    position: 'absolute',
    width: '160px',
    height: '160px',
    borderRadius: '80px',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)',
    animation: 'pulse 3s ease-in-out infinite 0.5s',
  },
  cutleryGlowInner: {
    position: 'absolute',
    width: '140px',
    height: '140px',
    borderRadius: '70px',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%)',
    animation: 'pulse 3s ease-in-out infinite 1s',
  },
  cutleryCircle: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutleryIcon: {
    fontSize: '140px',
    filter: 'drop-shadow(0 8px 24px rgba(124, 58, 237, 0.3)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
  },
  logMealBtnIntegrated: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
  },
  logMealBtnIcon: {
    fontSize: '18px',
    fontWeight: '300',
    color: '#fff',
    width: '22px',
    height: '22px',
    borderRadius: '11px',
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  logMealBtnText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
  },
  // Log Meal Options Page - Full Screen with Rotating Options
  logMealOptionsPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, #FAFAFA 0%, #F3E8FF 100%)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logMealOptionsPageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '16px 20px',
    paddingTop: '60px',
  },
  logMealOptionsBackBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    background: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  logMealOptionsPageTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: 0,
  },
  rotatingOptionsContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    marginTop: '30px',
    height: '300px',
  },
  rotatingOptionsCircle: {
    position: 'relative',
    width: '280px',
    height: '280px',
    animation: 'rotateCircle 30s linear infinite',
  },
  rotatingOption: {
    position: 'absolute',
    width: '70px',
    height: '70px',
    borderRadius: '16px',
    background: '#fff',
    border: '2px solid rgba(124, 58, 237, 0.15)',
    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    animation: 'counterRotate 30s linear infinite',
  },
  rotatingOptionIcon: {
    fontSize: '24px',
  },
  rotatingOptionText: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#059669',
  },
  rotatingCenterIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90px',
    height: '90px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatingCenterEmoji: {
    fontSize: '70px',
    filter: 'drop-shadow(0 8px 24px rgba(124, 58, 237, 0.25))',
  },
  rotatingHelpText: {
    fontSize: '14px',
    color: '#888',
    marginTop: '20px',
    textAlign: 'center',
  },
  // New Log Meal Options Grid
  logMealOptionsGridNew: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    padding: '20px',
    marginTop: '20px',
  },
  logMealOptionCardNew: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '24px 16px',
    background: '#fff',
    border: '2px solid rgba(124, 58, 237, 0.1)',
    borderRadius: '20px',
    boxShadow: '0 4px 16px rgba(124, 58, 237, 0.08)',
    cursor: 'pointer',
  },
  logMealOptionCardIconNew: {
    fontSize: '36px',
  },
  logMealOptionCardTitleNew: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  // Recipe Page Styles
  recipePageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#FAFAFA',
    zIndex: 100,
    overflow: 'hidden',
  },
  recipePage: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  recipePageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    paddingTop: '60px',
    background: '#fff',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  },
  recipeBackBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#059669',
  },
  recipePageTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: 0,
  },
  recipePageContent: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  makeRecipeOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  makeRecipeOptionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '18px',
    background: '#fff',
    border: '2px solid rgba(124, 58, 237, 0.1)',
    borderRadius: '16px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  makeRecipeOptionIcon: {
    fontSize: '32px',
  },
  makeRecipeOptionText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  makeRecipeOptionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  makeRecipeOptionDesc: {
    fontSize: '12px',
    color: '#888',
  },
  recipeSection: {
    marginBottom: '24px',
  },
  recipeSectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  recipeSectionSubtitle: {
    fontSize: '12px',
    color: '#888',
    margin: '-8px 0 12px 0',
  },
  quickIdeasList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  quickIdeaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  quickIdeaEmoji: {
    fontSize: '28px',
  },
  quickIdeaInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  quickIdeaName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  quickIdeaIngredients: {
    fontSize: '11px',
    color: '#888',
  },
  quickIdeaBenefit: {
    fontSize: '11px',
    color: '#10B981',
    fontWeight: '500',
  },
  quickIdeaTime: {
    fontSize: '12px',
    color: '#059669',
    fontWeight: '600',
  },
  recipeSearchBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: '#fff',
    borderRadius: '14px',
    border: '1.5px solid rgba(124, 58, 237, 0.1)',
    marginBottom: '16px',
  },
  recipeSearchInputNew: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    background: 'transparent',
  },
  cuisineFiltersSection: {
    marginBottom: '20px',
  },
  cuisineFiltersScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  // Settings Tab Styles
  settingsContainer: {
    padding: '60px 20px 20px',
    minHeight: '100vh',
    background: '#FAFAFA',
  },
  settingsProfileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
    marginBottom: '20px',
  },
  settingsProfileAvatar: {
    width: '60px',
    height: '60px',
    borderRadius: '30px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsProfileInitial: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
  },
  settingsProfileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  settingsProfileName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  settingsProfileEmail: {
    fontSize: '13px',
    color: '#888',
  },
  settingsEditBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  settingsSection: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  settingsSectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 16px 0',
  },
  settingsItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  },
  settingsItemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  settingsItemLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1F1F1F',
  },
  settingsItemDesc: {
    fontSize: '11px',
    color: '#888',
  },
  settingsSelect: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    background: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    outline: 'none',
  },
  settingsToggleOn: {
    width: '50px',
    height: '28px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  settingsToggleOff: {
    width: '50px',
    height: '28px',
    borderRadius: '14px',
    background: '#E5E5E5',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  settingsToggleKnobOn: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  settingsToggleKnobOff: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    background: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  settingsInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  settingsInput: {
    width: '70px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'right',
    outline: 'none',
  },
  settingsInputUnit: {
    fontSize: '12px',
    color: '#888',
    fontWeight: '500',
  },
  settingsMacroRow: {
    display: 'flex',
    gap: '12px',
    padding: '12px 0',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  },
  settingsMacroItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  settingsMacroLabel: {
    fontSize: '11px',
    color: '#888',
    fontWeight: '500',
  },
  settingsMacroInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  settingsMacroInput: {
    width: '50px',
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'center',
    outline: 'none',
  },
  settingsMacroUnit: {
    fontSize: '11px',
    color: '#888',
  },
  settingsSegmentedControl: {
    display: 'flex',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '10px',
    padding: '3px',
  },
  settingsSegment: {
    padding: '6px 16px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    fontSize: '12px',
    fontWeight: '600',
    color: '#888',
    cursor: 'pointer',
  },
  settingsSegmentActive: {
    padding: '6px 16px',
    borderRadius: '8px',
    border: 'none',
    background: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
  },
  settingsActionItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    background: 'transparent',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
  },
  settingsActionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  settingsActionIcon: {
    fontSize: '20px',
  },
  settingsActionLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1F1F1F',
  },
  settingsVersion: {
    textAlign: 'center',
    padding: '20px 0',
  },
  settingsVersionText: {
    display: 'block',
    fontSize: '13px',
    color: '#888',
  },
  settingsVersionSub: {
    display: 'block',
    fontSize: '11px',
    color: '#aaa',
    marginTop: '4px',
  },
  // Edit Profile Modal
  editProfileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  editProfileCard: {
    width: '100%',
    maxWidth: '340px',
    background: '#fff',
    borderRadius: '24px',
    padding: '24px',
  },
  editProfileHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  editProfileTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: 0,
  },
  editProfileClose: {
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    background: 'rgba(0, 0, 0, 0.05)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  editProfileAvatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  editProfileAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '40px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileAvatarInitial: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
  },
  editProfileAvatarBtn: {
    padding: '8px 16px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
  },
  editProfileForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '24px',
  },
  editProfileField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  editProfileLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#888',
  },
  editProfileInput: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    fontSize: '14px',
    color: '#1F1F1F',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  editProfileSaveBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
  },
  nutritionCardClean: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    borderRadius: '20px',
    padding: '18px 20px',
    marginBottom: '12px',
  },
  nutritionTitleClean: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    margin: '0 0 14px 0',
  },
  nutritionStatsClean: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nutritionStatClean: {
    textAlign: 'center',
    flex: 1,
  },
  nutritionValueClean: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  nutritionLabelClean: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  nutritionDividerClean: {
    width: '1px',
    height: '30px',
    background: 'rgba(255, 255, 255, 0.2)',
  },
  recentMealsSectionClean: {
    background: '#fff',
    borderRadius: '20px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  recentMealsTitleClean: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  recentMealsListClean: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  recentMealItemClean: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  recentMealLeftClean: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  recentMealIconClean: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  recentMealInfoClean: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recentMealNameClean: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  recentMealTimeClean: {
    fontSize: '10px',
    color: '#888',
  },
  recentMealRightClean: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  recentMealCaloriesClean: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
  },
  // Trending Section Styles
  trendingSection: {
    background: '#fff',
    borderRadius: '20px',
    padding: '16px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
    marginBottom: '12px',
  },
  trendingSectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  trendingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  trendingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  trendingRank: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#059669',
    minWidth: '28px',
  },
  trendingEmoji: {
    fontSize: '24px',
  },
  trendingInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  trendingName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  trendingMeta: {
    fontSize: '10px',
    color: '#888',
  },
  mealsContainer: {
    padding: '60px 20px 20px',
    minHeight: '100vh',
    background: '#FAFAFA',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  mealsHeader: {
    marginBottom: '20px',
  },
  mealsTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1F1F1F',
    fontFamily: "'Space Grotesk', sans-serif",
    margin: 0,
  },
  mealsSubtitle: {
    fontSize: '14px',
    color: '#888',
    marginTop: '4px',
  },
  mealsSectionToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    background: 'rgba(124, 58, 237, 0.06)',
    padding: '4px',
    borderRadius: '14px',
  },
  mealsSectionBtn: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '10px',
    background: 'transparent',
    fontSize: '14px',
    fontWeight: '600',
    color: '#888',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  mealsSectionBtnActive: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    fontFamily: "'DM Sans', sans-serif",
  },
  mealsSectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  logMealCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  logMealHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  logMealIcon: {
    fontSize: '32px',
  },
  logMealTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  logMealSubtitle: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  logMealOptions: {
    display: 'flex',
    gap: '10px',
  },
  logMealOptionBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px 12px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    borderRadius: '14px',
    cursor: 'pointer',
  },
  logMealOptionIcon: {
    fontSize: '24px',
  },
  logMealOptionText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  logMealOptionDesc: {
    fontSize: '10px',
    color: '#888',
  },
  recentMealsSection: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  recentMealsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  recentMealsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  recentMealItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  recentMealLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  recentMealIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  recentMealInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recentMealName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  recentMealTime: {
    fontSize: '11px',
    color: '#888',
  },
  recentMealRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  recentMealCalories: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  mealsSummaryCard: {
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    borderRadius: '20px',
    padding: '20px',
  },
  mealsSummaryTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: '0 0 16px 0',
  },
  mealsSummaryStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealsSummaryStat: {
    textAlign: 'center',
  },
  mealsSummaryValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  mealsSummaryLabel: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  mealsSummaryDivider: {
    width: '1px',
    height: '30px',
    background: 'rgba(255, 255, 255, 0.2)',
  },
  // Recipe Section Styles
  recipeActionCard: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  recipeActionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  recipeActionIcon: {
    fontSize: '32px',
  },
  recipeActionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
  },
  recipeActionSubtitle: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  recipeActionOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  recipeActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px',
    background: 'rgba(124, 58, 237, 0.04)',
    border: '1.5px solid rgba(124, 58, 237, 0.1)',
    borderRadius: '14px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  recipeActionBtnIcon: {
    fontSize: '28px',
  },
  recipeActionBtnText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recipeActionBtnTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  recipeActionBtnDesc: {
    fontSize: '11px',
    color: '#888',
  },
  findRecipeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(124, 58, 237, 0.06)',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#888',
    marginBottom: '12px',
  },
  cuisineFilters: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  cuisineFilter: {
    padding: '8px 14px',
    background: 'rgba(0, 0, 0, 0.04)',
    border: 'none',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  cuisineFilterActive: {
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '20px',
    fontSize: '12px',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: '600',
  },
  savedRecipesSection: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  savedRecipesTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  savedRecipesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  savedRecipeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  savedRecipeImage: {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  savedRecipeInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  savedRecipeName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  savedRecipeMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    color: '#888',
  },
  savedRecipeTime: {},
  savedRecipeCalories: {},
  // Log Meal Modal Styles
  logMealContent: {
    padding: '20px',
  },
  cameraPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(168, 85, 247, 0.06) 100%)',
    borderRadius: '20px',
    border: '2px dashed rgba(124, 58, 237, 0.2)',
  },
  cameraIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  cameraText: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '20px',
  },
  cameraBtn: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  mealInputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  mealInputLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  mealTextarea: {
    width: '100%',
    minHeight: '120px',
    padding: '16px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    borderRadius: '14px',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    resize: 'none',
    outline: 'none',
  },
  analyzeMealBtn: {
    padding: '16px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  voiceInputContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
  },
  voiceInputContainerNew: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    gap: '24px',
  },
  transcriptionBox: {
    width: '100%',
    minHeight: '100px',
    padding: '16px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '16px',
    border: '1.5px solid rgba(124, 58, 237, 0.1)',
    position: 'relative',
  },
  transcriptionText: {
    fontSize: '16px',
    color: '#1F1F1F',
    lineHeight: 1.5,
    margin: 0,
  },
  transcriptionPlaceholder: {
    fontSize: '14px',
    color: '#aaa',
    margin: 0,
    fontStyle: 'italic',
  },
  recordingWaves: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginTop: '16px',
  },
  recordingWave: {
    width: '4px',
    height: '20px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    borderRadius: '2px',
    animation: 'soundWave 0.5s ease-in-out infinite alternate',
  },
  microphoneSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  microphoneButtonNew: {
    width: '100px',
    height: '100px',
    borderRadius: '50px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(124, 58, 237, 0.35)',
    transition: 'all 0.2s ease',
  },
  microphoneHint: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  processingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderRadius: '12px',
  },
  processingSpinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(124, 58, 237, 0.2)',
    borderTopColor: '#059669',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  processingText: {
    fontSize: '14px',
    color: '#059669',
    fontWeight: '500',
  },
  microphoneCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '60px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)',
  },
  microphoneIcon: {
    fontSize: '48px',
  },
  voiceText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '20px',
  },
  voiceBtn: {
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  detectedFoodsSection: {
    marginTop: '24px',
    padding: '20px',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  },
  detectedFoodsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 16px 0',
  },
  detectedFoodsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  detectedFoodItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '10px',
  },
  detectedFoodInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  detectedFoodName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  detectedFoodPortion: {
    fontSize: '12px',
    color: '#888',
  },
  detectedFoodCalories: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  detectedFoodsTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  detectedFoodsTotalValue: {
    color: '#059669',
    fontSize: '18px',
  },
  saveMealBtn: {
    width: '100%',
    marginTop: '20px',
    padding: '16px',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Recipe Modal Styles
  generatedRecipes: {
    marginTop: '24px',
    textAlign: 'center',
  },
  generatedRecipesTitle: {
    fontSize: '14px',
    color: '#888',
  },
  voiceInputRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  voiceMiniBtn: {
    padding: '8px 16px',
    background: 'rgba(124, 58, 237, 0.08)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#059669',
    cursor: 'pointer',
    fontWeight: '600',
  },
  suggestedRecipes: {
    marginTop: '24px',
  },
  suggestedRecipesTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  suggestedRecipesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  suggestedRecipeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '12px',
  },
  suggestedRecipeEmoji: {
    fontSize: '32px',
  },
  suggestedRecipeInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  suggestedRecipeName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  suggestedRecipeMeta: {
    fontSize: '12px',
    color: '#888',
  },
  // Find Recipe Modal Styles
  recipeSearchContainer: {
    padding: '20px',
  },
  recipeSearchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: '#fff',
    borderRadius: '14px',
    border: '1.5px solid rgba(124, 58, 237, 0.15)',
    marginBottom: '20px',
  },
  recipeSearchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
  },
  voiceSearchBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
  },
  cuisineFiltersLarge: {
    marginBottom: '24px',
  },
  cuisineFiltersTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  cuisineFiltersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
  },
  cuisineGridItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px 10px',
    background: 'rgba(124, 58, 237, 0.04)',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  cuisineGridEmoji: {
    fontSize: '24px',
  },
  cuisineGridName: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#444',
  },
  popularRecipes: {
    marginTop: '24px',
  },
  popularRecipesTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 12px 0',
  },
  popularRecipesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  popularRecipeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  popularRecipeEmoji: {
    fontSize: '36px',
  },
  popularRecipeInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  popularRecipeName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  popularRecipeMeta: {
    fontSize: '11px',
    color: '#888',
  },
  popularRecipeBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Featured Section Styles
  featuredBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  featuredBannerContent: {
    flex: 1,
  },
  featuredBannerTag: {
    display: 'inline-block',
    padding: '4px 10px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '10px',
  },
  featuredBannerTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 6px 0',
  },
  featuredBannerDesc: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
    margin: '0 0 16px 0',
  },
  featuredBannerBtn: {
    padding: '10px 20px',
    background: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#059669',
    cursor: 'pointer',
  },
  featuredBannerEmoji: {
    fontSize: '64px',
    opacity: 0.9,
  },
  featuredSection: {
    background: '#fff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
  featuredSectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 4px 0',
  },
  featuredSectionSubtitle: {
    fontSize: '12px',
    color: '#888',
    margin: '0 0 16px 0',
  },
  featuredCardsScroll: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    marginTop: '12px',
  },
  featuredCard: {
    minWidth: '160px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.06) 0%, rgba(168, 85, 247, 0.06) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(124, 58, 237, 0.1)',
  },
  featuredCardEmoji: {
    fontSize: '36px',
    display: 'block',
    marginBottom: '10px',
  },
  featuredCardTag: {
    display: 'inline-block',
    padding: '3px 8px',
    background: 'rgba(124, 58, 237, 0.1)',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: '600',
    color: '#059669',
    marginBottom: '8px',
  },
  featuredCardName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F1F1F',
    margin: '0 0 8px 0',
  },
  featuredCardMeta: {
    display: 'flex',
    gap: '10px',
    fontSize: '10px',
    color: '#888',
  },
  featuredList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  featuredListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px',
    background: 'rgba(124, 58, 237, 0.04)',
    borderRadius: '14px',
  },
  featuredListEmoji: {
    fontSize: '32px',
  },
  featuredListInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  featuredListName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  featuredListBenefit: {
    fontSize: '11px',
    color: '#10B981',
    fontWeight: '500',
  },
  featuredListMeta: {
    textAlign: 'right',
  },
  featuredListCalories: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  featuredListTime: {
    fontSize: '10px',
    color: '#888',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginTop: '12px',
  },
  categoryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '16px 10px',
    background: 'rgba(124, 58, 237, 0.04)',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    borderRadius: '14px',
    cursor: 'pointer',
  },
  categoryEmoji: {
    fontSize: '28px',
  },
  categoryName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  categoryCount: {
    fontSize: '10px',
    color: '#888',
  },
  tipsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '12px',
  },
  tipItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.08) 100%)',
    borderRadius: '12px',
  },
  tipIcon: {
    fontSize: '24px',
  },
  tipText: {
    fontSize: '13px',
    color: '#444',
    lineHeight: 1.4,
  },
  // Donut Chart Styles
  donutChartContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '12px',
  },
  donutChart: {
    position: 'relative',
    width: '140px',
    height: '140px',
    flexShrink: 0,
  },
  donutCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
  },
  donutCenterValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#EF4444',
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  donutCenterLabel: {
    fontSize: '10px',
    color: '#666',
    display: 'block',
  },
  donutLegend: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  donutLegendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  donutLegendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    flexShrink: 0,
  },
  donutLegendText: {
    flex: 1,
    fontSize: '12px',
    color: '#444',
  },
  donutLegendPercent: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  primaryBtn: {
    position: 'relative',
    marginTop: '28px',
    padding: '16px 48px',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 100%)',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4), 0 2px 8px rgba(124, 58, 237, 0.2)',
    transition: 'all 0.3s ease',
  },
  btnText: {
    position: 'relative',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    letterSpacing: '0.5px',
    zIndex: 1,
  },
  btnShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
    animation: 'shimmer 3s infinite',
  },
  quickAction: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '20px',
    animation: 'fadeInUp 0.6s ease-out 0.1s both',
  },
  quickActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '2px dashed rgba(124, 58, 237, 0.3)',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  quickIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '500',
  },
  quickText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#059669',
  },
  section: {
    marginTop: '28px',
    animation: 'fadeInUp 0.6s ease-out 0.2s both',
  },
  sectionTight: {
    marginTop: '12px',
    paddingLeft: '20px',
    paddingRight: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: '16px',
    letterSpacing: '-0.3px',
  },
  sectionTitleTight: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: '8px',
    letterSpacing: '-0.3px',
  },
  sectionTitleTightInline: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F1F1F',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  insightsScroll: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  insightsScrollCompact: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  insightCard: {
    flexShrink: 0,
    width: '160px',
    padding: '16px',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
  insightCardCompact: {
    flexShrink: 0,
    width: '130px',
    minHeight: '160px',
    padding: '16px',
    borderRadius: '14px',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  insightAccent: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '4px',
    height: '24px',
    borderRadius: '2px',
  },
  insightAccentSmall: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    width: '3px',
    height: '20px',
    borderRadius: '2px',
  },
  insightTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    marginLeft: '12px',
    marginBottom: '4px',
    lineHeight: 1.3,
  },
  insightTitleSmall: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#1F1F1F',
    marginLeft: '10px',
    marginBottom: '2px',
    lineHeight: 1.25,
  },
  insightSub: {
    fontSize: '12px',
    color: '#666',
    marginLeft: '12px',
  },
  insightSubSmall: {
    fontSize: '10px',
    color: '#666',
    marginLeft: '10px',
    lineHeight: 1.2,
  },
  insightIcon: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
  },
  eduScroll: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
    paddingBottom: '8px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  eduScrollCompact: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '4px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  educationCard: {
    flexShrink: 0,
    width: '280px',
    position: 'relative',
    background: 'linear-gradient(135deg, #1F1F1F 0%, #2D2D2D 100%)',
    borderRadius: '24px',
    overflow: 'hidden',
    padding: '24px',
  },
  eduGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '200px',
    height: '200px',
    background: 'radial-gradient(circle at top right, rgba(124, 58, 237, 0.4) 0%, transparent 70%)',
  },
  eduContent: {
    position: 'relative',
    zIndex: 1,
  },
  eduBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '12px',
  },
  eduTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
    lineHeight: 1.3,
    letterSpacing: '-0.3px',
  },
  eduDesc: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.5,
    marginBottom: '16px',
  },
  eduBtn: {
    padding: '12px 20px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  patternScroll: {
    display: 'flex',
    gap: '14px',
    overflowX: 'auto',
    paddingBottom: '8px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  patternScrollCompact: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    paddingBottom: '4px',
    marginLeft: '-20px',
    marginRight: '-20px',
    paddingLeft: '20px',
    paddingRight: '20px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  patternCardLarge: {
    flexShrink: 0,
    width: '160px',
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '20px',
    padding: '20px 16px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 12px rgba(124, 58, 237, 0.06)',
  },
  patternIconLarge: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '12px',
  },
  patternTitleLarge: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
    lineHeight: 1.4,
    marginBottom: '8px',
    margin: 0,
  },
  patternTimeLarge: {
    fontSize: '12px',
    color: '#059669',
    fontWeight: '500',
  },
  patternGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  patternCard: {
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    padding: '16px 12px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  patternIcon: {
    fontSize: '24px',
    display: 'block',
    marginBottom: '8px',
  },
  patternTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1F1F1F',
    lineHeight: 1.3,
    marginBottom: '6px',
  },
  patternTime: {
    fontSize: '11px',
    color: '#999',
  },
  checkinCard: {
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '20px',
    padding: '20px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  checkinRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },
  checkinLabel: {
    fontSize: '14px',
    color: '#666',
  },
  checkinValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  checkinPrompt: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
    border: '2px dashed rgba(124, 58, 237, 0.2)',
    borderRadius: '20px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    color: '#059669',
  },
  checkinPromptIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #059669 0%, #A855F7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  checkinPromptText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  checkinPromptTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  checkinPromptSub: {
    fontSize: '13px',
    color: '#666',
  },
  alertCard: {
    display: 'flex',
    gap: '12px',
    padding: '14px',
    background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(251, 146, 60, 0.2)',
  },
  alertIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#FB923C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: '12px',
    color: '#92400E',
    lineHeight: 1.4,
    margin: 0,
    marginBottom: '8px',
  },
  alertBtn: {
    padding: '6px 12px',
    background: '#FB923C',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  disclaimer: {
    fontSize: '11px',
    color: '#999',
    textAlign: 'center',
    marginTop: '12px',
    fontStyle: 'italic',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    padding: '14px 10px',
    textAlign: 'center',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  statValue: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '24px',
    fontWeight: '700',
    color: '#1F1F1F',
    letterSpacing: '-1px',
  },
  statLabel: {
    fontSize: '10px',
    color: '#666',
  },
  statBadge: {
    marginTop: '4px',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '600',
    background: '#EDE9FE',
    color: '#059669',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  seeAllBtn: {
    background: 'none',
    border: 'none',
    color: '#059669',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  historyCard: {
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  historyDots: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  historyDay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  historyDot: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: '12px',
    fontWeight: '500',
  },
  wellnessCard: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '16px',
    padding: '14px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
  },
  wellnessRow: {
    display: 'flex',
    gap: '12px',
  },
  wellnessCardSmall: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid rgba(124, 58, 237, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  wellnessIconSmall: {
    fontSize: '24px',
  },
  wellnessLabelSmall: {
    fontSize: '12px',
    color: '#666',
  },
  wellnessValueSmall: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1F1F1F',
  },
  wellnessItem: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  wellnessIcon: {
    fontSize: '28px',
  },
  wellnessInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  wellnessLabel: {
    fontSize: '12px',
    color: '#666',
  },
  wellnessValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F1F1F',
  },
  wellnessDivider: {
    width: '1px',
    background: 'rgba(0,0,0,0.08)',
    margin: '0 20px',
  },
  premiumSection: {
    marginTop: '32px',
    animation: 'fadeInUp 0.6s ease-out 0.3s both',
  },
  premiumCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #059669 0%, #9333EA 50%, #C026D3 100%)',
    borderRadius: '20px',
    padding: '20px 18px',
    overflow: 'hidden',
  },
  premiumGlow: {
    position: 'absolute',
    top: '-50%',
    right: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 50%)',
    animation: 'float 6s ease-in-out infinite',
  },
  premiumContent: {
    position: 'relative',
    zIndex: 1,
  },
  premiumBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
  premiumTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '10px',
    lineHeight: 1.2,
    letterSpacing: '-0.3px',
  },
  premiumList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    marginBottom: '14px',
  },
  premiumItem: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '4px',
  },
  premiumBtn: {
    width: '100%',
    padding: '12px',
    background: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#059669',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
  },
  bottomSpacer: {
    height: '20px',
  },
  tabBar: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '430px',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px 20px 28px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(124, 58, 237, 0.08)',
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9CA3AF',
    padding: '8px 16px',
  },
  tabActive: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#059669',
    padding: '8px 16px',
  },
  tabLabel: {
    fontSize: '11px',
    fontWeight: '600',
  },
  tabLabelInactive: {
    fontSize: '11px',
    fontWeight: '500',
  },
};

export default FastingApp;
