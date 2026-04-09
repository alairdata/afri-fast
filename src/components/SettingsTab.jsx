import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Modal, Dimensions, Image, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FastingQuizPage from './FastingQuizPage';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
  'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
  'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos',
  'Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova',
  'Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau',
  'Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal',
  'Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
  'Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
];

const SettingsTab = ({
  userName, userEmail, userCountry, onSetCountry, profileImage, onEditProfile, onShowPlanPage, onShowFastingQuiz, onShowNutritionQuiz, selectedPlan,
  userIcon, userIconColor,
  notifyFastStart, onToggleNotifyFastStart,
  notifyFastEnd, onToggleNotifyFastEnd,
  notifyMealReminder, onToggleNotifyMealReminder,
  notifyMilestones, onToggleNotifyMilestones,
  onLogout,
  height, setHeight,
  heightUnit, setHeightUnit,
  dailyCalorieGoal, setDailyCalorieGoal,
  macroStyle, setMacroStyle,
  proteinGoal, setProteinGoal,
  carbsGoal, setCarbsGoal,
  fatsGoal, setFatsGoal,
  hydrationGoal, setHydrationGoal,
  volumeUnit, setVolumeUnit,
  weightUnit, setWeightUnit,
  foodMeasurement, setFoodMeasurement,
  targetWeight, setTargetWeight,
  startingWeight, setStartingWeight,
}) => {
  const [showMakeItYours, setShowMakeItYours] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showFastingQuiz, setShowFastingQuiz] = useState(false);
  const [showNutritionQuiz, setShowNutritionQuiz] = useState(false);
  const [showMeasurementGuide, setShowMeasurementGuide] = useState(false);
  const [storyViewer, setStoryViewer] = useState(null); // { title, slides, index }
  const [showHydrationUnitDropdown, setShowHydrationUnitDropdown] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const macrosEditable = macroStyle === 'custom';
  const macroStyleNote = macroStyle === 'balanced'
    ? 'Balanced keeps your macros evenly distributed for a steady, everyday nutrition target.'
    : macroStyle === 'highProtein'
      ? 'High Protein gives more of your calories to protein to better support fullness and muscle goals.'
      : macroStyle === 'lowCarb'
        ? 'Low Carb lowers your carb target and shifts more calories toward protein and fats.'
        : 'Custom lets you set your own protein, carbs, and fats manually.';

  const SCREEN_W = Dimensions.get('window').width;
  const SCREEN_H = Dimensions.get('window').height;

  const guideStories = {
    sachet: {
      title: '1 Sachet',
      slides: [
        { text: 'The standard pure water sachet', subtext: '500 mL = 2 cups', bg: '#EFF6FF', localImage: require('../../assets/guide/sachet-drinking.png') },
        { text: 'You see these everywhere', subtext: 'On the street, at the shop, in traffic', bg: '#DBEAFE', localImage: require('../../assets/guide/sachet-seller.png') },
        { text: 'Drink 6 sachets daily', subtext: "That's your 3 litre target", bg: '#BFDBFE', localImage: require('../../assets/guide/sachet-drinking-2.png') },
      ],
    },
    bottle: {
      title: '1 Bottle',
      slides: [
        { text: 'A standard water bottle', subtext: '750 mL = 3 cups', bg: '#EFF6FF', localImage: require('../../assets/guide/bottle-1.png') },
        { text: 'Like Eva, Voltic, or Ragolis', subtext: 'The ones you buy at the shop', bg: '#DBEAFE', localImage: require('../../assets/guide/bottle-2.png') },
        { text: 'Drink 4 bottles daily', subtext: "That's your 3 litre target", bg: '#BFDBFE', localImage: require('../../assets/guide/bottle-3.png') },
      ],
    },
    glass: {
      title: '1 Glass',
      slides: [
        { text: 'A regular drinking glass', subtext: '250 mL = 1 cup', bg: '#EFF6FF', localImage: require('../../assets/guide/glass-1.png') },
        { text: 'Filled right to the top', subtext: 'Not a small cup — a full glass', bg: '#DBEAFE', localImage: require('../../assets/guide/glass-2.png') },
        { text: 'Drink 12 glasses daily', subtext: "That's your 3 litre goal", bg: '#BFDBFE', localImage: require('../../assets/guide/glass-3.png') },
      ],
    },
    fist: {
      title: 'Your Fist',
      slides: [
        { text: 'Make a fist — that\'s 1 cup', subtext: 'About 250 mL of food', bg: '#FEF2F2', image: null },
        { text: 'Use for carbs', subtext: 'Rice, garri, beans, yam, fufu', bg: '#FECACA', image: null },
        { text: '1-2 fists per meal', subtext: 'A healthy portion of carbs', bg: '#FCA5A5', image: null },
      ],
    },
    palm: {
      title: 'Your Palm',
      slides: [
        { text: 'Your open palm = 1 serving', subtext: 'About 85g of protein', bg: '#ECFDF5', image: null },
        { text: 'Use for meat, fish, chicken', subtext: 'The size and thickness of your palm', bg: '#D1FAE5', image: null },
        { text: '1-2 palms per meal', subtext: 'That\'s enough protein', bg: '#A7F3D0', image: null },
      ],
    },
    thumb: {
      title: 'Your Thumb',
      slides: [
        { text: 'Your thumb tip = 1 tbsp', subtext: 'About 15 mL', bg: '#FFFBEB', image: null },
        { text: 'Use for oils and fats', subtext: 'Palm oil, groundnut oil, butter, shea', bg: '#FEF3C7', image: null },
        { text: '1-2 thumbs per meal', subtext: 'Keep fats in check', bg: '#FDE68A', image: null },
      ],
    },
    fingertip: {
      title: 'Your Fingertip',
      slides: [
        { text: 'Just the tip = 1 tsp', subtext: 'About 5 mL', bg: '#F5F3FF', image: null },
        { text: 'Use for sugar, salt, spices', subtext: 'Maggi, salt, pepper, suya spice', bg: '#EDE9FE', image: null },
        { text: 'A little goes a long way', subtext: '1 tsp sugar = 16 calories', bg: '#DDD6FE', image: null },
      ],
    },
    handfuls: {
      title: 'Two Handfuls',
      slides: [
        { text: 'Cup both hands together', subtext: '1 serving of vegetables', bg: '#FDF2F8', image: null },
        { text: 'Fill them with veggies or salad', subtext: 'Spinach, lettuce, cabbage, tomatoes', bg: '#FCE7F3', image: null },
        { text: 'Aim for 2+ servings per meal', subtext: 'Vegetables are your best friend', bg: '#FBCFE8', image: null },
      ],
    },
    foodTeaspoon: {
      title: 'Teaspoon',
      slides: [
        { text: 'Your regular teaspoon', subtext: '= 5 mL. Perfect for sugar, salt, spices', bg: '#FFF7ED', localImage: require('../../assets/guide/teaspoon-1.png') },
        { text: '1 teaspoon of sugar', subtext: '= about 16 calories', bg: '#FFEDD5', localImage: require('../../assets/guide/teaspoon-2.png') },
      ],
    },
    foodTablespoon: {
      title: 'Tablespoon',
      slides: [
        { text: 'Your regular tablespoon', subtext: '= 15 mL = 3 teaspoons', bg: '#FFF7ED', localImage: require('../../assets/guide/tablespoon-1.png') },
        { text: 'Use for oils and pastes', subtext: 'Palm oil, groundnut oil, tomato paste', bg: '#FFEDD5', localImage: require('../../assets/guide/tablespoon-2.png') },
      ],
    },
    foodOneTin: {
      title: '1 Titus Tin',
      slides: [
        { text: 'The Titus sardine tin', subtext: 'Your everyday measuring cup', bg: '#FFF7ED', localImage: require('../../assets/guide/third-cup-1.png') },
        { text: '1 tin = 1/3 cup', subtext: 'Use for rice, garri, flour, beans', bg: '#FFEDD5', localImage: require('../../assets/guide/third-cup-2.png') },
      ],
    },
    foodThreeTins: {
      title: '3 Titus Tins',
      slides: [
        { text: 'Stack 3 Titus tins', subtext: '= 1 full cup', bg: '#FFF7ED', localImage: require('../../assets/guide/three-tins-1.png') },
        { text: 'That is your standard cup', subtext: 'For any recipe that says "1 cup"', bg: '#FFEDD5', localImage: require('../../assets/guide/three-tins-2.png') },
      ],
    },
    foodMeat100: {
      title: '100g Meat',
      slides: [
        { text: '100g of meat or fish', subtext: 'Fits flat in your palm, finger-thickness', bg: '#FEF2F2', image: null },
        { text: 'About 1 piece of fish', subtext: 'Or a small chicken breast', bg: '#FECACA', image: null },
      ],
    },
    foodMeat500: {
      title: '500g Meat',
      slides: [
        { text: '500g of chicken', subtext: 'About 4 average chicken pieces', bg: '#FEF2F2', image: null },
        { text: 'A family-sized portion', subtext: 'Good for meal prep or sharing', bg: '#FECACA', image: null },
      ],
    },
    foodVeg100: {
      title: '100g Vegetables',
      slides: [
        { text: '1 medium tomato = 100g', subtext: 'Or 1 medium onion', bg: '#ECFDF5', image: null },
        { text: '500g tomatoes', subtext: '= a medium sized bowl', bg: '#D1FAE5', image: null },
      ],
    },
  };
  const [fastingQuizStep, setFastingQuizStep] = useState(0);
  const [nutritionQuizStep, setNutritionQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});

  const renderToggle = (value, onToggle) => (
    <TouchableOpacity
      style={value ? styles.settingsToggleOn : styles.settingsToggleOff}
      onPress={onToggle}
    >
      <View style={value ? styles.settingsToggleKnobOn : styles.settingsToggleKnobOff} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.settingsContainer}>
      {/* Sticky Profile Section */}
      <View style={styles.settingsProfileCard}>
        <View style={[styles.settingsProfileAvatar, userIconColor ? { backgroundColor: userIconColor } : {}]}>
          <Text style={styles.settingsProfileInitial}>{userIcon || userName.charAt(0)}</Text>
        </View>
        <View style={styles.settingsProfileInfo}>
          <Text style={styles.settingsProfileName}>{userName}</Text>
          <Text style={styles.settingsProfileEmail}>{userEmail}</Text>
          <TouchableOpacity onPress={() => { setCountrySearch(''); setShowCountryPicker(true); }}>
            <Text style={[styles.settingsProfileCountry, !userCountry && { color: '#9CA3AF' }]}>
              {userCountry || 'Select your country'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.settingsEditBtn} onPress={onEditProfile}>
          <Text style={{ color: '#059669', fontSize: 16 }}>{'\u270E'}</Text>
        </TouchableOpacity>
      </View>

      {/* Make it Yours — full page overlay */}
      {showMakeItYours && (
        <View style={styles.makeItYoursPage}>
          <View style={styles.makeItYoursHeader}>
            <TouchableOpacity onPress={() => setShowMakeItYours(false)}>
              <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
            </TouchableOpacity>
            <Text style={styles.makeItYoursHeaderTitle}>Make it Yours</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>

            {/* Fasting Preferences */}
            <View style={styles.settingsSection}>
              <View style={styles.settingsSectionTitleRow}>
                <Text style={[styles.settingsSectionTitle, { marginBottom: 0 }]}>Fasting Preferences</Text>
                <TouchableOpacity onPress={onShowFastingQuiz}>
                  <Text style={styles.takeQuizBtn}>Take a Quiz</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.settingsItem} onPress={onShowPlanPage}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Fasting Schedule</Text>
                  <Text style={styles.settingsItemDesc}>Your default fasting window</Text>
                </View>
                <View style={styles.settingsSelectRow}>
                  <Text style={styles.settingsSelectText}>{selectedPlan || '--'}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </View>
              </TouchableOpacity>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Fasting Reminders</Text>
                  <Text style={styles.settingsItemDesc}>Get reminded to start/end fast</Text>
                </View>
                {renderToggle(notifyFastStart && notifyFastEnd, () => { onToggleNotifyFastStart?.(!(notifyFastStart && notifyFastEnd)); onToggleNotifyFastEnd?.(!(notifyFastStart && notifyFastEnd)); })}
              </View>
            </View>

            {/* Nutrition Goals */}
            <View style={styles.settingsSection}>
              <View style={styles.settingsSectionTitleRow}>
                <Text style={[styles.settingsSectionTitle, { marginBottom: 0 }]}>Nutrition Goals</Text>
                <TouchableOpacity onPress={onShowNutritionQuiz}>
                  <Text style={styles.takeQuizBtn}>Take a Quiz</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Starting Weight</Text>
                </View>
                <View style={styles.settingsInputWrapper}>
                  <TextInput
                    style={styles.settingsInput}
                    value={startingWeight != null ? String(startingWeight) : ''}
                    onChangeText={(text) => {
                      const val = parseFloat(text);
                      if (!isNaN(val)) setStartingWeight(val);
                      else if (text === '') setStartingWeight(null);
                    }}
                    keyboardType="numeric"
                    placeholder="--"
                  />
                  <Text style={styles.settingsInputUnit}>{weightUnit}</Text>
                </View>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Target Weight</Text>
                </View>
                <View style={styles.settingsInputWrapper}>
                  <TextInput
                    style={styles.settingsInput}
                    value={targetWeight != null ? String(targetWeight) : ''}
                    onChangeText={(text) => {
                      const val = parseFloat(text);
                      if (!isNaN(val)) setTargetWeight(val);
                      else if (text === '') setTargetWeight(null);
                    }}
                    keyboardType="numeric"
                    placeholder="--"
                  />
                  <Text style={styles.settingsInputUnit}>{weightUnit}</Text>
                </View>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Daily Calories</Text>
                </View>
                <View style={styles.settingsInputWrapper}>
                  <TextInput
                    style={styles.settingsInput}
                    value={String(dailyCalorieGoal)}
                    onChangeText={(text) => setDailyCalorieGoal(Number(text) || 0)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.settingsInputUnit}>cal</Text>
                </View>
              </View>
              <View style={styles.settingsItemBlock}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Macro Style</Text>
                  <Text style={styles.settingsItemDesc}>How calories are split across protein, carbs, and fats</Text>
                </View>
                <View style={styles.settingsMacroStyleControl}>
                  {['balanced', 'highProtein', 'lowCarb', 'custom'].map((ms) => (
                    <TouchableOpacity
                      key={ms}
                      style={[styles.settingsMacroStyleOption, macroStyle === ms && styles.settingsMacroStyleOptionActive]}
                      onPress={() => setMacroStyle(ms)}
                    >
                      <Text style={macroStyle === ms ? styles.settingsMacroStyleTextActive : styles.settingsMacroStyleText}>
                        {ms === 'balanced' ? 'Balanced' : ms === 'highProtein' ? 'High Protein' : ms === 'lowCarb' ? 'Low Carb' : 'Custom'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.settingsMacroRow}>
                {[{ label: 'Protein', val: proteinGoal, set: setProteinGoal }, { label: 'Carbs', val: carbsGoal, set: setCarbsGoal }, { label: 'Fats', val: fatsGoal, set: setFatsGoal }].map(({ label, val, set }) => (
                  <View key={label} style={styles.settingsMacroItem}>
                    <Text style={styles.settingsMacroLabel}>{label}</Text>
                    <View style={styles.settingsMacroInputWrapper}>
                      <TextInput
                        style={[styles.settingsMacroInput, !macrosEditable && styles.settingsMacroInputDisabled]}
                        value={String(val)}
                        onChangeText={(text) => set(Number(text) || 0)}
                        keyboardType="numeric"
                        editable={macrosEditable}
                      />
                      <Text style={styles.settingsMacroUnit}>g</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.settingsHelperText}>{macroStyleNote}</Text>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Daily Hydration</Text>
                </View>
                <View style={styles.settingsInputWrapper}>
                  <TextInput
                    style={styles.settingsInput}
                    value={String(hydrationGoal)}
                    onChangeText={(text) => setHydrationGoal(Number(text) || 0)}
                    keyboardType="numeric"
                  />
                  <View style={styles.settingsDropdownWrap}>
                    <TouchableOpacity
                      style={styles.settingsUnitPicker}
                      onPress={() => setShowHydrationUnitDropdown((prev) => !prev)}
                    >
                      <Text style={styles.settingsUnitPickerText}>{volumeUnit}</Text>
                      <Ionicons name="chevron-down" size={12} color="#059669" />
                    </TouchableOpacity>
                    {showHydrationUnitDropdown && (
                      <View style={styles.settingsInlineDropdown}>
                        {['oz', 'mL', 'sachet', 'bottle'].map((unit) => (
                          <TouchableOpacity
                            key={unit}
                            style={[styles.settingsInlineDropdownItem, volumeUnit === unit && styles.settingsInlineDropdownItemActive]}
                            onPress={() => { setVolumeUnit(unit); setShowHydrationUnitDropdown(false); }}
                          >
                            <Text style={[styles.settingsInlineDropdownText, volumeUnit === unit && styles.settingsInlineDropdownTextActive]}>{unit}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Log Settings */}
            <View style={styles.settingsSection}>
              <View style={styles.settingsSectionTitleRow}>
                <Text style={[styles.settingsSectionTitle, { marginBottom: 0 }]}>Log Settings</Text>
                <TouchableOpacity onPress={() => setShowMeasurementGuide(true)}>
                  <Text style={styles.takeQuizBtn}>Visual Guide</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Height</Text>
                </View>
                <View style={styles.settingsInputWrapper}>
                  <TextInput
                    style={styles.settingsInput}
                    value={String(height)}
                    onChangeText={(text) => setHeight(text)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                  <View style={styles.settingsSegmentedControl}>
                    {['cm', 'ft'].map((u) => (
                      <TouchableOpacity key={u} style={heightUnit === u ? styles.settingsSegmentActive : styles.settingsSegment} onPress={() => setHeightUnit(u)}>
                        <Text style={heightUnit === u ? styles.settingsSegmentTextActive : styles.settingsSegmentText}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Weight Unit</Text>
                </View>
                <View style={styles.settingsSegmentedControl}>
                  {['kg', 'lbs'].map((u) => (
                    <TouchableOpacity key={u} style={weightUnit === u ? styles.settingsSegmentActive : styles.settingsSegment} onPress={() => setWeightUnit(u)}>
                      <Text style={weightUnit === u ? styles.settingsSegmentTextActive : styles.settingsSegmentText}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Volume Unit</Text>
                </View>
                <View style={styles.settingsSegmentedControl}>
                  {['oz', 'mL', 'sachet', 'bottle'].map((u) => (
                    <TouchableOpacity key={u} style={volumeUnit === u ? styles.settingsSegmentActive : styles.settingsSegment} onPress={() => setVolumeUnit(u)}>
                      <Text style={volumeUnit === u ? styles.settingsSegmentTextActive : styles.settingsSegmentText}>{u === 'sachet' ? 'Sachet' : u === 'bottle' ? 'Bottle' : u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.settingsItem}>
                <View style={styles.settingsItemLeft}>
                  <Text style={styles.settingsItemLabel}>Food Measurement</Text>
                </View>
                <View style={styles.settingsSegmentedControl}>
                  {['cups', 'tbsp', 'tsp'].map((u) => (
                    <TouchableOpacity key={u} style={foodMeasurement === u ? styles.settingsSegmentActive : styles.settingsSegment} onPress={() => setFoodMeasurement(u)}>
                      <Text style={foodMeasurement === u ? styles.settingsSegmentTextActive : styles.settingsSegmentText}>{u.charAt(0).toUpperCase() + u.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.settingsScrollContent} showsVerticalScrollIndicator={false}>
      {/* Make it Yours entry row */}
      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsActionItem} onPress={() => setShowMakeItYours(true)}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="options-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Make it Yours</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Notifications</Text>

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Text style={styles.settingsItemLabel}>Fast Start Reminder</Text>
          </View>
          {renderToggle(notifyFastStart, () => onToggleNotifyFastStart?.(!notifyFastStart))}
        </View>

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Text style={styles.settingsItemLabel}>Fast End Reminder</Text>
          </View>
          {renderToggle(notifyFastEnd, () => onToggleNotifyFastEnd?.(!notifyFastEnd))}
        </View>

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Text style={styles.settingsItemLabel}>Meal Logging Reminder</Text>
          </View>
          {renderToggle(notifyMealReminder, () => onToggleNotifyMealReminder?.(!notifyMealReminder))}
        </View>

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Text style={styles.settingsItemLabel}>Progress Milestones</Text>
          </View>
          {renderToggle(notifyMilestones, () => onToggleNotifyMilestones?.(!notifyMilestones))}
        </View>
      </View>

      {/* App Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>App Settings</Text>

        <View style={styles.settingsItem}>
          <View style={styles.settingsItemLeft}>
            <Text style={styles.settingsItemLabel}>Dark Mode</Text>
          </View>
          {renderToggle(darkMode, () => setDarkMode(!darkMode))}
        </View>
      </View>

      {/* Data & Privacy */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Data & Privacy</Text>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="download-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Export My Data</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="trash-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Clear History</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Privacy Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Support */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Support</Text>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="help-circle-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Help & FAQ</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="mail-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Contact Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsActionItem}>
          <View style={styles.settingsActionLeft}>
            <Ionicons name="star-outline" size={18} color="#374151" />
            <Text style={styles.settingsActionLabel}>Rate the App</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Log Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>

      {/* App Version */}
      <View style={styles.settingsVersion}>
        <Text style={styles.settingsVersionText}>Afri Fast v1.0.0</Text>
        <Text style={styles.settingsVersionSub}>Made by SeedFest Technologies</Text>
      </View>

      <View style={{ height: 40 }} />
      </ScrollView>

      {/* Measurement Visual Guide */}
      {showMeasurementGuide && (
        <View style={[styles.makeItYoursPage, { zIndex: 100 }]}>
          <View style={styles.makeItYoursHeader}>
            <TouchableOpacity onPress={() => setShowMeasurementGuide(false)}>
              <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
            </TouchableOpacity>
            <Text style={styles.makeItYoursHeaderTitle}>Visual Guide</Text>
          </View>
          <View style={styles.quizContainer}>
          <ScrollView style={styles.quizContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.guideIntro}>Use your hands and everyday items to estimate portions — no scale needed.</Text>

            <Text style={styles.guideSection}>Water</Text>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.sachet, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="water-outline" size={24} color="#3B82F6" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>1 Sachet</Text>
                <Text style={styles.guideVisualEquals}>= 500 mL = 2 cups</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.bottle, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="flask-outline" size={24} color="#3B82F6" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>1 Bottle</Text>
                <Text style={styles.guideVisualEquals}>= 750 mL = 3 cups</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.glass, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="cafe-outline" size={24} color="#3B82F6" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>1 Glass</Text>
                <Text style={styles.guideVisualEquals}>= 250 mL = 1 cup</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.guideConversionCard}>
              <Text style={styles.guideConversionTitle}>Daily Target: 3 Litres</Text>
              <Text style={styles.guideConversionNote}>Hot climate? You need more water than average.</Text>
              <View style={styles.guideConversionRow}>
                <View style={styles.guideConversionItem}>
                  <Text style={styles.guideConversionValue}>6</Text>
                  <Text style={styles.guideConversionLabel}>sachets</Text>
                </View>
                <Text style={styles.guideConversionOr}>or</Text>
                <View style={styles.guideConversionItem}>
                  <Text style={styles.guideConversionValue}>4</Text>
                  <Text style={styles.guideConversionLabel}>bottles</Text>
                </View>
                <Text style={styles.guideConversionOr}>or</Text>
                <View style={styles.guideConversionItem}>
                  <Text style={styles.guideConversionValue}>12</Text>
                  <Text style={styles.guideConversionLabel}>glasses</Text>
                </View>
              </View>
            </View>

            <Text style={styles.guideSection}>Food</Text>
            <Text style={styles.guideFoodSectionTitle}>YOUR MEASURING TOOLS</Text>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodTeaspoon, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="ellipse-outline" size={24} color="#F97316" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>Teaspoon</Text>
                <Text style={styles.guideVisualEquals}>= 5 mL of sugar, salt, or spice</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodTablespoon, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="remove-outline" size={24} color="#F97316" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>Tablespoon</Text>
                <Text style={styles.guideVisualEquals}>= 15 mL of oil, butter, or paste</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodOneTin, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="cube-outline" size={24} color="#F97316" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>1/3 Cup</Text>
                <Text style={styles.guideVisualEquals}>= 1 Titus sardine tin</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodThreeTins, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="layers-outline" size={24} color="#F97316" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>1 Cup</Text>
                <Text style={styles.guideVisualEquals}>= 3 Titus sardine tins</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.guideFoodSectionTitle}>MEAT & FISH</Text>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodMeat100, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="fish-outline" size={24} color="#EF4444" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>100g</Text>
                <Text style={styles.guideVisualEquals}>= fits flat in your palm, finger-thick</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodMeat500, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="fish-outline" size={24} color="#EF4444" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>500g</Text>
                <Text style={styles.guideVisualEquals}>= about 4 average chicken pieces</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.guideFoodSectionTitle}>VEGETABLES</Text>

            <TouchableOpacity style={styles.guideVisualCard} onPress={() => setStoryViewer({ ...guideStories.foodVeg100, index: 0 })}>
              <View style={[styles.guideVisualIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="leaf-outline" size={24} color="#059669" />
              </View>
              <View style={styles.guideVisualInfo}>
                <Text style={styles.guideVisualTitle}>100g</Text>
                <Text style={styles.guideVisualEquals}>= 1 medium tomato or 1 medium onion</Text>
                <Text style={styles.guideVisualCompare}>Tap to see real-life example</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.guideSection}>Cooking</Text>

            <View style={styles.guideConversionCard}>
              <Text style={styles.guideConversionTitle}>Quick Conversions</Text>
              <View style={styles.guideQuickRef}>
                <View style={styles.guideQuickRefRow}>
                  <Text style={styles.guideQuickRefLeft}>3 tsp</Text>
                  <Text style={styles.guideQuickRefRight}>= 1 tbsp</Text>
                </View>
                <View style={styles.guideQuickRefRow}>
                  <Text style={styles.guideQuickRefLeft}>16 tbsp</Text>
                  <Text style={styles.guideQuickRefRight}>= 1 cup</Text>
                </View>
                <View style={styles.guideQuickRefRow}>
                  <Text style={styles.guideQuickRefLeft}>1 cup</Text>
                  <Text style={styles.guideQuickRefRight}>= 250 mL</Text>
                </View>
                <View style={styles.guideQuickRefRow}>
                  <Text style={styles.guideQuickRefLeft}>1 milk tin</Text>
                  <Text style={styles.guideQuickRefRight}>= 170 mL (small) / 400 mL (big)</Text>
                </View>
                <View style={styles.guideQuickRefRow}>
                  <Text style={styles.guideQuickRefLeft}>1 paint rubber</Text>
                  <Text style={styles.guideQuickRefRight}>= about 4 cups</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
          {/* Story Viewer - clean white style */}
          {storyViewer && (
            <View style={[styles.storyOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }]}>
              {/* Header */}
              <View style={styles.storyHeader}>
                <TouchableOpacity onPress={() => setStoryViewer(null)}>
                  <Ionicons name="chevron-back" size={24} color="#1F1F1F" />
                </TouchableOpacity>
                <Text style={styles.storyHeaderTitle}>{storyViewer.title}</Text>
                <TouchableOpacity onPress={() => setStoryViewer(null)}>
                  <Ionicons name="close" size={22} color="#999" />
                </TouchableOpacity>
              </View>

              {/* Image */}
              <View style={styles.storyImageContainer}>
                {storyViewer.slides[storyViewer.index].localImage ? (
                  <Image source={storyViewer.slides[storyViewer.index].localImage} style={styles.storyImage} resizeMode="cover" />
                ) : storyViewer.slides[storyViewer.index].image ? (
                  <Image source={{ uri: storyViewer.slides[storyViewer.index].image }} style={styles.storyImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.storyImagePlaceholder, { backgroundColor: storyViewer.slides[storyViewer.index].bg }]}>
                    <Ionicons name="image-outline" size={48} color="#D1D5DB" />
                  </View>
                )}
              </View>

              {/* Text content */}
              <View style={styles.storyTextSection}>
                <Text style={styles.storyText}>{storyViewer.slides[storyViewer.index].text}</Text>
                <Text style={styles.storySubtext}>{storyViewer.slides[storyViewer.index].subtext}</Text>
              </View>

              {/* Dots */}
              <View style={styles.storyDotsRow}>
                {storyViewer.slides.map((_, i) => (
                  <View key={i} style={[styles.storyDot, i === storyViewer.index && styles.storyDotActive]} />
                ))}
              </View>

              {/* Navigation */}
              <View style={styles.storyNavRow}>
                <TouchableOpacity
                  style={[styles.storyNavBtn, storyViewer.index === 0 && { opacity: 0.3 }]}
                  onPress={() => { if (storyViewer.index > 0) setStoryViewer({ ...storyViewer, index: storyViewer.index - 1 }); }}
                  disabled={storyViewer.index === 0}
                >
                  <Ionicons name="chevron-back" size={20} color="#374151" />
                  <Text style={styles.storyNavText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.storyNavBtn}
                  onPress={() => {
                    if (storyViewer.index < storyViewer.slides.length - 1) {
                      setStoryViewer({ ...storyViewer, index: storyViewer.index + 1 });
                    } else {
                      setStoryViewer(null);
                    }
                  }}
                >
                  <Text style={styles.storyNavText}>{storyViewer.index === storyViewer.slides.length - 1 ? 'Done' : 'Next'}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        </View>
      )}
      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent={false} onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.countryPickerContainer}>
          <View style={styles.countryPickerHeader}>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.countryPickerTitle}>Select Country</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.countrySearchBar}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.countrySearchInput}
              placeholder="Search countries..."
              placeholderTextColor="#9CA3AF"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
            {countrySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCountrySearch('')}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase()))}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryItem, userCountry === item && styles.countryItemSelected]}
                onPress={() => { onSetCountry?.(item); setShowCountryPicker(false); }}
              >
                <Text style={[styles.countryItemText, userCountry === item && styles.countryItemTextSelected]}>{item}</Text>
                {userCountry === item && <Ionicons name="checkmark" size={18} color="#059669" />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.countryDivider} />}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  settingsContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  makeItYoursPage: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAFAFA',
    zIndex: 99,
  },
  makeItYoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FAFAFA',
  },
  makeItYoursHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },

  settingsScrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  settingsProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingsProfileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsProfileAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  settingsProfileInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  settingsProfileInfo: {
    flex: 1,
    gap: 4,
  },
  settingsProfileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  settingsProfileEmail: {
    fontSize: 13,
    color: '#888',
  },
  settingsProfileCountry: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  settingsEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  settingsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsItemBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsItemLeft: {
    flex: 1,
    gap: 2,
  },
  settingsItemLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F1F1F',
  },
  settingsItemDesc: {
    fontSize: 11,
    color: '#888',
  },
  settingsSelect: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    backgroundColor: '#fff',
  },
  settingsSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  pickerDropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  pickerOptionActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#1F1F1F',
  },
  pickerOptionTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  settingsToggleOn: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#059669',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  settingsToggleOff: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E5E5',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  settingsToggleKnobOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsToggleKnobOff: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingsInput: {
    width: 70,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'right',
  },
  settingsInputUnit: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  settingsUnitPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    backgroundColor: '#fff',
  },
  settingsUnitPickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  settingsDropdownWrap: {
    position: 'relative',
  },
  settingsInlineDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 96,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 20,
    overflow: 'hidden',
  },
  settingsInlineDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  settingsInlineDropdownItemActive: {
    backgroundColor: '#ECFDF5',
  },
  settingsInlineDropdownText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  settingsInlineDropdownTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  settingsMacroRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsMacroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  settingsMacroLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  settingsMacroInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingsMacroInput: {
    width: 50,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  settingsMacroInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  settingsMacroUnit: {
    fontSize: 11,
    color: '#888',
  },
  settingsHelperText: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 17,
    marginTop: 10,
  },
  settingsSegmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 10,
    padding: 3,
  },
  settingsMacroStyleControl: {
    marginTop: 10,
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  settingsMacroStyleOption: {
    width: '48%',
    minHeight: 36,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.12)',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  settingsMacroStyleOptionActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  settingsMacroStyleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  settingsMacroStyleTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
  },
  settingsSegment: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  settingsSegmentActive: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    alignItems: 'center',
  },
  settingsSegmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  settingsSegmentTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  settingsActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  settingsActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsActionIcon: {
    fontSize: 20,
  },
  settingsActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F1F1F',
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    fontStyle: 'italic',
  },
  infoTooltip: {
    marginTop: 6,
    padding: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  infoTooltipText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  settingsSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingsSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  takeQuizBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  quizContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  quizProgress: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  quizProgressBar: {
    height: 4,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  quizContent: {
    flex: 1,
    padding: 20,
  },
  quizQuestion: {
    alignItems: 'center',
    paddingTop: 30,
  },
  quizEmoji: {
    fontSize: 48,
    marginBottom: 20,
  },
  quizQuestionText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    marginBottom: 30,
  },
  quizOption: {
    width: '100%',
    padding: 18,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    marginBottom: 12,
  },
  quizOptionSelected: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.05)',
  },
  quizOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F1F1F',
    textAlign: 'center',
  },
  quizOptionTextSelected: {
    color: '#059669',
    fontWeight: '600',
  },
  quizResultCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  quizResultPlan: {
    fontSize: 36,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 12,
  },
  quizResultDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  quizApplyBtn: {
    width: '100%',
    padding: 16,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  quizApplyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  quizRetakeBtn: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
  },
  quizRetakeBtnText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  nutritionResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  nutritionResultLabel: {
    fontSize: 15,
    color: '#666',
  },
  nutritionResultValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#059669',
  },
  guideIntro: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    marginBottom: 20,
  },
  guideVisualCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    alignItems: 'center',
  },
  guideVisualIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  guideVisualShape: {},
  guideVisualInfo: {
    flex: 1,
  },
  guideVisualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  guideVisualEquals: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  guideVisualCompare: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  guideConversionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  guideConversionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
    textAlign: 'center',
    marginBottom: 4,
  },
  guideConversionNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 14,
  },
  guideIntroSmall: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 12,
    marginTop: -4,
  },
  guideFoodCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  guideFoodTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  guideFoodItem: {
    fontSize: 15,
    color: '#1F1F1F',
    paddingVertical: 4,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    marginBottom: 6,
  },
  guideFoodSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  guideConversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideConversionItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  guideConversionValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#059669',
  },
  guideConversionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  guideConversionOr: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '600',
    marginHorizontal: 6,
  },
  guideQuickRef: {
    gap: 0,
  },
  guideQuickRefRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  guideQuickRefLeft: {
    width: 80,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  guideQuickRefRight: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  guideSection: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    marginTop: 24,
    marginBottom: 14,
  },
  guideCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  guideEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  guideCardContent: {
    flex: 1,
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  guideCardDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
  },
  guideRefCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  guideRefLine: {
    fontSize: 14,
    color: '#1F1F1F',
    fontWeight: '500',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  storyOverlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 50,
    paddingBottom: 12,
  },
  storyHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  storyImageContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    height: 420,
    backgroundColor: '#F5F5F5',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTextSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  storyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  storySubtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  storyDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  storyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  storyDotActive: {
    backgroundColor: '#059669',
    width: 24,
  },
  storyNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 20 : 36,
    marginTop: 'auto',
  },
  storyNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  storyNavText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  logoutBtn: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsVersion: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  settingsVersionText: {
    fontSize: 13,
    color: '#888',
  },
  settingsVersionSub: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 4,
  },
  countryPickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  countryPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  countryPickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  countrySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F1F1F',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  countryItemSelected: {
    backgroundColor: '#ECFDF5',
  },
  countryItemText: {
    fontSize: 15,
    color: '#1F1F1F',
  },
  countryItemTextSelected: {
    color: '#059669',
    fontWeight: '600',
  },
  countryDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginHorizontal: 20,
  },
});

export default SettingsTab;
