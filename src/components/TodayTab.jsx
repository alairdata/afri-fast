import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image, Modal, Platform, Animated, RefreshControl } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { getJustForYou, getCachedJustForYou } from '../lib/claudeInsights';
import FormattedText from '../lib/FormattedText';
import { AFRICAN_RECIPES } from '../lib/africanRecipes';
import { RecipeDetailModal, RecipeCard } from './MakeRecipePage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Pool of long-form articles. Image URLs are placeholders — swap as needed.
const ARTICLE_POOL = [
  {
    title: 'Fat burning starts here',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400' },
    body: "A calorie deficit is the engine behind fat loss. When you consistently eat fewer calories than your body burns, it has to pull energy from stored fat. That is the fundamental truth behind every successful weight loss approach.\n\nThe science is straightforward. Your body burns calories through three channels: your basal metabolic rate (what you burn at rest), the thermic effect of food (energy used to digest meals), and physical activity. Add them up and you get your total daily energy expenditure (TDEE).\n\nEat below your TDEE and your body makes up the difference from fat stores. The math works out to roughly 7,700 calories of deficit per kilogram of fat lost. That means a 500-calorie daily deficit burns about half a kilo of fat per week.\n\nThe key word is sustainable. Aggressive deficits (cutting too many calories) often backfire because they trigger muscle loss, slow your metabolism, and make hunger unmanageable. A moderate deficit of 300–500 calories daily is the sweet spot for most people.\n\nA practical tip: start each meal with protein and vegetables before adding carbs. This naturally reduces your calorie intake without feeling deprived.",
  },
  {
    title: 'Protein protects muscle',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    body: "Many people worry that cutting calories will eat away their hard-earned muscle. That fear has a kernel of truth, and getting enough protein is how you handle it.\n\nYour body has two main fuel banks: fat and muscle protein. When calories are restricted, it can pull from both. The better your protein intake, the more your body protects muscle and burns fat instead.\n\nResearch suggests that people on calorie-restricted diets who eat adequate protein lose far more fat and far less muscle than those who under-eat protein. Aim for 1.6–2.2 grams of protein per kilogram of body weight, spread across your meals.\n\nGood African sources include eggs, fish, beans, lentils, peanuts, milk, yoghurt, and meat. If you're plant-based, combine grains and legumes (rice and beans, or moimoi with bread) to get a complete amino-acid profile.\n\nA practical approach: anchor every meal with a protein source first, then build the rest of the plate around it. This naturally keeps protein high and total calories in check.",
  },
  {
    title: 'Water amplifies weight loss',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400' },
    body: "Most hunger you feel between meals isn't real hunger — it's thirst. The brain regions that trigger hunger and thirst sit close together, and dehydration often gets misread as a craving.\n\nWhen you're eating in a calorie deficit, you're often getting less water from food too, so dehydration is a real risk. The result is headaches, fatigue, brain fog, and what feels like overwhelming hunger but is actually a thirst signal.\n\nA simple test: when you feel a craving hit, drink a full glass of water and wait 10 minutes. Most of the time, the feeling passes. If it stays, that's real hunger and worth addressing with a planned meal or snack.\n\nAim for 2–3 litres of plain water across the day. Sparkling water, plain tea, and black coffee in moderation also count and add no calories.\n\nIf the heat where you live is intense, add a pinch of salt or some electrolytes. You'll lose more sodium through sweat, and water alone can leave you feeling worse instead of better.",
  },
  {
    title: 'Sleep is your secret weapon',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1455642305367-68834a9d4337?w=400' },
    body: "Poor sleep raises ghrelin (the hunger hormone) by up to 24% and drops leptin (the fullness hormone) by 18%. Those numbers come from controlled studies on otherwise healthy people who slept 5 hours instead of 8. The result is what feels like uncontrollable hunger the next day.\n\nThis is why sticking to your calorie goal feels impossible after a bad night — it's not willpower, it's hormones.\n\nThe relationship runs both ways. Better eating habits and lighter evening meals improve deep sleep. So a consistent calorie routine and a consistent sleep routine reinforce each other.\n\nWhat actually moves the needle on sleep:\n\nFinish eating 2–3 hours before bed. Late eating disrupts deep sleep regardless of what you ate.\n\nKeep your room cool — 18–20°C. The body needs to drop its core temperature to fall asleep.\n\nDim lights an hour before bed. Bright overhead lights, especially blue-spectrum from screens, suppress melatonin.\n\nIf there's one habit that protects everything else — calorie control, weight loss, mood, energy — it's protecting your sleep.",
  },
  {
    title: 'The calorie deficit sweet spot',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1495364141860-b0d03eccd065?w=400' },
    body: "Not all calorie deficits are equal. Too small and fat loss stalls. Too large and you lose muscle, slow your metabolism, and burn out. The sweet spot for most people sits between 300 and 500 calories below maintenance.\n\nA 500-calorie daily deficit is the classic approach. It burns roughly half a kilogram of fat per week — fast enough to see real progress, slow enough to preserve muscle and keep hunger manageable.\n\nGoing lower (200–300 calories) works well if you're close to your goal weight or prefer a slow, sustainable approach with very little hunger. The trade-off is slower results.\n\nGoing higher (600–750 calories) can accelerate fat loss short-term but often leads to muscle loss, fatigue, and intense cravings that derail consistency. The research is clear: aggressive deficits produce worse long-term outcomes than moderate ones.\n\nA practical way to find your sweet spot: track your weight as a 7-day rolling average. If it drops 0.3–0.7 kg per week, your deficit is right. If it stalls, cut 100 calories. If it drops faster than 1 kg per week, increase calories slightly to protect muscle.",
  },
  {
    title: 'Electrolytes matter',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400' },
    body: "When you eat in a calorie deficit, electrolyte balance matters more than most people realise. Eating less food means less sodium, potassium, and magnesium coming in — and low levels of these minerals cause fatigue, headaches, leg cramps, and cravings that feel impossible to manage.\n\nThis is why some people feel terrible on a calorie deficit even when they're doing everything else right. It's not the deficit itself, it's electrolyte depletion.\n\nThree minerals matter most:\n\nSodium: a pinch of unrefined salt (Himalayan, sea salt) in your water, especially if you sweat a lot. Most people cutting calories can still get adequate sodium through normal seasoning.\n\nPotassium: avocado, banana, leafy greens, and tomatoes are excellent sources. These are also very low calorie, making them ideal weight loss foods.\n\nMagnesium: dark leafy greens, nuts (especially almonds and cashews), pumpkin seeds, and dark chocolate. A magnesium glycinate supplement before bed can help with sleep and reduce nighttime cravings.\n\nA simple electrolyte drink: 500ml water + a pinch of pink salt + squeeze of lime. Zero calories, keeps hunger and energy stable.",
  },
  {
    title: 'Starting your day with the right food',
    time: '5 min read',
    image: { uri: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    body: "What you eat first in the morning sets the tone for your entire day of calorie management. A high-protein, low-sugar breakfast keeps you full, steady, and in control. A sugar-heavy start triggers a spike-and-crash cycle that drives cravings all day.\n\nThe golden rule: anchor your first meal around protein and fibre. A handful of nuts, eggs, yoghurt, or akara with vegetables. Protein suppresses the hunger hormone ghrelin for hours. Fibre slows glucose absorption and keeps you satisfied longer.\n\nFor your main morning meal, build it around protein and vegetables first, then add complex carbs. Eggs with leafy greens, beans with tomato stew, fish with a small portion of yam. The protein keeps you full, the fibre slows digestion.\n\nAvoid these common morning mistakes:\n\nGoing straight to white bread, sugary tea, or a large portion of rice. These spike your blood sugar, drop it fast, and you'll be ravenous by mid-morning.\n\nSkipping breakfast entirely when you're very hungry. Under-eating early often leads to overeating late, which makes hitting your daily calorie goal harder.\n\nFried, heavy, oily foods first thing. Akara every morning adds up — keep the oil-heavy meals as occasional treats, not daily anchors.",
  },
  {
    title: 'Your gut health and weight loss',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400' },
    body: "Your gut bacteria have a surprisingly large influence on your weight. Research now shows that the composition of your gut microbiome affects how many calories you extract from food, how your fat cells behave, and how hungry you feel.\n\nPeople with a more diverse gut microbiome tend to have an easier time losing weight and maintaining it. Diversity comes from eating a wide variety of plants — aim for 30+ different plant foods per week. That sounds like a lot, but herbs, spices, and different varieties of the same food all count.\n\nFermented foods are particularly powerful. They introduce live bacteria directly into your gut.\n\nAfrican fermented foods to prioritise:\n\nOgi (akamu, pap) — fermented millet or maize porridge, gentle on digestion and rich in lactic acid bacteria.\n\nGari — fermented cassava, high in resistant starch that feeds beneficial gut bacteria.\n\nIru and ogiri — fermented locust beans and melon seeds used in soups. These are among the most probiotic-dense foods in traditional African cooking.\n\nFibre feeds your gut bacteria. Beans, lentils, leafy greens, plantain, and wholegrains — these are not just good for keeping you full (which helps your calorie goal), they actively improve gut health and metabolism.",
  },
  {
    title: 'Consistency beats perfection',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400' },
    body: "Six imperfect days of calorie tracking beats one perfect day followed by five days of giving up. This is the most important thing to understand about making weight loss actually work in your life.\n\nThe metabolic and hormonal benefits of a calorie deficit come from consistency, not heroic single-day efforts. Being perfectly on target one day, then abandoning tracking the next, gives you almost none of the benefits.\n\nWhat consistency looks like:\n\nTracking most days, even when life is busy. An estimate on a hard day is better than logging nothing at all.\n\nForgiving yourself when a day goes over. One heavy meal doesn't undo a week of good habits.\n\nChoosing a calorie target that fits your life. A goal that's sustainable at 80% effort beats one that requires 100% effort every single day.\n\nNot trying to copy someone else's approach. The 'best' calorie plan is the one you can actually stick to for months and years.\n\nThe goal is for tracking to feel as automatic as checking your phone — something you do without much thought. That only comes with consistency.",
  },
  {
    title: 'Morning light resets hunger',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400' },
    body: "Getting natural light in your eyes within the first hour of waking has a measurable effect on how hungry you'll feel for the rest of the day. The science of this is well-established but rarely talked about.\n\nLight hitting your retina early in the morning sets your circadian clock, which controls hundreds of processes — including the release of cortisol, melatonin, leptin, and ghrelin (the hunger and fullness hormones).\n\nWhen your morning light cue is strong, your hunger hormones release on a predictable schedule. You feel hungry at your normal eating times, full when you should be, and not ravenous between meals.\n\nWhen morning light is weak (think dark rooms, screens, only artificial lighting), this rhythm gets scrambled. The result is irregular hunger, late-night cravings, and a calorie goal that feels much harder to stick to than it should.\n\nThe practical fix is simple: 10–15 minutes outside in the morning, even on a cloudy day. The light intensity outdoors is far higher than indoors, even when it doesn't seem so. Combine this with a glass of water and your hunger will feel more manageable all day.",
  },
  {
    title: 'African foods for weight loss',
    time: '5 min read',
    image: { uri: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400' },
    body: "African cuisine has a natural head start when it comes to weight loss. Many traditional foods are high in fibre, moderate in protein, and low in processed ingredients — exactly the profile that supports a sustainable calorie deficit.\n\nLegumes are the backbone. Beans, lentils, black-eyed peas, and cowpeas are among the most filling foods per calorie you can eat. Moimoi, akara, and stewed beans keep you full for hours at a fraction of the calorie cost of processed foods.\n\nLeafy greens like ugwu (fluted pumpkin leaves), bitter leaf, waterleaf, and moringa are dense in micronutrients and nearly calorie-free. Adding them generously to soups and stews costs almost nothing calorically.\n\nWhole tubers — unprocessed yam, sweet potato, cocoyam — are filling and rich in resistant starch that feeds good gut bacteria. Their processed cousins (pounded yam, fufu) have a much higher calorie density per portion.\n\nFermented foods like ogi, gari, and iru are rich in probiotics that support a healthy gut microbiome — and research increasingly links gut diversity to easier weight management.\n\nWhat to watch: palm oil, groundnut oil, and heavy cream-based soups can triple a meal's calorie count without changing the portion size. Use smaller quantities or swap for lighter cooking methods on most days.",
  },
  {
    title: 'How stress stalls weight loss',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400' },
    body: "Chronic stress is one of the most overlooked reasons people eat well, stay active, and still don't lose weight. The mechanism is direct: stress triggers cortisol, and cortisol drives both fat storage and food cravings.\n\nWhen cortisol is chronically elevated, your body stores more fat — especially around the abdomen — and becomes less efficient at burning it. It also drives cravings for high-calorie, high-sugar, high-fat foods. This is why stressed people reach for junk food, not salad.\n\nThis is why some people track calories diligently and see no fat loss: chronic stress is holding the fat in place hormonally.\n\nWhat helps:\n\nSleep — the single biggest cortisol regulator. 7–8 hours non-negotiable. Poor sleep raises cortisol, and high cortisol worsens sleep. It's a cycle you have to break deliberately.\n\nLight movement — walking, gentle yoga, stretching. Not high-intensity exercise when you're already overwhelmed.\n\nBreathing exercises — 5 minutes of slow nasal breathing (4 counts in, 6 counts out) drops cortisol measurably.\n\nReducing stimulants — coffee on top of stress amplifies cortisol. If you're going through a tough period, scale back caffeine.\n\nSometimes the best way to improve weight loss results isn't to eat less. It's to manage stress better.",
  },
  {
    title: "Weight fluctuates — that's normal",
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400' },
    body: "If you weigh yourself every day, you'll see numbers that swing 1–2kg up and down with no obvious pattern. This is completely normal and has almost nothing to do with fat.\n\nDay-to-day weight is mostly water, glycogen, and food in your gut. A salty meal can hold 500g+ of water. Strength training causes muscle inflammation that holds water for days. Hormonal shifts — especially around your menstrual cycle — can swing weight by 2kg easily.\n\nFat loss, by contrast, is slow. A pound of fat is roughly 3,500 calories. Even an aggressive fasting routine creating a 500-calorie daily deficit only burns about half a kilo of fat per week.\n\nThis is why weekly averages matter more than daily readings. If your 7-day average drops over 2–3 weeks, you're losing fat. If it stays flat for a week despite good adherence, you're probably retaining water and the fat is still going down.\n\nA practical approach:\n\nWeigh once a day at the same time, ideally morning after using the bathroom.\n\nIgnore individual numbers. Look at the 7-day rolling average.\n\nTake measurements once a month — waist, hips, chest. These often show progress when the scale doesn't.",
  },
  {
    title: 'The hunger wave passes',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    body: "Hunger isn't a constant signal that gets worse and worse until you eat. It comes in waves. Each wave peaks for about 20 minutes, then fades — whether you eat or not.\n\nThis is one of the most useful things to understand about calorie restriction. The hunger you feel between meals isn't going to keep climbing all day. If you ride it out, it weakens.\n\nThe biology behind it: ghrelin, your hunger hormone, is released in pulses tied to your usual eating schedule. If you normally snack at 3pm, you'll get a ghrelin pulse around then. Skip the snack and the pulse subsides on its own as your body adjusts.\n\nWithin 2–3 weeks of consistent calorie tracking, your ghrelin pulses recalibrate to your new routine. The hunger that felt unbearable the first week becomes barely noticeable.\n\nWhen a wave hits:\n\nDrink a glass of water and wait 10 minutes.\n\nDistract yourself — go for a walk, start a task, take a shower.\n\nRemind yourself it'll pass. Set a timer for 20 minutes and check back in.",
  },
  {
    title: "Calories aren't the whole story",
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=400' },
    body: "A calorie is a calorie when it comes to physics. But your body doesn't process 2,000 calories spread across 12 hours the same way it processes 2,000 calories eaten in 8 hours. Timing matters more than most people realise.\n\nResearch on time-restricted eating shows that people who confine the same calorie intake to a shorter eating window often lose more fat, sleep better, and have better blood-sugar control than those who graze across 14+ hours.\n\nWhy? Several reasons stack up:\n\nYour body becomes more insulin-sensitive when given long stretches without food. Better insulin sensitivity means easier fat-burning and steadier energy.\n\nYour gut, liver, and pancreas all have circadian rhythms. Eating in alignment with daylight (earlier in the day) tends to work better than late-night eating.\n\nLate eating disrupts sleep, and poor sleep raises hunger hormones the next day. Eating earlier is a virtuous cycle.\n\nSo if you're tracking calories diligently but not seeing results, take a look at your eating window. Compressing the same calories into 8–10 hours, ideally finishing 3 hours before bed, often unlocks progress that calorie counting alone can't.",
  },
  {
    title: 'Move more, burn more',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1502810365585-3a92e3ca1b27?w=400' },
    body: "A 10-minute walk after eating does something remarkable: it lowers your blood sugar response by 20–30%. This reduces the insulin spike that drives fat storage and afternoon cravings.\n\nWhen you eat, especially carbs, glucose floods your bloodstream. Insulin rises to clear it into cells. This insulin spike — and the crash that follows — is what makes you hungry an hour after a meal.\n\nWalking activates your muscles, which pull glucose out of your blood without needing as much insulin. The result is smaller blood-sugar swings, smaller hunger swings, and better calorie control throughout the day.\n\nThe science is clear and simple: even a slow, 10-minute walk after each meal beats a single 30-minute walk in the morning, calorie for calorie, when it comes to blood-sugar and appetite control.\n\nNon-exercise activity also adds up fast. Standing instead of sitting, taking stairs, walking to a destination instead of driving — these burn 200–500 extra calories per day without any formal workout. For weight loss, this is often easier to sustain than gym sessions.\n\nAfter your last meal of the day, walk for 10–15 minutes. Don't push the pace — slow walking actually works better for blood-sugar control than fast walking. Most people sleep better too.",
  },
  {
    title: 'Best foods for fat loss',
    time: '5 min read',
    image: { uri: 'https://estherafricanfoods.com/wp-content/uploads/2023/02/Healthy-foods-1080x675.webp' },
    body: "The best weight loss foods are the ones that fill you up the most per calorie. These foods let you hit your calorie goal without feeling deprived — which is what makes a diet sustainable.\n\nLeafy greens (ugwu, bitter leaf, waterleaf, spinach) — virtually calorie-free, high in fibre and micronutrients. Add them generously to every meal.\n\nLegumes (beans, lentils, cowpeas, soybeans) — extremely filling, high in protein and fibre, and cheap. Moimoi and stewed beans are among the best calorie-value meals in African cooking.\n\nEggs — high in protein, moderate in calories, and proven to reduce hunger for hours after eating. Two eggs for breakfast can cut calorie intake at lunch by 400+ calories.\n\nFish and lean meat — high protein, lower calorie density than fatty meat. Grilled or oven-roasted is far better than deep-fried.\n\nFresh fruits — watermelon, pawpaw, oranges, and mangoes are naturally sweet, low-calorie, and filling. They satisfy sugar cravings without the calorie cost of processed sweets.\n\nFoods to watch portions on: palm oil, groundnut oil, peanut butter, and fried snacks. These are not bad foods, but their calorie density is very high — small amounts add up quickly. A tablespoon of oil is 120 calories. Two tablespoons of groundnut paste in a soup is 200 calories. Use with awareness.",
  },
  {
    title: 'Common calorie counting mistakes',
    time: '4 min read',
    image: { uri: 'https://www.manipalhospitals.com/uploads/blog/diet-mistakes-that-affect-overall-health.png' },
    body: "Calorie tracking is a skill, and most people make the same mistakes when starting out. Knowing them in advance saves weeks of frustrating plateau.\n\nMistake #1: Not logging cooking oil. Oil is the most underestimated calorie source in African cooking. A tablespoon of palm or groundnut oil is 120 calories — and most recipes use much more. Weigh or measure oil before cooking.\n\nMistake #2: Underestimating portion sizes. 'A cup of rice' can mean 200 calories or 600 depending on how full the cup is. Use weight (grams) for carbs and protein rather than cups or handfuls until your eye is calibrated.\n\nMistake #3: Forgetting drinks. Malt, juice, sweetened kunu, and added sugar in tea and coffee can add 300–600 calories without feeling like food. Switch to plain water, black tea, or unsweetened drinks.\n\nMistake #4: Eating too little. Counter-intuitively, eating too few calories slows your metabolism and increases muscle loss. Stay above 1,200 calories for women and 1,500 for men unless medically supervised.\n\nMistake #5: Ignoring sleep. Poor sleep raises cortisol and ghrelin (the hunger hormone), making calorie control significantly harder. Prioritise 7–8 hours of quality sleep — it may be doing more work than your diet.",
  },
  {
    title: 'Why energy may feel low',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400' },
    body: "Feeling tired or sluggish when you start eating in a calorie deficit is completely normal, especially in the first 1–2 weeks. Understanding why it happens can help you push through it.\n\nYour body is adapting. When calories drop, your body initially resists by slowing metabolism slightly and producing more hunger hormones. This can feel like fatigue or brain fog. It passes as the body adjusts.\n\nElectrolyte imbalance plays a big role. Eating less food means less sodium, potassium, and magnesium coming in. Low levels of these minerals cause fatigue, headaches, and brain fog. Add a pinch of pink salt to your water or get more potassium-rich foods (bananas, leafy greens, tomatoes).\n\nBlood sugar regulation is adjusting. If you previously ate high-sugar or high-carb foods frequently, your body is used to constant glucose hits. Shifting to higher protein and fibre intake forces blood sugar to stabilise on its own, which initially can feel like low energy.\n\nThe good news? This gets better. Most people report significantly improved and more stable energy levels after 2–3 weeks. Once your body adapts to a lower calorie intake, the energy crashes and constant cravings largely disappear.",
  },
  {
    title: 'Optimize your meal timing',
    time: '6 min read',
    image: { uri: 'https://food-ubc.b-cdn.net/wp-content/uploads/2026/02/AdobeStock_475418037-1024x683.jpeg' },
    body: "When you eat matters almost as much as what you eat. The same calorie intake distributed across your day differently produces different hunger levels, energy, and fat loss results.\n\nPlan your meals in advance. Knowing what you'll eat removes decision fatigue and prevents impulsive, unplanned choices. Meal prep on weekends can save you during busy weekdays when willpower is lowest.\n\nDistribute calories evenly. Three moderate meals work better than one or two large ones for most people. Skipping meals to 'save' calories for later usually leads to overeating at night — the worst time for calorie management.\n\nPrioritize protein at every meal. Aim for 1.6–2.2g of protein per kg of body weight daily. Protein preserves muscle mass during a calorie deficit, keeps you full, and has a high thermic effect — your body burns 20–30% of protein calories just in digestion.\n\nDon't skip fibre. Vegetables, fruits, legumes, and whole grains support gut health and keep digestion smooth. Fibre also slows glucose absorption, preventing energy crashes and cravings.\n\nFinish eating 2–3 hours before bed if possible. Research shows late-night eating leads to more fat storage and worse sleep quality — both of which slow weight loss.",
  },
  {
    title: 'Sleep & weight loss',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=400' },
    body: "Sleep and weight loss are deeply connected. One affects the other more than most people realise, and optimising both can dramatically improve your results.\n\nPoor sleep directly causes fat gain. When you're sleep-deprived, your body produces more ghrelin (hunger hormone) and less leptin (satiety hormone). This makes calorie control feel much harder and increases cravings for high-calorie, sugary foods. Studies show sleep-deprived people eat 385 more calories per day on average.\n\nSleep is also when your body does most of its repair work — building muscle, regulating hormones, and processing the day's metabolic activity. Shortchanging sleep shortchanges recovery.\n\nTiming matters. Eating too close to bedtime disrupts sleep quality. Your body has to focus on digestion instead of repair and recovery. Finish your last meal at least 2–3 hours before you plan to sleep.\n\nCreate a sleep routine that supports your weight loss:\n\nDim lights an hour before bed. Blue-spectrum light from screens suppresses melatonin.\n\nKeep your room cool — 18–20°C. The body needs to drop its core temperature to fall asleep.\n\nAvoid large, heavy meals at night — they delay sleep onset and reduce deep sleep.\n\nMagnesium supplementation can help both sleep and weight loss. It relaxes muscles, calms the nervous system, and can reduce the nighttime cravings that derail progress.",
  },
];

function getDailyArticles(count = 5) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const start = dayOfYear % ARTICLE_POOL.length;
  return Array.from({ length: count }, (_, i) => ARTICLE_POOL[(start + i) % ARTICLE_POOL.length]);
}

const InsightSkeletonCard = () => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={[skeletonStyles.card, { opacity }]}>
      <View style={skeletonStyles.accent} />
      <View style={skeletonStyles.line1} />
      <View style={skeletonStyles.line2} />
      <View style={skeletonStyles.line3} />
    </Animated.View>
  );
};

const skeletonStyles = StyleSheet.create({
  card: {
    width: 140,
    minHeight: 90,
    padding: 16,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#C4C4C4',
  },
  line1: {
    marginLeft: 10,
    marginTop: 2,
    height: 10,
    width: '80%',
    borderRadius: 5,
    backgroundColor: '#C4C4C4',
    marginBottom: 6,
  },
  line2: {
    marginLeft: 10,
    height: 10,
    width: '65%',
    borderRadius: 5,
    backgroundColor: '#C4C4C4',
    marginBottom: 6,
  },
  line3: {
    marginLeft: 10,
    height: 10,
    width: '50%',
    borderRadius: 5,
    backgroundColor: '#C4C4C4',
  },
});

const JfySkeletonCard = () => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View style={[jfySkeletonStyles.card, { opacity }]}>
      <View style={jfySkeletonStyles.line1} />
      <View style={jfySkeletonStyles.line2} />
      <View style={jfySkeletonStyles.line3} />
      <View style={jfySkeletonStyles.btn} />
    </Animated.View>
  );
};

const jfySkeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    minHeight: 160,
    backgroundColor: '#C4C4C4',
    padding: 16,
    justifyContent: 'space-between',
  },
  line1: { height: 14, width: '90%', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 8 },
  line2: { height: 14, width: '75%', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 8 },
  line3: { height: 14, width: '55%', borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.3)' },
  btn:   { height: 38, width: 100, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 'auto' },
});

const TypewriterText = ({ text, style, numberOfLines, delay = 0 }) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const start = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, 28);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(start);
  }, [text, delay]);

  return <Text style={style} numberOfLines={numberOfLines}>{displayed}</Text>;
};

const TodayTab = ({
  currentTime,
  fastingHours,
  fastingMinutes,
  fastingSeconds,
  isFasting,
  isRefining,
  checkedIn,
  hunger,
  energy,
  mood,
  selectedPlan,
  progress,
  circumference,
  strokeDashoffset,
  startDay,
  startHour,
  startMinute,
  endDay,
  endHour,
  endMinute,
  onShowPlanPage,
  onShowCheckInPage,
  onEditStartTime,
  onEditEndTime,
  canEditEndTime,
  onNavigateToProgress,
  onNavigateToHydration,
  onStartFast,
  onEndFast,
  lastFastEndTime,
  fastingSessions,
  recentMeals,
  waterCount,
  waterLogs,
  volumeUnit,
  onShowCalendar,
  checkInHistory,
  weightLogs,
  targetWeight,
  startingWeight,
  dailyCalorieGoal,
  hydrationGoal,
  userName,
  userCountry,
  userJoinDate,
  userId,
  proteinGoal,
  carbsGoal,
  fatsGoal,
  goal,
  isRestoringFast,
  dataReady,
  goalHistory,
  pendingInsightIndex,
  onClearPendingInsight,
  onShowChat,
  onNavigateToMeals,
  onLogMeal,
  eatingStyle,
  eatingWindow,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  const [timeSinceFast, setTimeSinceFast] = useState(null);
  const [justForYouInsight, setJustForYouInsight] = useState(null);
  const [jfyLoading, setJfyLoading] = useState(true);
  const [jfyRefreshing, setJfyRefreshing] = useState(false);
  const [jfyFreshReady, setJfyFreshReady] = useState(false);
  const [jfyExpanded, setJfyExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const buildEnrichedMealLogs = () =>
    (recentMeals || []).map(meal => {
      const ci = (checkInHistory || []).find(c => c.date === meal.date) || null;
      return {
        date: meal.date,
        mealName: meal.name,
        totalCalories: meal.calories || 0,
        ingredients: meal.foods || [],
        feelings: ci?.feelings || [],
        moods: ci?.moods || [],
        fastingStatus: ci?.fastingStatus || null,
        hungerLevel: ci?.hungerLevel || null,
        symptoms: ci?.symptoms || [],
        activities: ci?.activities || [],
        otherFactors: ci?.otherFactors || [],
      };
    });

  const buildPayload = () => ({
    profile: {
      userId,
      userName,
      userCountry,
      userJoinDate,
      goal,
      targetWeight,
      startingWeight,
      dailyCalorieGoal,
      hydrationGoal,
      volumeUnit,
      proteinGoal,
      carbsGoal,
      fatsGoal,
      eatingStyle: eatingStyle || 'flexible',
      eatingWindow: eatingWindow || 'evening',
    },
    fastingSessions: [],
    checkInHistory: checkInHistory || [],
    recentMeals: recentMeals || [],
    weightLogs: weightLogs || [],
    waterLogs: waterLogs || [],
    enrichedMealLogs: buildEnrichedMealLogs(),
    goalHistory: goalHistory || [],
  });

  const fetchInsights = async (payload, forceRefresh = false) => {
    const userId = payload?.profile?.userId;

    // Phase 1 — show cached insight instantly so the screen is never blank
    const cached = await getCachedJustForYou(userId);
    if (cached?.insight) {
      setJustForYouInsight(cached.insight);
      setJfyLoading(false);
    }

    // Phase 2 — fetch fresh insight in the background
    setJfyFreshReady(false);
    setJfyRefreshing(true);
    getJustForYou(payload, forceRefresh)
      .then(({ insight: freshInsight, fromApi }) => {
        if (!freshInsight) return;
        setJustForYouInsight(freshInsight);
        setJfyLoading(false);
        if (fromApi) { setJfyFreshReady(true); setJfyExpanded(false); }
      })
      .catch(() => {})
      .finally(() => setJfyRefreshing(false));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInsights(buildPayload(), true);
    setTimeout(() => setRefreshing(false), 800);
  };

  useEffect(() => {
    if (!userId || !dataReady) return;
    fetchInsights(buildPayload());
  }, [userId, dataReady]);

  // Time since last fast counter
  useEffect(() => {
    if (isFasting) { setTimeSinceFast(null); return; }
    // Use whichever is most recent: the in-memory end time (catches sub-30min
    // fasts that don't get logged to fasting_sessions) or the latest logged
    // session's endTime.
    const latestLogged = (fastingSessions || [])
      .filter(s => s.endTime)
      .sort((a, b) => Number(b.endTime) - Number(a.endTime))[0]?.endTime;
    const eatingWindowStart = Math.max(
      Number(lastFastEndTime) || 0,
      Number(latestLogged) || 0,
    );
    if (!eatingWindowStart) { setTimeSinceFast(null); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - eatingWindowStart) / 1000);
      if (diff < 0) { setTimeSinceFast(null); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setTimeSinceFast({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isFasting, fastingSessions, lastFastEndTime]);

  const formatDate = () => {
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const meals = recentMeals || [];
  const todayCalories = meals
    .filter(m => m.date === new Date().toDateString())
    .reduce((sum, m) => sum + (m.calories || 0), 0);

  const formatTime = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const formatDisplayDate = (label) => {
    if (!label || label === '--') return '--';
    return label;
  };

  const getStageInfo = () => {
    const targetHours = parseInt((selectedPlan || '16:8').split(':')[0], 10) || 16;
    const elapsedHours = fastingHours + (fastingMinutes / 60);
    const progressRatio = targetHours > 0 ? elapsedHours / targetHours : 0;

    if (progressRatio < 0.25) return { stage: 'Fed State', desc: 'Your body is still processing recent meals.' };
    if (progressRatio < 0.5) return { stage: 'Settling In', desc: 'Your fast is underway and your body is easing into it.' };
    if (progressRatio < 0.75) return { stage: 'Fat-Burning Shift', desc: 'Your body may be leaning more on stored energy now.' };
    if (progressRatio < 1) return { stage: 'Almost There', desc: 'You are getting close to your fasting goal.' };
    return { stage: 'Goal Reached', desc: 'You have reached your fasting goal and are now fasting beyond it.' };
  };

  // === Dynamic Today's Insights ===
  const todayStr = new Date().toISOString().split('T')[0];

  const todayWater = (waterLogs || [])
    .filter(w => w.date === todayStr)
    .reduce((sum, w) => sum + (w.amount || 1), 0);

  // Streak = days where meals were logged and calories stayed within goal
  const onGoalDates = new Set(
    Object.entries(
      (recentMeals || []).reduce((acc, m) => {
        const d = m.date || '';
        if (!acc[d]) acc[d] = 0;
        acc[d] += m.calories || 0;
        return acc;
      }, {})
    )
      .filter(([, total]) => dailyCalorieGoal && total > 0 && total <= dailyCalorieGoal)
      .map(([d]) => d)
  );
  let streak = 0;
  const streakDate = new Date();
  for (let i = 0; i < 30; i++) {
    if (onGoalDates.has(streakDate.toISOString().split('T')[0])) {
      streak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else break;
  }

  const sortedWeights = [...(weightLogs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentWeightVal = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].weight : null;
  const weightUnitVal = sortedWeights.length ? sortedWeights[sortedWeights.length - 1].unit : 'kg';
  const weightLostVal = startingWeight && currentWeightVal
    ? parseFloat((startingWeight - currentWeightVal).toFixed(1))
    : null;

  const stageInfo = getStageInfo();

  const insights = [];

  // Card 1: Calorie goal progress
  if (todayCalories > 0 && dailyCalorieGoal) {
    const remaining = dailyCalorieGoal - todayCalories;
    const ratio = todayCalories / dailyCalorieGoal;
    insights.push({
      title: ratio > 1.05 ? 'Over your goal today' : ratio > 0.85 ? 'Almost at your goal' : 'Calories left today',
      subtitle: ratio > 1.05
        ? `You're ${Math.abs(remaining).toLocaleString()} cal over — keep tomorrow's meals light`
        : ratio > 0.85
        ? `${remaining.toLocaleString()} cal to go — you're doing great`
        : `${remaining.toLocaleString()} cal remaining — stay on track`,
      color: '#E8F5E9', accent: '#4CAF50',
    });
  } else {
    insights.push({ title: "Track your first meal", subtitle: "Start logging to see your progress here", color: '#E8F5E9', accent: '#4CAF50' });
  }

  // Card 2: Meal quality nudge
  if (todayCalories > 0 && dailyCalorieGoal) {
    const ratio = todayCalories / dailyCalorieGoal;
    const over = ratio > 1.1;
    const under = ratio < 0.5;
    insights.push({
      title: over ? 'Watch your next meal' : under ? 'Make sure you eat enough' : "You're eating well today",
      subtitle: over ? 'You may have gone a bit heavy — keep it light next time'
               : under ? 'Under-eating can slow your progress just like overeating'
               : 'Your body is getting what it needs',
      color: over ? '#FFF3E0' : '#E3F2FD', accent: over ? '#FF9800' : '#2196F3',
    });
  } else {
    insights.push({ title: "Log your meals", subtitle: "Tracking what you eat is the first step", color: '#FFF3E0', accent: '#FF9800' });
  }

  // Card 3: Hydration nudge
  if ((waterLogs || []).length > 0 && hydrationGoal) {
    const hitGoal = todayWater >= hydrationGoal;
    const low = todayWater === 0;
    insights.push({
      title: hitGoal ? 'Hydrated and thriving' : low ? 'Your body is thirsty' : 'Keep sipping',
      subtitle: hitGoal ? 'Great job — hydration reduces hunger and boosts energy'
               : low ? "You haven't had any water yet today — that matters"
               : "You're on your way — don't stop now",
      color: '#E3F2FD', accent: '#2196F3',
    });
  } else {
    insights.push({ title: "Hydration tip", subtitle: "Stay energized today", color: '#E3F2FD', accent: '#2196F3' });
  }

  // Card 4: Motivation — streak or weight progress
  if (streak > 1) {
    insights.push({
      title: streak >= 7 ? 'You are unstoppable' : 'You are building a habit',
      subtitle: streak >= 7 ? 'A full week of consistency — that is rare and powerful'
               : 'Every day you show up makes the next one easier',
      color: '#FCE4EC', accent: '#E91E63',
    });
  } else if (weightLostVal != null && weightLostVal > 0) {
    insights.push({
      title: 'Your body is changing',
      subtitle: 'The scale is moving — what you are doing is working. Stay the course.',
      color: '#FCE4EC', accent: '#E91E63',
    });
  } else {
    insights.push({ title: "Stay motivated", subtitle: "Log your meals to build a streak", color: '#FCE4EC', accent: '#E91E63' });
  }

  // === Alert card — real observation from user data ===
  const recentCheckIns = (checkInHistory || []).filter(c => {
    const d = new Date(c.date);
    return Date.now() - d.getTime() < 14 * 24 * 60 * 60 * 1000;
  });
  const recentSessions14 = (fastingSessions || []).filter(s => {
    const d = new Date(s.date || s.startTime);
    return Date.now() - d.getTime() < 14 * 24 * 60 * 60 * 1000;
  });
  const completedRecent = recentSessions14.filter(s => s.endTime).length;
  const abandonedRecent = recentSessions14.length - completedRecent;

  const calorieRatio = dailyCalorieGoal > 0 ? todayCalories / dailyCalorieGoal : null;
  const significantlyOver = calorieRatio !== null && calorieRatio > 1.15;
  const significantlyUnder = calorieRatio !== null && calorieRatio < 0.5 && todayCalories > 0;


  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const sessions = fastingSessions || [];

  // Calorie ring calculations
  const CAL_CIRCUMFERENCE = 2 * Math.PI * 90;
  const calRatio = dailyCalorieGoal > 0 ? Math.min(todayCalories / dailyCalorieGoal, 1) : 0;
  const calOffset = CAL_CIRCUMFERENCE * (1 - calRatio);
  const calRemaining = Math.max((dailyCalorieGoal || 0) - todayCalories, 0);
  const isCalOver = dailyCalorieGoal > 0 && todayCalories > dailyCalorieGoal;

  // Today's meals
  const todayDateStr = new Date().toDateString();
  const todayMeals = (recentMeals || []).filter(m => m.date === todayDateStr);

  // Eating-style-aware meal context
  const hour = new Date().getHours();
  const style = eatingStyle || 'flexible';
  const window = eatingWindow || 'evening';

  const getMealContext = () => {
    if (style === 'omad') {
      const windowRanges = { morning: [6, 12], midday: [11, 15], evening: [17, 22], night: [20, 24] };
      const [wStart, wEnd] = windowRanges[window] || [17, 22];
      if (hour >= wStart && hour < wEnd)
        return { label: 'Your meal for today', budgetRatio: 1.0 };
      return { label: null, budgetRatio: 0 }; // outside window — hide suggestions
    }

    if (style === '2x') {
      const isMorning = hour >= 6 && hour < 12;
      const isEvening = hour >= 17 && hour < 22;
      if (isMorning) return { label: 'First meal of the day',    budgetRatio: 0.50 };
      if (isEvening) return { label: 'Second meal of the day',   budgetRatio: 0.50 };
      return { label: 'Between meals — keep it light', budgetRatio: 0.08, maxCal: 200 };
    }

    if (style === '3x') {
      if (hour >= 5  && hour < 11) return { label: 'Try one of these for breakfast', budgetRatio: 0.25 };
      if (hour >= 11 && hour < 15) return { label: 'Lunch ideas for you',            budgetRatio: 0.35 };
      if (hour >= 15 && hour < 18) return { label: 'Want a snack? You have options', budgetRatio: 0.12, maxCal: 300 };
      if (hour >= 18 && hour < 22) return { label: "What's for dinner?",             budgetRatio: 0.30 };
      return { label: 'Late night snack ideas', budgetRatio: 0.08, maxCal: 200 };
    }

    if (style === '4x') {
      if (hour >= 5  && hour < 10) return { label: 'Breakfast ideas',       budgetRatio: 0.20 };
      if (hour >= 10 && hour < 12) return { label: 'Mid-morning snack',     budgetRatio: 0.10, maxCal: 250 };
      if (hour >= 12 && hour < 15) return { label: 'Lunch ideas',           budgetRatio: 0.30 };
      if (hour >= 15 && hour < 17) return { label: 'Afternoon snack',       budgetRatio: 0.10, maxCal: 250 };
      if (hour >= 17 && hour < 22) return { label: "What's for dinner?",    budgetRatio: 0.25 };
      return { label: 'Late snack', budgetRatio: 0.05, maxCal: 150 };
    }

    // flexible — time label only, budget = all remaining
    if (hour >= 5  && hour < 11) return { label: 'Try one of these for breakfast', budgetRatio: 1.0 };
    if (hour >= 11 && hour < 15) return { label: 'Lunch ideas for you',            budgetRatio: 1.0 };
    if (hour >= 15 && hour < 18) return { label: 'Want a snack?',                  budgetRatio: 0.15, maxCal: 400 };
    if (hour >= 18 && hour < 22) return { label: "What's for dinner?",             budgetRatio: 1.0 };
    return { label: 'Late night snack ideas', budgetRatio: 0.10, maxCal: 200 };
  };

  const mealContext = getMealContext();
  const slotBudget = mealContext.budgetRatio === 0 ? 0
    : dailyCalorieGoal
      ? Math.min(
          mealContext.maxCal ?? Math.round(dailyCalorieGoal * mealContext.budgetRatio),
          isCalOver ? 0 : calRemaining
        )
      : 600;
  const suggestedRecipes = (AFRICAN_RECIPES || [])
    .filter(r => r.calories <= Math.max(slotBudget, 150))
    .slice(0, 3);

  // Calorie adherence this week
  const getWeekCalHistory = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    return weekDays.map((_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      if (day > today) return null;
      const ds = day.toDateString();
      const dayCals = (recentMeals || []).filter(m => m.date === ds).reduce((s, m) => s + (m.calories || 0), 0);
      if (dayCals === 0 || !dailyCalorieGoal) return null;
      const ratio = dayCals / dailyCalorieGoal;
      return ratio >= 0.7 && ratio <= 1.15 ? true : false;
    });
  };
  const calHistory = getWeekCalHistory();

  const patternCards = getDailyArticles(5);

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedSuggestedRecipe, setSelectedSuggestedRecipe] = useState(null);

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.headerCompact}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarTextSmall}>JK</Text>
        </View>
        <View style={styles.dateContainer}>
          <Text style={styles.dateTextSmall}>{formatDate()}</Text>
        </View>
        <TouchableOpacity style={styles.calendarBtnSmall} onPress={onShowCalendar}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' && <View style={{ height: 44 }} />}

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {/* Calorie Ring Hero */}
        <View style={styles.heroCardCompact}>
          <View style={styles.heroContent}>
            <TouchableOpacity style={styles.fastTypeBadge} onPress={onNavigateToProgress}>
              <Text style={styles.fastTypeBadgeText}>
                {dailyCalorieGoal ? `${dailyCalorieGoal.toLocaleString()} cal daily goal` : 'Set a calorie goal'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#059669" />
            </TouchableOpacity>

            <View style={styles.progressRingSmall}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                <Defs>
                  <LinearGradient id="calGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor={isCalOver ? '#EF4444' : '#059669'} />
                    <Stop offset="100%" stopColor={isCalOver ? '#F97316' : '#34D399'} />
                  </LinearGradient>
                </Defs>
                <Circle cx="100" cy="100" r="90" stroke={isCalOver ? '#FEE2E2' : '#D1FAE5'} strokeWidth="8" fill="none" />
                <Circle
                  cx="100" cy="100" r="90"
                  stroke={isCalOver ? '#EF4444' : 'url(#calGradient)'}
                  strokeWidth="10" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={CAL_CIRCUMFERENCE}
                  strokeDashoffset={calOffset}
                  transform="rotate(-90 100 100)"
                />
              </Svg>
              <View style={styles.progressInnerSmall}>
                <Text style={[styles.fastingLabelSmall, isCalOver && { color: '#EF4444' }]}>
                  {isCalOver ? 'OVER GOAL' : calRemaining === 0 && dailyCalorieGoal ? 'GOAL MET' : 'REMAINING'}
                </Text>
                <Text style={[styles.timeDisplayCompact, { fontSize: 36 }]}>
                  {isCalOver
                    ? `+${(todayCalories - (dailyCalorieGoal || 0)).toLocaleString()}`
                    : dailyCalorieGoal ? calRemaining.toLocaleString() : '--'}
                </Text>
                <Text style={[styles.stageTextSmall, isCalOver && { color: '#EF4444' }]}>cal</Text>
              </View>
            </View>

            <View style={styles.fastTimesRow}>
              <View style={styles.fastTimeBlock}>
                <Text style={styles.fastTimeLabel}>EATEN</Text>
                <Text style={styles.fastTimeValue}>{todayCalories > 0 ? todayCalories.toLocaleString() : '--'}</Text>
                <Text style={styles.fastTimeDate}>calories</Text>
              </View>
              <View style={styles.fastTimeDivider} />
              <View style={styles.fastTimeBlock}>
                <Text style={styles.fastTimeLabel}>GOAL</Text>
                <Text style={styles.fastTimeValue}>{dailyCalorieGoal ? dailyCalorieGoal.toLocaleString() : '--'}</Text>
                <Text style={styles.fastTimeDate}>calories</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.checkInBtnIntegrated} onPress={onShowCheckInPage}>
              <Text style={styles.checkInIcon}>+</Text>
              <Text style={styles.checkInText}>Check In</Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* What to Eat Next */}
        {suggestedRecipes.length > 0 && slotBudget > 0 && (
          <View style={[styles.sectionTight, { marginTop: 8 }]}>
            <Text style={styles.sectionTitleTight}>
              {isCalOver ? "You've hit your goal \u2014 light options only" : mealContext.label}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eduScrollCompact}>
              {suggestedRecipes.map((recipe, i) => (
                <RecipeCard
                  key={i}
                  recipe={recipe}
                  userCountry={userCountry}
                  onPress={() => setSelectedSuggestedRecipe(recipe)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Just for You — daily AI coach insight */}
        <View style={[styles.sectionTight, { marginTop: 36 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={[styles.sectionTitleTight, { marginBottom: 0, flex: 1 }]}>{'\u{1F4A1}'} Just for {userName || 'You'}</Text>
            {jfyRefreshing ? (
              <Text style={{ fontSize: 12, color: '#059669', fontWeight: '500' }}>Refreshing...</Text>
            ) : (
              <TouchableOpacity
                onPress={() => fetchInsights(buildPayload(), true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 18, color: '#059669' }}>↻</Text>
              </TouchableOpacity>
            )}
            {!jfyRefreshing && jfyFreshReady && (
              <View style={{ backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>New</Text>
              </View>
            )}
          </View>
          {jfyLoading ? (
            <JfySkeletonCard />
          ) : justForYouInsight ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => { setJfyExpanded(true); setJfyFreshReady(false); }}
              style={{ backgroundColor: '#059669', borderRadius: 16, padding: 16, minHeight: 160, justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 22, color: 'rgba(255,255,255,0.92)', flex: 1, marginBottom: 16 }} numberOfLines={4}>
                {justForYouInsight}
              </Text>
              <View style={styles.eduBtn}>
                <Text style={styles.eduBtnText}>Read more</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* This Week */}
        <View style={[styles.sectionTight, { marginTop: 36 }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>This Week</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyCard}>
            <Text style={styles.historyCardSubtitle}>Days you hit your calorie goal</Text>
            <View style={styles.historyDots}>
              {weekDays.map((day, i) => (
                <View key={i} style={styles.historyDay}>
                  <View style={[
                    styles.historyDot,
                    {
                      backgroundColor: calHistory[i] === null ? colors.cardAlt : calHistory[i] ? '#059669' : 'transparent',
                      borderWidth: calHistory[i] === false ? 2 : 0,
                      borderColor: calHistory[i] === false ? colors.border : 'transparent',
                    }
                  ]}>
                    {calHistory[i] === true && <Text style={styles.dotCheck}>{'\u2713'}</Text>}
                  </View>
                  <Text style={[styles.dayLabel, { color: i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) ? '#059669' : colors.textMuted }]}>{day}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Your Stats */}
        <View style={styles.sectionTight}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>Your Stats</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          {(() => {
            const now = new Date();
            const last7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now); d.setDate(d.getDate() - i); return d.toDateString();
            });
            const week7Meals = (recentMeals || []).filter(m => last7.includes(m.date));
            const daysLogged = new Set(week7Meals.map(m => m.date)).size;
            const totalCals7 = week7Meals.reduce((s, m) => s + (m.calories || 0), 0);
            const avgCals = daysLogged > 0 ? Math.round(totalCals7 / daysLogged) : 0;
            const daysOnTarget = last7.filter(d => {
              const dc = (recentMeals || []).filter(m => m.date === d).reduce((s, m) => s + (m.calories || 0), 0);
              if (!dc || !dailyCalorieGoal) return false;
              const r = dc / dailyCalorieGoal; return r >= 0.7 && r <= 1.15;
            }).length;

            return (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{daysLogged > 0 ? avgCals.toLocaleString() : '--'}</Text>
                  <Text style={styles.statLabel}>Avg daily cal</Text>
                  {daysLogged > 0 && dailyCalorieGoal > 0 && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>{avgCals <= dailyCalorieGoal * 1.1 ? 'On track' : 'High'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{daysLogged > 0 ? daysLogged : '--'}</Text>
                  <Text style={styles.statLabel}>Days logged</Text>
                  {daysLogged > 0 && (
                    <View style={[styles.statBadge, { backgroundColor: daysLogged >= 5 ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.statBadgeText, { color: daysLogged >= 5 ? '#2E7D32' : '#E65100' }]}>{daysLogged >= 5 ? 'Great' : 'Keep going'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{dailyCalorieGoal ? daysOnTarget : '--'}</Text>
                  <Text style={styles.statLabel}>Goal days (7d)</Text>
                  {dailyCalorieGoal > 0 && daysOnTarget > 0 && (
                    <View style={[styles.statBadge, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.statBadgeText, { color: '#2E7D32' }]}>{'\u{1F525}'}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Calories & Hydration */}
        <View style={styles.sectionTight}>
          <View style={styles.wellnessCard}>
            <View style={styles.wellnessItem}>
              <Text style={styles.wellnessIcon}>{'\u{1F372}'}</Text>
              <View style={styles.wellnessInfo}>
                <Text style={styles.wellnessLabel}>Today's Calories</Text>
                <Text style={styles.wellnessValue}>{todayCalories > 0 ? `${todayCalories.toLocaleString()} cal` : '--'}</Text>
              </View>
            </View>
            <View style={styles.wellnessDivider} />
            <View style={styles.wellnessItem}>
              <Text style={styles.wellnessIcon}>{'\u{1F4A7}'}</Text>
              <View style={styles.wellnessInfo}>
                <Text style={styles.wellnessLabel}>Hydration</Text>
                <Text style={styles.wellnessValue}>{(() => {
                  const logs = waterLogs || [];
                  const today = new Date().toDateString();
                  const todayLogs = logs.filter(l => l.date === today);
                  if (todayLogs.length === 0) return '--';
                  const totalML = todayLogs.reduce((sum, l) => {
                    const ml = l.unit === 'mL' ? l.amount : l.unit === 'oz' ? l.amount * 29.574 : l.unit === 'sachet' ? l.amount * 500 : l.unit === 'bottle' ? l.amount * 750 : l.amount * 237;
                    return sum + ml;
                  }, 0);
                  return `${(totalML / 1000).toFixed(1)} L`;
                })()}</Text>
              </View>
            </View>
          </View>
        </View>


        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Just for You — full insight modal */}
      <Modal
        visible={jfyExpanded}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setJfyExpanded(false)}
      >
        <View style={[styles.articleModal, Platform.OS === 'android' && { paddingTop: 44 }]}>
          <View style={styles.articleHeader}>
            <TouchableOpacity onPress={() => setJfyExpanded(false)} style={styles.articleCloseBtn}>
              <Text style={styles.articleCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.articleHeaderTitle}>Today's Insight</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.articleScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <FormattedText text={justForYouInsight || ''} bodyStyle={[styles.insightDetailBody, { fontSize: 15.5, lineHeight: 24 }]} />
            {onShowChat && (
              <TouchableOpacity
                style={{ marginTop: 28, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                onPress={() => { setJfyExpanded(false); onShowChat(`I just read today's insight — can you tell me more?`); }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Talk to Coach</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedSuggestedRecipe}
        visible={selectedSuggestedRecipe !== null}
        onClose={() => setSelectedSuggestedRecipe(null)}
        userCountry={userCountry}
        onLogMeal={(meal) => {
          setSelectedSuggestedRecipe(null);
          onLogMeal?.(meal);
        }}
      />

      {/* Article Modal */}
      <Modal
        visible={selectedArticle !== null}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setSelectedArticle(null)}
      >
        <View style={[styles.articleModal, Platform.OS === 'android' && { paddingTop: 44 }]}>
          <View style={styles.articleHeader}>
            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.articleCloseBtn}>
              <Text style={styles.articleCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.articleHeaderTitle}>Insights</Text>
            <View style={{ width: 40 }} />
          </View>
          {selectedArticle && (
            <ScrollView style={styles.articleScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.articleTitle}>{selectedArticle.title}</Text>
              {selectedArticle.image && (
                <Image source={selectedArticle.image} style={styles.articleImage} resizeMode="cover" />
              )}
              <Text style={styles.articleBody}>{selectedArticle.body}</Text>
              <View style={{ height: 60 }} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = (c) => StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: c.appBg,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.08)',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0 } : {}),
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarTextSmall: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dateTextSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
  },
  calendarBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  heroCardCompact: {
    marginTop: 28,
    marginHorizontal: 20,
    padding: 16,
    paddingBottom: 14,
    backgroundColor: c.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  fastTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
    gap: 4,
  },
  fastTypeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  fastTypeBadgeArrow: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '700',
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1,
  },
  progressRingSmall: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingPlaceholder: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    borderColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 2,
  },
  progressRingFill: {
    height: 4,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  progressInnerSmall: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastingLabelSmall: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#059669',
    marginBottom: 2,
  },
  timeDisplayCompact: {
    fontSize: 32,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -1,
    textAlign: 'center',
  },
  stageTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginTop: 6,
  },
  refiningIconSmall: {
    fontSize: 24,
    marginBottom: 4,
  },
  refiningTextSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  checkInBtnIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    marginTop: 8,
    marginBottom: 8,
  },
  checkInIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  checkInText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  fastingControlsContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    gap: 14,
    marginTop: 4,
    paddingHorizontal: 0,
  },
  fastActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.2)',
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
  },
  fastActionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  fastTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '78%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderWidth: 0,
    marginLeft: -8,
  },
  fastTimeBlock: {
    width: '50%',
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'center',
    minHeight: 70,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  fastTimeLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: c.textMuted,
    marginBottom: 4,
  },
  fastTimeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  fastTimeDate: {
    fontSize: 9,
    color: c.textMuted,
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 12,
  },
  fastTimeDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(5, 150, 105, 0.10)',
    marginHorizontal: 0,
  },
  fastTimeDash: {
    color: '#ccc',
  },
  fastTimeEditBadge: {
    position: 'absolute',
    top: 2,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastTimeEditIcon: {
    fontSize: 8,
    color: '#059669',
  },
  sectionTight: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  sectionTitleTight: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sectionTitleTightInline: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
  },
  insightFeelingText: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
    marginLeft: 10,
    lineHeight: 17,
  },
  insightDetailHeader: {
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 18,
    marginTop: 20,
    marginBottom: 4,
  },
  insightDetailFeeling: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  insightDetailSection: {
    marginTop: 24,
  },
  insightDetailLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: c.textMuted,
    marginBottom: 10,
  },
  insightDetailBody: {
    fontSize: 16,
    lineHeight: 26,
    color: c.text,
    letterSpacing: 0.1,
  },
  insightCoachBtn: {
    marginTop: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
  },
  insightCoachBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  eduScrollCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  educationCard: {
    width: 280,
    height: 220,
    backgroundColor: '#1D4ED8',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    marginRight: 12,
  },
  eduContent: {
    zIndex: 1,
    flex: 1,
    justifyContent: 'space-between',
  },
  eduTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  eduFeeling: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 22,
    flex: 1,
    marginBottom: 16,
  },
  eduDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 21,
    marginBottom: 16,
  },
  eduBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  eduBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  patternScrollCompact: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  patternCardLarge: {
    width: 180,
    marginRight: 12,
    marginRight: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  patternImageArea: {
    width: 180,
    height: 140,
    borderRadius: 16,
    marginBottom: 10,
  },
  patternTitleLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  patternTimeLarge: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '400',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seeAllBtn: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  historyCardSubtitle: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: 12,
  },
  emptyMealsCard: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    borderStyle: 'dashed',
  },
  emptyMealsText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
  },
  emptyMealsSub: {
    fontSize: 12,
    color: c.textMuted,
  },
  mealsList: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
    gap: 4,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    gap: 10,
  },
  mealIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: c.text,
  },
  mealCal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  recipeCard: {
    width: 150,
    minHeight: 140,
    padding: 14,
    borderRadius: 16,
    marginRight: 10,
    justifyContent: 'space-between',
  },
  recipeCalBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  historyDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDay: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  historyDot: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 10,
    color: c.textSecondary,
    textAlign: 'center',
  },
  statBadge: {
    marginTop: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#EDE9FE',
  },
  statBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  wellnessCard: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  wellnessItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wellnessIcon: {
    fontSize: 28,
  },
  wellnessInfo: {
    flexDirection: 'column',
    gap: 2,
  },
  wellnessLabel: {
    fontSize: 12,
    color: c.textSecondary,
  },
  wellnessValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  wellnessActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  wellnessActionBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#059669',
    borderRadius: 10,
    alignItems: 'center',
  },
  wellnessActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  wellnessActionLink: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 10,
    alignItems: 'center',
  },
  wellnessActionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  wellnessDivider: {
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 20,
  },
  premiumCard: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  premiumContent: {
    zIndex: 1,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    marginBottom: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  premiumList: {
    marginBottom: 14,
  },
  premiumItem: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  premiumBtn: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: c.card,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  premiumBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  bottomSpacer: {
    height: 90,
  },
  articleModal: {
    flex: 1,
    backgroundColor: c.card,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  articleCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  articleCloseText: {
    fontSize: 20,
    color: c.text,
    fontWeight: '300',
  },
  articleHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
  },
  articleScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  articleTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    lineHeight: 34,
    marginTop: 20,
    marginBottom: 16,
  },
  articleImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
  },
  articleBody: {
    fontSize: 16,
    lineHeight: 26,
    color: c.text,
    letterSpacing: 0.2,
  },
});

export default TodayTab;
