import Ionicons from '@expo/vector-icons/Ionicons';
import { quickWaterLabel } from '../lib/waterQuickAdd';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image, Modal, Platform, Animated, RefreshControl } from 'react-native';
import { useTheme } from '../lib/theme';
import { getJustForYou, getCachedJustForYou, getProJustForYou, getCachedProJustForYou, LENS_LABELS } from '../lib/claudeInsights';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../lib/subscription';
import { unlock } from './ProLock';
import FormattedText from '../lib/FormattedText';
import { resolveCalorieGoal, resolveCaloriesEaten, buildDailyLedgerMap } from '../lib/goalHistory';
import { SourceList, SourcesLink } from './HealthSourcesPage';
import { DayMealsCard, ShimmerLogButton } from './MealPages';
import Svg, { Path } from 'react-native-svg';
import RiveCalorieGauge from './RiveCalorieGauge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Half-circle calorie gauge made of 16 rounded segments; filled ones are what's been eaten.
// Drawn in a 316x158 box and scaled to the card.
const GAUGE_W = Math.min(316, SCREEN_WIDTH - 76);
const GAUGE_SEGMENTS = 16;
const GAUGE_GAP_DEG = 4.2;
const gaugeSegmentPaths = (() => {
  const cx = 158, cy = 152, R = 148, r = 98;
  const seg = (180 - GAUGE_GAP_DEG * (GAUGE_SEGMENTS - 1)) / GAUGE_SEGMENTS;
  const pt = (rad, deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy - rad * Math.sin(a)).toFixed(1)}`;
  };
  return Array.from({ length: GAUGE_SEGMENTS }, (_, i) => {
    const a0 = 180 - i * (seg + GAUGE_GAP_DEG);
    const a1 = a0 - seg;
    return `M${pt(r, a0)} L${pt(R, a0)} A${R} ${R} 0 0 1 ${pt(R, a1)} L${pt(r, a1)} A${r} ${r} 0 0 0 ${pt(r, a0)} Z`;
  });
})();

const CalorieGauge = ({ ratio, over, width }) => {
  const filled = over ? GAUGE_SEGMENTS : Math.round(Math.max(0, Math.min(ratio, 1)) * GAUGE_SEGMENTS);
  const on = over ? '#EF4444' : '#059669';
  return (
    <Svg width={width} height={width / 2} viewBox="0 0 316 158">
      {gaugeSegmentPaths.map((d, i) => {
        const color = i < filled ? on : '#E3F4EA';
        return <Path key={i} d={d} fill={color} stroke={color} strokeWidth={6} strokeLinejoin="round" />;
      })}
    </Svg>
  );
};
// Horizontal-scroll cards: size so the first card nearly fills the viewport
// and the next one peeks in at the edge, inviting a scroll. 20 = section's
// side gutter (x2), 28 = how much of the next card shows.
const SCROLL_CARD_GUTTER = 20;
const SCROLL_CARD_PEEK = 28;
const SCROLL_CARD_WIDTH = SCREEN_WIDTH - SCROLL_CARD_GUTTER * 2 - SCROLL_CARD_PEEK;
// Just for You cards are narrower, so a good part of the next coloured card shows.
const JFY_CARD_PEEK = 88;
const JFY_CARD_WIDTH = SCREEN_WIDTH - SCROLL_CARD_GUTTER * 2 - JFY_CARD_PEEK;

const getInitials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Pool of long-form articles. Images live in assets/pattern-articles/ —
// replace a file there (same filename) to update an article's image.
const ARTICLE_POOL = [
  {
    title: 'Fat burning starts here',
    time: '4 min read',
    image: require('../../assets/pattern-articles/fat-burning-starts-here.jpg'),
    sources: ['westerterp2004', 'wishnofsky1958', 'hall2011', 'rosenbaum2010'],
    body: "A calorie deficit is the engine behind fat loss. When you consistently eat fewer calories than your body burns, it has to pull energy from stored fat. That is the fundamental truth behind every successful weight loss approach.\n\nThe science is straightforward. Your body burns calories through three channels: your basal metabolic rate (what you burn at rest), the thermic effect of food (energy used to digest meals), and physical activity. Add them up and you get your total daily energy expenditure (TDEE).\n\nEat below your TDEE and your body makes up the difference from fat stores. The math works out to roughly 7,700 calories of deficit per kilogram of fat lost. That means a 500-calorie daily deficit burns about half a kilo of fat per week.\n\nThe key word is sustainable. Aggressive deficits (cutting too many calories) often backfire because they trigger muscle loss, slow your metabolism, and make hunger unmanageable. A moderate deficit of 300–500 calories daily is the sweet spot for most people.\n\nA practical tip: start each meal with protein and vegetables before adding carbs. This naturally reduces your calorie intake without feeling deprived.",
  },
  {
    title: 'Protein protects muscle',
    time: '4 min read',
    image: require('../../assets/pattern-articles/protein-protects-muscle.jpg'),
    sources: ['issnProtein2017', 'schoenfeld2018', 'morton2018'],
    body: "Many people worry that cutting calories will eat away their hard-earned muscle. That fear has a kernel of truth, and getting enough protein is how you handle it.\n\nYour body has two main fuel banks: fat and muscle protein. When calories are restricted, it can pull from both. The better your protein intake, the more your body protects muscle and burns fat instead.\n\nResearch suggests that people eating less who get enough protein keep more of their muscle than those who under-eat protein. Aim for 1.6–2.2 grams of protein per kilogram of body weight, spread across your meals.\n\nGood African sources include eggs, fish, beans, lentils, peanuts, milk, yoghurt, and meat. If you're plant-based, combine grains and legumes (rice and beans, or moimoi with bread) to get a complete amino-acid profile.\n\nA practical approach: anchor every meal with a protein source first, then build the rest of the plate around it. This naturally keeps protein high and total calories in check.",
  },
  {
    title: 'Water amplifies weight loss',
    time: '3 min read',
    image: require('../../assets/pattern-articles/water-amplifies-weight-loss.jpg'),
    sources: ['efsaWater2010', 'dennis2010'],
    body: "Some of the hunger you feel between meals can actually be thirst. The signals are easy to mix up, and mild dehydration can feel a lot like a craving.\n\nWhen you're eating in a calorie deficit, you're often getting less water from food too, so dehydration is a real risk. The result is headaches, fatigue, brain fog, and hunger that is really a thirst signal.\n\nA simple test: when you feel a craving hit, drink a full glass of water and wait 10 minutes. Often, the feeling passes. If it stays, that's real hunger and worth addressing with a planned meal or snack.\n\nHealth guidance suggests about 2 litres of drinks a day for women and 2.5 litres for men, and more in hot weather or when you are active. Sparkling water, plain tea, and black coffee in moderation also count and add no calories.\n\nIf the heat where you live is intense, add a pinch of salt or some electrolytes. You'll lose more sodium through sweat, and water alone can leave you feeling worse instead of better.",
  },
  {
    title: 'Sleep is your secret weapon',
    time: '4 min read',
    image: require('../../assets/pattern-articles/sleep-is-your-secret-weapon.jpg'),
    sources: ['spiegel2004', 'taheri2004', 'nhsSleep', 'sleepFoundationTemp'],
    body: "In one controlled study, healthy young men who slept only 4 hours a night for two nights had 28% more ghrelin (the hunger hormone) and 18% less leptin (the fullness hormone) than after two nights of 10 hours. The result is what feels like uncontrollable hunger the next day.\n\nThis is why sticking to your calorie goal feels impossible after a bad night — it's not willpower, it's hormones.\n\nThe relationship runs both ways. Better eating habits and lighter evening meals improve deep sleep. So a consistent calorie routine and a consistent sleep routine reinforce each other.\n\nWhat actually moves the needle on sleep:\n\nFinish eating 2–3 hours before bed. Large, late meals can make it harder to sleep well.\n\nKeep your room cool — 18–20°C. The body needs to drop its core temperature to fall asleep.\n\nDim lights an hour before bed. Bright overhead lights, especially blue-spectrum from screens, suppress melatonin.\n\nIf there's one habit that protects everything else — calorie control, weight loss, mood, energy — it's protecting your sleep.",
  },
  {
    title: 'The calorie deficit sweet spot',
    time: '4 min read',
    image: require('../../assets/pattern-articles/calorie-deficit-sweet-spot.jpg'),
    sources: ['hall2011', 'rosenbaum2010', 'niddkSafe'],
    body: "Not all calorie deficits are equal. Too small and fat loss stalls. Too large and you lose muscle, slow your metabolism, and burn out. The sweet spot for most people sits between 300 and 500 calories below maintenance.\n\nA 500-calorie daily deficit is the classic approach. It burns roughly half a kilogram of fat per week — fast enough to see real progress, slow enough to preserve muscle and keep hunger manageable.\n\nGoing lower (200–300 calories) works well if you're close to your goal weight or prefer a slow, sustainable approach with very little hunger. The trade-off is slower results.\n\nGoing higher (600–750 calories) can accelerate fat loss short-term but often leads to muscle loss, fatigue, and intense cravings that derail consistency. For most people, very large deficits are also much harder to keep up for long.\n\nA practical way to find your sweet spot: track your weight as a 7-day rolling average. If it drops 0.3–0.7 kg per week, your deficit is right. If it stalls, cut 100 calories. If it drops faster than 1 kg per week, increase calories slightly to protect muscle.",
  },
  {
    title: 'Electrolytes matter',
    time: '4 min read',
    image: require('../../assets/pattern-articles/electrolytes-matter.jpg'),
    sources: ['nhsMinerals', 'whoSalt'],
    body: "When you eat in a calorie deficit, electrolyte balance matters more than most people realise. Eating less food means less sodium, potassium, and magnesium coming in — and low levels of these minerals cause fatigue, headaches, leg cramps, and cravings that feel impossible to manage.\n\nThis is why some people feel terrible on a calorie deficit even when they're doing everything else right. Sometimes low electrolytes are part of the reason.\n\nThree minerals matter most:\n\nSodium: if you sweat a lot, a small pinch of salt in your water can help. Most people cutting calories can still get adequate sodium through normal seasoning.\n\nPotassium: avocado, banana, leafy greens, and tomatoes are excellent sources. These are also very low calorie, making them ideal weight loss foods.\n\nMagnesium: dark leafy greens, nuts (especially almonds and cashews), pumpkin seeds, and dark chocolate. If you are thinking about a magnesium supplement, check with a pharmacist or doctor first.\n\nA simple electrolyte drink: 500ml water + a small pinch of salt + a squeeze of lime. Most people eat more salt than they need, so keep it small unless you sweat heavily.",
  },
  {
    title: 'Starting your day with the right food',
    time: '5 min read',
    image: require('../../assets/pattern-articles/starting-your-day-right.jpg'),
    sources: ['leidy2013', 'reynolds2019', 'vanderwal2005'],
    body: "What you eat first in the morning sets the tone for your entire day of calorie management. A high-protein, low-sugar breakfast keeps you full, steady, and in control. A sugar-heavy start triggers a spike-and-crash cycle that drives cravings all day.\n\nThe golden rule: anchor your first meal around protein and fibre. A handful of nuts, eggs, yoghurt, or akara with vegetables. Protein helps you stay full for longer. Fibre slows glucose absorption and keeps you satisfied longer.\n\nFor your main morning meal, build it around protein and vegetables first, then add complex carbs. Eggs with leafy greens, beans with tomato stew, fish with a small portion of yam. The protein keeps you full, the fibre slows digestion.\n\nAvoid these common morning mistakes:\n\nGoing straight to white bread, sugary tea, or a large portion of rice. These spike your blood sugar, drop it fast, and you'll be ravenous by mid-morning.\n\nSkipping breakfast entirely when you're very hungry. Under-eating early often leads to overeating late, which makes hitting your daily calorie goal harder.\n\nFried, heavy, oily foods first thing. Akara every morning adds up — keep the oil-heavy meals as occasional treats, not daily anchors.",
  },
  {
    title: 'Your gut health and weight loss',
    time: '4 min read',
    image: require('../../assets/pattern-articles/gut-health-weight-loss.jpg'),
    sources: ['turnbaugh2006', 'mcdonald2018', 'reynolds2019'],
    body: "Your gut bacteria have a surprisingly large influence on your weight. Research, much of it still early or in animals, suggests your gut microbiome can affect how many calories you get from food and how hungry you feel.\n\nA more diverse gut microbiome is linked with better health. One large study found people who ate 30 or more different plant foods a week had more diverse gut bacteria. That sounds like a lot, but herbs, spices, and different varieties of the same food all count.\n\nFermented foods can add helpful bacteria to your diet.\n\nAfrican fermented foods to prioritise:\n\nOgi (akamu, pap) — fermented millet or maize porridge, gentle on digestion and rich in lactic acid bacteria.\n\nGari — made from fermented cassava.\n\nIru and ogiri — fermented locust beans and melon seeds used in soups, a traditional part of African cooking.\n\nFibre feeds your gut bacteria. Beans, lentils, leafy greens, plantain, and wholegrains — these are not just good for keeping you full (which helps your calorie goal), they also support gut health.",
  },
  {
    title: 'Consistency beats perfection',
    time: '3 min read',
    image: require('../../assets/pattern-articles/consistency-beats-perfection.jpg'),
    sources: ['burke2011'],
    body: "Six imperfect days of calorie tracking beats one perfect day followed by five days of giving up. This is the most important thing to understand about making weight loss actually work in your life.\n\nResults come from consistency, not heroic single-day efforts. Studies of weight loss find that people who keep tracking regularly tend to lose more weight.\n\nWhat consistency looks like:\n\nTracking most days, even when life is busy. An estimate on a hard day is better than logging nothing at all.\n\nForgiving yourself when a day goes over. One heavy meal doesn't undo a week of good habits.\n\nChoosing a calorie target that fits your life. A goal that's sustainable at 80% effort beats one that requires 100% effort every single day.\n\nNot trying to copy someone else's approach. The 'best' calorie plan is the one you can actually stick to for months and years.\n\nThe goal is for tracking to feel as automatic as checking your phone — something you do without much thought. That only comes with consistency.",
  },
  {
    title: 'Morning light resets hunger',
    time: '4 min read',
    image: require('../../assets/pattern-articles/morning-light-resets-hunger.jpg'),
    sources: ['reid2014'],
    body: "Getting natural light early in the day may help with appetite and weight. One study found that people who got most of their bright light in the morning tended to have a lower BMI.\n\nLight hitting your retina early in the morning sets your circadian clock, which controls hundreds of processes — including the release of cortisol, melatonin, leptin, and ghrelin (the hunger and fullness hormones).\n\nA steady body clock helps hunger follow a more predictable daily rhythm.\n\nWhen days are spent in dim rooms and evenings under bright screens, that rhythm can drift, which may make late-night cravings more likely.\n\nThe practical fix is simple: 10–15 minutes outside in the morning, even on a cloudy day. The light intensity outdoors is far higher than indoors, even when it doesn't seem so. It costs nothing and is worth a try.",
  },
  {
    title: 'African foods for weight loss',
    time: '5 min read',
    image: require('../../assets/pattern-articles/african-foods-weight-loss.jpg'),
    sources: ['li2014', 'reynolds2019', 'whoHealthyDiet'],
    body: "African cuisine has a natural head start when it comes to weight loss. Many traditional foods are high in fibre, moderate in protein, and low in processed ingredients — exactly the profile that supports a sustainable calorie deficit.\n\nLegumes are the backbone. Beans, lentils, black-eyed peas, and cowpeas are among the most filling foods per calorie you can eat. Moimoi, akara, and stewed beans keep you full for hours at a fraction of the calorie cost of processed foods.\n\nLeafy greens like ugwu (fluted pumpkin leaves), bitter leaf, waterleaf, and moringa are dense in micronutrients and nearly calorie-free. Adding them generously to soups and stews costs almost nothing calorically.\n\nWhole tubers — unprocessed yam, sweet potato, cocoyam — are filling and rich in resistant starch that feeds good gut bacteria. Their processed cousins (pounded yam, fufu) have a much higher calorie density per portion.\n\nFermented foods like ogi and iru add variety and helpful bacteria, and a varied, plant-rich diet supports a healthy gut.\n\nWhat to watch: palm oil, groundnut oil, and heavy cream-based soups can triple a meal's calorie count without changing the portion size. Use smaller quantities or swap for lighter cooking methods on most days.",
  },
  {
    title: 'How stress stalls weight loss',
    time: '4 min read',
    image: require('../../assets/pattern-articles/stress-stalls-weight-loss.jpg'),
    sources: ['epel2000', 'epel2001', 'nhsBreathing'],
    body: "Chronic stress is one of the most overlooked reasons people eat well, stay active, and still don't lose weight. Stress raises cortisol, and research links high cortisol with more belly fat and more stress eating.\n\nIn studies, women who released more cortisol under stress tended to carry more fat around the abdomen and ate more sweet, high-fat food after a stressful task. This is why stressed people reach for junk food, not salad.\n\nStress also makes it harder to sleep and to stick to a plan, which can slow progress.\n\nWhat helps:\n\nSleep — the single biggest cortisol regulator. 7–8 hours non-negotiable. Poor sleep raises cortisol, and high cortisol worsens sleep. It's a cycle you have to break deliberately.\n\nLight movement — walking, gentle yoga, stretching. Not high-intensity exercise when you're already overwhelmed.\n\nBreathing exercises — a few minutes of slow breathing (4 counts in, 6 counts out) can help you feel calmer.\n\nReducing stimulants — coffee on top of stress amplifies cortisol. If you're going through a tough period, scale back caffeine.\n\nSometimes the best way to improve weight loss results isn't to eat less. It's to manage stress better.",
  },
  {
    title: "Weight fluctuates — that's normal",
    time: '4 min read',
    image: require('../../assets/pattern-articles/weight-fluctuates-normal.jpg'),
    sources: ['kreitzman1992', 'hall2011'],
    body: "If you weigh yourself every day, you'll see numbers that swing 1–2kg up and down with no obvious pattern. This is completely normal and has almost nothing to do with fat.\n\nDay-to-day weight is mostly water, glycogen, and food in your gut. A salty meal can hold 500g+ of water. Strength training causes muscle inflammation that holds water for days. Hormonal shifts — especially around your menstrual cycle — can swing weight by 2kg easily.\n\nFat loss, by contrast, is slow. A kilo of body fat holds thousands of calories, so even steady, sensible eating takes weeks to show up as real fat loss.\n\nThis is why weekly averages matter more than daily readings. If your 7-day average drops over 2–3 weeks, you're losing fat. If it stays flat for a week despite good adherence, you're probably retaining water and the fat is still going down.\n\nA practical approach:\n\nWeigh once a day at the same time, ideally morning after using the bathroom.\n\nIgnore individual numbers. Look at the 7-day rolling average.\n\nTake measurements once a month — waist, hips, chest. These often show progress when the scale doesn't.",
  },
  {
    title: 'The hunger wave passes',
    time: '3 min read',
    image: require('../../assets/pattern-articles/hunger-wave-passes.jpg'),
    sources: ['cummings2001'],
    body: "Hunger isn't a constant signal that gets worse and worse until you eat. It tends to come in waves that build and then ease off, often within a short while, whether you eat or not.\n\nThis is one of the most useful things to understand about calorie restriction. The hunger you feel between meals isn't going to keep climbing all day. If you ride it out, it weakens.\n\nThe biology behind it: ghrelin, your hunger hormone, rises before your usual meal times and falls after you eat. If you normally snack at 3pm, you may feel hungry around then.\n\nMany people find that after a few weeks on a steady routine, the hunger that felt hard in the first week becomes easier to handle.\n\nWhen a wave hits:\n\nDrink a glass of water and wait 10 minutes.\n\nDistract yourself — go for a walk, start a task, take a shower.\n\nRemind yourself it'll pass. Set a timer and check back in.",
  },
  {
    title: "Calories aren't the whole story",
    time: '4 min read',
    image: require('../../assets/pattern-articles/calories-not-whole-story.jpg'),
    sources: ['sutton2018', 'lowe2020', 'vujovic2022'],
    body: "A calorie is a calorie when it comes to physics. When you eat may matter too, although the research is still mixed.\n\nIn one controlled study, eating within an early 6-hour window improved insulin sensitivity and blood pressure even without weight loss. But a larger 2020 trial found that an 8-hour eating window on its own did not lead to more weight loss than eating normally.\n\nWhy timing might help:\n\nEating earlier in the day, rather than late at night, may help blood-sugar control.\n\nYour gut, liver, and pancreas all have circadian rhythms. Eating in alignment with daylight (earlier in the day) tends to work better than late-night eating.\n\nA 2022 study found that eating later in the day increased hunger and lowered the calories people burned.\n\nYour total calories still matter most. If it suits you, finishing your last meal a few hours before bed is an easy habit to try.",
  },
  {
    title: 'Move more, burn more',
    time: '3 min read',
    image: require('../../assets/pattern-articles/move-more-burn-more.jpg'),
    sources: ['dipietro2013', 'buffey2022', 'levine1999', 'whoActivity'],
    body: "A short walk after eating does something useful: it lowers the rise in blood sugar after the meal.\n\nWhen you eat, especially carbs, glucose floods your bloodstream. Insulin rises to clear it into cells. Big swings in blood sugar can leave you feeling tired or hungry.\n\nWalking activates your muscles, which pull glucose out of your blood without needing as much insulin. The result is smaller blood-sugar swings, smaller hunger swings, and better calorie control throughout the day.\n\nIn one study of older adults, three 15-minute walks after meals controlled blood sugar better over the day than one 45-minute walk.\n\nNon-exercise activity also adds up fast. Standing instead of sitting, taking stairs, walking to a destination instead of driving — can add up to hundreds of extra calories a day without any formal workout. For weight loss, this is often easier to sustain than gym sessions.\n\nAfter your last meal of the day, walk for 10–15 minutes. There's no need to push the pace — even light walking helps.",
  },
  {
    title: 'Best foods for fat loss',
    time: '5 min read',
    image: require('../../assets/pattern-articles/best-foods-fat-loss.jpg'),
    sources: ['li2014', 'vanderwal2005', 'whoHealthyDiet'],
    body: "The best weight loss foods are the ones that fill you up the most per calorie. These foods let you hit your calorie goal without feeling deprived — which is what makes a diet sustainable.\n\nLeafy greens (ugwu, bitter leaf, waterleaf, spinach) — virtually calorie-free, high in fibre and micronutrients. Add them generously to every meal.\n\nLegumes (beans, lentils, cowpeas, soybeans) — extremely filling, high in protein and fibre, and cheap. Moimoi and stewed beans are among the best calorie-value meals in African cooking.\n\nEggs — high in protein and moderate in calories. In one study, people who ate eggs for breakfast felt fuller and ate less at lunch than those who ate a bagel breakfast with the same calories.\n\nFish and lean meat — high protein, lower calorie density than fatty meat. Grilled or oven-roasted is far better than deep-fried.\n\nFresh fruits — watermelon, pawpaw, oranges, and mangoes are naturally sweet, low-calorie, and filling. They satisfy sugar cravings without the calorie cost of processed sweets.\n\nFoods to watch portions on: palm oil, groundnut oil, peanut butter, and fried snacks. These are not bad foods, but their calorie density is very high — small amounts add up quickly. A tablespoon of oil is 120 calories. Two tablespoons of groundnut paste in a soup is 200 calories. Use with awareness.",
  },
  {
    title: 'Common calorie counting mistakes',
    time: '4 min read',
    image: require('../../assets/pattern-articles/calorie-counting-mistakes.png'),
    sources: ['harvardCalories', 'burke2011', 'spiegel2004'],
    body: "Calorie tracking is a skill, and most people make the same mistakes when starting out. Knowing them in advance saves weeks of frustrating plateau.\n\nMistake #1: Not logging cooking oil. Oil is the most underestimated calorie source in African cooking. A tablespoon of palm or groundnut oil is 120 calories — and most recipes use much more. Weigh or measure oil before cooking.\n\nMistake #2: Underestimating portion sizes. 'A cup of rice' can mean 200 calories or 600 depending on how full the cup is. Use weight (grams) for carbs and protein rather than cups or handfuls until your eye is calibrated.\n\nMistake #3: Forgetting drinks. Malt, juice, sweetened kunu, and added sugar in tea and coffee can add 300–600 calories without feeling like food. Switch to plain water, black tea, or unsweetened drinks.\n\nMistake #4: Eating too little. Counter-intuitively, eating too few calories slows your metabolism and increases muscle loss. Stay above 1,200 calories for women and 1,500 for men unless medically supervised.\n\nMistake #5: Ignoring sleep. Poor sleep raises cortisol and ghrelin (the hunger hormone), making calorie control significantly harder. Prioritise 7–8 hours of quality sleep — it may be doing more work than your diet.",
  },
  {
    title: 'Why energy may feel low',
    time: '3 min read',
    image: require('../../assets/pattern-articles/why-energy-feels-low.jpg'),
    sources: ['rosenbaum2010', 'nhsMinerals'],
    body: "Feeling tired or sluggish when you start eating in a calorie deficit is completely normal, especially in the first 1–2 weeks. Understanding why it happens can help you push through it.\n\nYour body is adapting. When calories drop, your body initially resists by slowing metabolism slightly and producing more hunger hormones. This can feel like fatigue or brain fog. It passes as the body adjusts.\n\nElectrolyte imbalance plays a big role. Eating less food means less sodium, potassium, and magnesium coming in. Low levels of these minerals cause fatigue, headaches, and brain fog. Eat potassium-rich foods (bananas, leafy greens, tomatoes), and if you sweat a lot, a small pinch of salt in your water can help.\n\nBlood sugar regulation is adjusting. If you previously ate high-sugar or high-carb foods frequently, your body is used to constant glucose hits. Shifting to higher protein and fibre intake forces blood sugar to stabilise on its own, which initially can feel like low energy.\n\nThe good news? This gets better. Many people find their energy steadies after the first few weeks. If you still feel very tired, dizzy or unwell, eat more and talk to a doctor.",
  },
  {
    title: 'Optimize your meal timing',
    time: '6 min read',
    image: require('../../assets/pattern-articles/optimize-meal-timing.jpg'),
    sources: ['schoenfeld2018', 'westerterp2004', 'vujovic2022', 'reynolds2019'],
    body: "When you eat can matter as well as what you eat. Spreading the same calories differently across the day can change how hungry and energetic you feel.\n\nPlan your meals in advance. Knowing what you'll eat removes decision fatigue and prevents impulsive, unplanned choices. Meal prep on weekends can save you during busy weekdays when willpower is lowest.\n\nDistribute calories evenly. For many people, three moderate meals are easier than one or two large ones. Skipping meals to 'save' calories for later usually leads to overeating at night — the worst time for calorie management.\n\nPrioritize protein at every meal. Aim for 1.6–2.2g of protein per kg of body weight daily. Protein preserves muscle mass during a calorie deficit, keeps you full, and has a high thermic effect — your body burns 20–30% of protein calories just in digestion.\n\nDon't skip fibre. Vegetables, fruits, legumes, and whole grains support gut health and keep digestion smooth. Fibre also slows glucose absorption, preventing energy crashes and cravings.\n\nFinish eating 2–3 hours before bed if possible. A 2022 study found that eating late increased hunger and lowered the calories people burned.",
  },
  {
    title: 'Sleep & weight loss',
    time: '4 min read',
    image: require('../../assets/pattern-articles/sleep-and-weight-loss.jpg'),
    sources: ['spiegel2004', 'alkhatib2017', 'nhsSleep', 'sleepFoundationTemp'],
    body: "Sleep and weight loss are deeply connected. One affects the other more than most people realise, and optimising both can dramatically improve your results.\n\nPoor sleep makes weight loss harder. When you're sleep-deprived, your body produces more ghrelin (hunger hormone) and less leptin (satiety hormone). This makes calorie control feel much harder and increases cravings for high-calorie, sugary foods. A review of studies found that people eat about 385 more calories on days after sleeping too little.\n\nSleep is also when your body does most of its repair work — building muscle, regulating hormones, and processing the day's metabolic activity. Shortchanging sleep shortchanges recovery.\n\nTiming matters. Eating too close to bedtime disrupts sleep quality. Your body has to focus on digestion instead of repair and recovery. Finish your last meal at least 2–3 hours before you plan to sleep.\n\nCreate a sleep routine that supports your weight loss:\n\nDim lights an hour before bed. Blue-spectrum light from screens suppresses melatonin.\n\nKeep your room cool — 18–20°C. The body needs to drop its core temperature to fall asleep.\n\nAvoid large, heavy meals at night — they delay sleep onset and reduce deep sleep.\n\nThinking about a supplement such as magnesium for sleep? Check with a pharmacist or doctor first.",
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

// ── Just for You cards ────────────────────────────────────────────────────────
// Soft two-tone gradients (two light shades of one colour) with dark text, one colour per card.
const JFY_PALETTES = [
  { colors: ['#EAF9F1', '#C7EEDA'], ink: '#0B3D2E', chip: 'rgba(11,61,46,0.08)' },   // mint
  { colors: ['#FFF3EA', '#FFD9C2'], ink: '#5A2A10', chip: 'rgba(90,42,16,0.08)' },   // peach
  { colors: ['#F3EFFF', '#DCD1FF'], ink: '#2E1F5E', chip: 'rgba(46,31,94,0.08)' },   // lavender
  { colors: ['#EAF5FF', '#CBE4FF'], ink: '#0F2F52', chip: 'rgba(15,47,82,0.08)' },   // sky
];

// Short button labels, so the cards side by side don't all say the same thing. Each card gets a different
// one, and the set shifts every day.
const JFY_CTAS = [
  'See why', 'Tell me', 'Show me', 'Go on', 'Read on', 'Hear this', 'Dig in', 'Find out', 'Say more', 'Why though?',
  "Let's see", 'Spill it', 'Keep reading', 'Learn more', 'Look closer', 'Unpack it', 'Explain', 'How come?', 'Open up',
  'See more', 'Get details', 'Inside scoop', 'More please', 'Catch up', 'Read it', 'Hear more', 'Look inside', 'Zoom in',
  'Know more', 'Get it',
];
const jfyCta = (cardIndex) => {
  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  return JFY_CTAS[(day * 7 + cardIndex * 5) % JFY_CTAS.length];
};

// The tag (a short hook the AI writes for this insight) sits bottom right, across from the button.
const JfyCard = ({ palette, label, text, onPress, width, cta = 'See why' }) => (
  <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={{ width, marginRight: 12 }} accessibilityRole="button" accessibilityLabel={label ? `${label}. ${cta}` : cta}>
    <LinearGradient colors={palette.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={jfyStyles.card}>
      <Text style={[jfyStyles.text, { color: palette.ink }]} numberOfLines={5}>{text}</Text>
      <View style={jfyStyles.footer}>
        <View style={[jfyStyles.btnSolid, { backgroundColor: palette.ink }]}>
          <Text style={jfyStyles.btnSolidTxt} numberOfLines={1}>{cta}</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </View>
        {label ? <View style={[jfyStyles.chip, { backgroundColor: palette.chip }]}><Text style={[jfyStyles.chipTxt, { color: palette.ink }]} numberOfLines={1}>{label}</Text></View> : null}
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

// Free plan: what a Pro insight card looks like, with the words hidden. Tapping opens the upgrade screen.
const LockedJfyCard = ({ palette, label, onPress, width }) => (
  <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={{ width, marginRight: 12 }} accessibilityRole="button" accessibilityLabel={`${label} insight. Unlock with Logga Pro`}>
    <LinearGradient colors={palette.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={jfyStyles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <View style={[jfyStyles.lock, { backgroundColor: palette.chip }]}><Ionicons name="lock-closed" size={12} color={palette.ink} /></View>
      </View>
      <View style={{ marginTop: 10, marginBottom: 16, gap: 8 }}>
        {[1, 0.92, 0.7].map((w, i) => (
          <View key={i} style={{ height: 11, width: `${w * 100}%`, borderRadius: 6, backgroundColor: palette.ink, opacity: 0.12 }} />
        ))}
      </View>
      <View style={jfyStyles.footer}>
        <View style={[jfyStyles.btn, { borderColor: palette.chip, backgroundColor: 'rgba(255,255,255,0.55)', flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <Ionicons name="lock-closed" size={11} color={palette.ink} />
          <Text style={[jfyStyles.btnTxt, { color: palette.ink }]}>See more</Text>
        </View>
        <View style={[jfyStyles.chip, { backgroundColor: palette.chip }]}><Text style={[jfyStyles.chipTxt, { color: palette.ink }]} numberOfLines={1}>{label}</Text></View>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

const LOCKED_LENSES = ['MOOD_AND_FOOD', 'MOVEMENT', 'WEIGHT_TREND'];
// One-word tags for the locked cards (the words are hidden, so there's no finding to tease).
const LOCKED_TAGS = { MOOD_AND_FOOD: 'Mood', MOVEMENT: 'Movement', WEIGHT_TREND: 'Weight' };

const jfyStyles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, minHeight: 196, justifyContent: 'space-between' },
  chip: { flexShrink: 1, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  chipTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  // No flex: 1 here. A stretched box lets the web show the clipped 6th line under the "…".
  text: { fontSize: 13.5, fontWeight: '700', lineHeight: 20, marginBottom: 16, overflow: 'hidden' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  btnSolid: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  btnSolidTxt: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  btnTxt: { fontSize: 13.5, fontWeight: '700' },
  lock: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

const JfySkeletonCard = ({ style }) => {
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
    <Animated.View style={[jfySkeletonStyles.card, style, { opacity }]}>
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
  onShowCalorieTarget,
  onNavigateToHydration,
  onStartFast,
  onEndFast,
  lastFastEndTime,
  fastingSessions,
  recentMeals,
  waterCount,
  waterLogs,
  volumeUnit,
  onQuickAddWater,
  onUndoQuickWater,
  onShowCalendar,
  checkInHistory,
  weightLogs,
  targetWeight,
  startingWeight,
  dailyCalorieGoal,
  hydrationGoal,
  userName,
  profileImage,
  userCountry,
  userJoinDate,
  userId,
  proteinGoal,
  carbsGoal,
  fatsGoal,
  age,
  sex,
  height,
  heightUnit,
  weightUnit,
  activityLevel,
  pacePreference,
  struggles,
  foodContext,
  cuisines,
  motivations,
  accountability,
  coachTone,
  stepGoal,
  stepLogs,
  activities,
  goal,
  isRestoringFast,
  dataReady,
  goalHistory,
  dailyGoalLedger,
  goalSource,
  pendingInsightIndex,
  onClearPendingInsight,
  onShowChat,
  onNavigateToMeals,
  onLogMeal,
  eatingStyle,
  eatingWindow,
  onOpenSettings,
  selectedDate,
  onSelectDate,
  onShowLogMeal,
  onViewMeal,
  onRequestDeleteMeal,
  onOpenMealHistory,
  onOpenNotifications,
  notifUnseen = 0,
  onOpenWaterLog,
  onShowAddActivity,
  onShowActivityLog,
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  // Precomputed daily_goal_ledger, keyed for O(1) lookup by date -- see lib/goalHistory.js.
  const ledgerMap = useMemo(() => buildDailyLedgerMap(dailyGoalLedger), [dailyGoalLedger]);

  const [timeSinceFast, setTimeSinceFast] = useState(null);
  const [justForYouInsight, setJustForYouInsight] = useState(null);
  const [justForYouTag, setJustForYouTag] = useState('');
  const [jfyLoading, setJfyLoading] = useState(true);
  const [jfyRefreshing, setJfyRefreshing] = useState(false);
  const [jfyFreshReady, setJfyFreshReady] = useState(false);
  const [jfyExpanded, setJfyExpanded] = useState(false);
  const [jfyOpen, setJfyOpen] = useState(null); // { text, title } of the card being read
  const [proCards, setProCards] = useState(null);
  const { isPro } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [riveGaugeFailed, setRiveGaugeFailed] = useState(false);
  const [undoWaterId, setUndoWaterId] = useState(null);
  const undoWaterTimer = useRef(null);

  const quickAddWater = () => {
    const id = onQuickAddWater?.();
    if (id == null) return false;
    setUndoWaterId(id);
    clearTimeout(undoWaterTimer.current);
    undoWaterTimer.current = setTimeout(() => setUndoWaterId(null), 5000);
    return true;
  };
  const undoQuickWater = () => {
    if (undoWaterId != null) onUndoQuickWater?.(undoWaterId);
    clearTimeout(undoWaterTimer.current);
    setUndoWaterId(null);
  };
  useEffect(() => () => clearTimeout(undoWaterTimer.current), []);

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
      age,
      sex,
      height,
      heightUnit,
      weightUnit,
      activityLevel,
      pacePreference,
      struggles: struggles || [],
      foodContext,
      cuisines: cuisines || [],
      motivations: motivations || [],
      accountability,
      coachTone,
      stepGoal,
    },
    stepLogs: (stepLogs || []).slice(-30).map((r) => ({ date: r.date, steps: r.steps })),
    activities: (activities || []).slice(-30).map((a) => ({ date: a.date, type: a.type, durationMin: a.durationMin })),
    checkInHistory: checkInHistory || [],
    recentMeals: recentMeals || [],
    weightLogs: weightLogs || [],
    waterLogs: waterLogs || [],
    enrichedMealLogs: buildEnrichedMealLogs(),
    goalHistory: goalHistory || [],
    goalSource: goalSource || 'system',
  });

  const fetchInsights = async (payload, forceRefresh = false) => {
    const userId = payload?.profile?.userId;

    // Phase 1 — show cached insight instantly so the screen is never blank
    const cached = await getCachedJustForYou(userId);
    if (cached?.insight) {
      setJustForYouInsight(cached.insight);
      setJustForYouTag(cached.tag || '');
      setJfyLoading(false);
    }

    // Phase 2 — fetch fresh insight in the background
    setJfyFreshReady(false);
    setJfyRefreshing(true);
    getJustForYou(payload, forceRefresh)
      .then(({ insight: freshInsight, tag: freshTag, fromApi }) => {
        if (!freshInsight) { setJfyLoading(false); return; } // e.g. AI features off: drop the skeleton, keep the articles
        setJustForYouInsight(freshInsight);
        setJustForYouTag(freshTag || '');
        setJfyLoading(false);
        if (fromApi) { setJfyFreshReady(true); setJfyExpanded(false); }
      })
      .catch(() => {})
      .finally(() => setJfyRefreshing(false));
    fetchProInsights(payload, forceRefresh);
  };

  // Logga Pro: three more insights. Free users never call this; they see locked cards instead.
  const fetchProInsights = async (payload, forceRefresh = false) => {
    if (!isPro) return;
    const cachedPro = await getCachedProJustForYou(payload?.profile?.userId);
    if (cachedPro) setProCards(cachedPro);
    getProJustForYou(payload, forceRefresh).then(({ cards }) => { if (cards) setProCards(cards); }).catch(() => {});
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

  // Became Pro (just subscribed, or the subscription status loaded after the first fetch): load the extra cards.
  useEffect(() => {
    if (!isPro || !userId || !dataReady) return;
    fetchProInsights(buildPayload());
  }, [isPro, userId, dataReady]);

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

  // Streak = days where meals were logged and calories stayed within goal — each day judged
  // against the goal active on that day, not today's live goal.
  const onGoalDates = new Set(
    Object.entries(
      (recentMeals || []).reduce((acc, m) => {
        const d = m.date || '';
        if (!acc[d]) acc[d] = 0;
        acc[d] += m.calories || 0;
        return acc;
      }, {})
    )
      .filter(([d, liveTotal]) => {
        const total = resolveCaloriesEaten(ledgerMap, d, liveTotal);
        return total > 0 && total <= resolveCalorieGoal(ledgerMap, goalHistory, d, dailyCalorieGoal);
      })
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
  const calRatio = dailyCalorieGoal > 0 ? Math.min(todayCalories / dailyCalorieGoal, 1) : 0;
  const calRemaining = Math.max((dailyCalorieGoal || 0) - todayCalories, 0);
  const isCalOver = dailyCalorieGoal > 0 && todayCalories > dailyCalorieGoal;

  // Today's meals
  const todayDateStr = new Date().toDateString();
  const todayMeals = (recentMeals || []).filter(m => m.date === todayDateStr);

  // Logging history this week — checked if any meal was logged that day
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
      return dayCals > 0;
    });
  };
  const calHistory = getWeekCalHistory();

  // This week (Mon-Sun): logged activities, their minutes and estimated kcal, and which days were active.
  const weekActivity = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const inWeek = (activities || []).filter((a) => {
      const t = a.timestamp || new Date(a.date).getTime();
      return !isNaN(t) && t >= monday.getTime();
    });
    const activeDates = new Set(inWeek.map((a) => a.date));
    const stepsByDate = {};
    (stepLogs || []).forEach((r) => { stepsByDate[r.date] = (stepsByDate[r.date] || 0) + (r.steps || 0); });
    return {
      count: inWeek.length,
      minutes: Math.round(inWeek.reduce((s, a) => s + (Number(a.durationMin) || 0), 0)),
      kcal: Math.round(inWeek.reduce((s, a) => s + (Number(a.estimatedCalories) || 0), 0)),
      days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        const ds = d.toDateString();
        return { letter, future: d > today, active: activeDates.has(ds) || (stepsByDate[ds] || 0) >= 5000 };
      }),
    };
  })();

  // The day picked in the week strip (today unless another day was tapped).
  const selectedDay = selectedDate || new Date();
  const selDateStr = selectedDay.toDateString();
  const selIsToday = selDateStr === new Date().toDateString();
  const selMeals = (recentMeals || []).filter(m => m.date === selDateStr);
  const selLive = selMeals.reduce((s, m) => s + (m.calories || 0), 0);
  // Past days use the ledger's settled total and the goal that was active that day.
  const selCalories = selIsToday ? selLive : resolveCaloriesEaten(ledgerMap, selDateStr, selLive);
  const selGoal = selIsToday ? (dailyCalorieGoal || 0) : (resolveCalorieGoal(ledgerMap, goalHistory, selDateStr, dailyCalorieGoal) || 0);
  const selRatio = selGoal > 0 ? Math.min(selCalories / selGoal, 1) : 0;
  const selRemaining = Math.max(selGoal - selCalories, 0);
  const selOver = selGoal > 0 && selCalories > selGoal;
  const sumMacro = (k) => Math.round(selMeals.reduce((s, m) => s + (m[k] || 0), 0) * 10) / 10;
  const selMacros = { protein: sumMacro('protein'), carbs: sumMacro('carbs'), fats: sumMacro('fats') };

  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? 'Good morning!' : hourNow < 17 ? 'Good afternoon!' : 'Good evening!';

  // Sunday to Saturday of this week; days still to come can't be picked.
  const stripDays = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      return {
        key: date.toDateString(),
        date,
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        num: date.getDate(),
        future: date > today,
        selected: date.toDateString() === selDateStr,
        a11y: date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    });
  })();

  // Today's articles for the Based on Your Pattern row (Just for You shows insights only).
  const patternCards = getDailyArticles(5);

  const [selectedArticle, setSelectedArticle] = useState(null);

  return (
    <View style={styles.wrapper}>
      {Platform.OS === 'web' && <View style={{ height: 44 }} />}

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        {/* Header: greeting, calendar, notifications, and the week strip that picks the day shown below */}
        <LinearGradient colors={isDark ? [colors.appBg, colors.appBg] : ['#CFF3DE', '#E9F8EF', colors.appBg]} locations={isDark ? undefined : [0, 0.55, 1]} style={styles.greetHeader}>
          <View style={styles.greetRow}>
            <TouchableOpacity style={styles.greetAvatar} onPress={onOpenSettings} accessibilityLabel="Open settings">
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.greetAvatarImg} />
              ) : (
                <Text style={styles.greetAvatarText}>{getInitials(userName)}</Text>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.greetHello}>{greeting}</Text>
              <Text style={styles.greetName} numberOfLines={1}>{(userName || '').trim().split(/\s+/)[0] || 'Welcome back'}</Text>
            </View>
            <TouchableOpacity style={styles.greetIconBtn} onPress={onShowCalendar} accessibilityLabel="Calendar">
              <Ionicons name="calendar-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.greetIconBtn} onPress={onOpenNotifications} accessibilityLabel={notifUnseen ? `Notifications, ${notifUnseen} new` : 'Notifications'}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {notifUnseen > 0 && <View style={styles.greetBellDot} />}
            </TouchableOpacity>
          </View>
          <View style={styles.weekStrip}>
            {stripDays.map((d) => (
              <TouchableOpacity
                key={d.key}
                style={[styles.weekDay, d.selected && styles.weekDaySelected]}
                disabled={d.future}
                onPress={() => onSelectDate && onSelectDate(d.date)}
                accessibilityLabel={d.a11y}
                accessibilityState={{ selected: d.selected, disabled: d.future }}
              >
                <Text style={[styles.weekDayName, d.selected && styles.weekDayNameSelected]}>{d.name}</Text>
                <View style={[styles.weekDayNum, d.selected && styles.weekDayNumSelected]}>
                  <Text style={[styles.weekDayNumText, d.future && { color: '#9CA3AF' }, d.selected && { color: '#059669' }]}>{d.num}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Calorie gauge hero, for the day picked above */}
        <View style={styles.heroCardCompact}>
          <View style={styles.heroContent}>
            {/* The animated gauge shows "remaining"; over goal, no goal set, web or a failed load use the drawn one */}
            {Platform.OS !== 'web' && !riveGaugeFailed && selGoal > 0 && !selOver ? (
              <RiveCalorieGauge progress={selRatio} remaining={selRemaining} width={GAUGE_W} onFail={() => setRiveGaugeFailed(true)} />
            ) : (
            <View style={{ width: GAUGE_W, height: GAUGE_W / 2 }}>
              <CalorieGauge ratio={selRatio} over={selOver} width={GAUGE_W} />
              <View style={styles.gaugeCenter}>
                <Ionicons name="flame" size={24} color={selOver ? '#EF4444' : '#FB923C'} />
                <Text style={styles.gaugeNumber}>
                  {selOver
                    ? `+${(selCalories - selGoal).toLocaleString()}`
                    : selGoal ? selRemaining.toLocaleString() : '--'}
                </Text>
                <Text style={[styles.gaugeLabel, selOver && { color: '#EF4444' }]}>
                  {selOver ? 'Over goal' : selRemaining === 0 && selGoal ? 'Goal met' : 'Remaining'}
                </Text>
              </View>
            </View>
            )}

            <TouchableOpacity style={styles.goalChip} onPress={onShowCalorieTarget || onNavigateToProgress}>
              <Text style={styles.goalChipText}>
                {selGoal ? `${selGoal.toLocaleString()} cal goal` : 'Set a calorie goal'}
              </Text>
              <Ionicons name="chevron-forward" size={13} color="#047857" />
            </TouchableOpacity>

            <View style={styles.dayNutrition}>
              <Text style={styles.dayNutritionTitle}>{selIsToday ? "Today's Nutrition" : `${selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}'s Nutrition`}</Text>
              <View style={styles.dayNutritionRow}>
                {[
                  [selCalories.toLocaleString(), 'Calories'],
                  [`${selMacros.protein}g`, 'Protein'],
                  [`${selMacros.carbs}g`, 'Carbs'],
                  [`${selMacros.fats}g`, 'Fats'],
                ].map(([value, label], i) => (
                  <React.Fragment key={label}>
                    {i > 0 && <View style={styles.dayNutritionDivider} />}
                    <View style={styles.dayNutritionStat}>
                      <Text style={styles.dayNutritionValue}>{value}</Text>
                      <Text style={styles.dayNutritionLabel}>{label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 16, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ShimmerLogButton compact onPress={onShowLogMeal} />
              {onOpenWaterLog && (
                <TouchableOpacity style={styles.waterLogBtn} onPress={onOpenWaterLog} activeOpacity={0.8} accessibilityLabel="Log water">
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M7.3 12.5c1.6-.9 3.1-.9 4.7 0s3.1.9 4.7 0l-.7 7.3a1.8 1.8 0 0 1-1.8 1.6H9.8A1.8 1.8 0 0 1 8 19.8z" fill="#93C5FD" />
                    <Path d="M6 3.5h12l-1.6 16.3a1.8 1.8 0 0 1-1.8 1.6H9.4a1.8 1.8 0 0 1-1.8-1.6z" stroke="#2563EB" strokeWidth={1.8} strokeLinejoin="round" />
                  </Svg>
                  <View style={styles.waterLogPlus}><Ionicons name="add" size={11} color="#fff" /></View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>


        {/* Meals: the day picked in the week strip, or the usual ones to log again (was the Meals tab) */}
        <View style={{ marginTop: 12, paddingHorizontal: 12 }}>
          <DayMealsCard
            date={selectedDay}
            recentMeals={recentMeals}
            onViewMeal={onViewMeal}
            onRequestDelete={onRequestDeleteMeal}
            onOpenHistory={onOpenMealHistory}
            onLogAgain={(m) => onLogMeal && onLogMeal({
              name: m.name,
              calories: m.calories || 0,
              protein: m.protein || 0,
              carbs: m.carbs || 0,
              fats: m.fats || 0,
              fiber: m.fiber || 0, sugar: m.sugar || 0, sodium: m.sodium || 0,
              imageUrl: /^https?:/.test(m.photo || m.image_url || '') ? (m.photo || m.image_url) : null,
              ingredients: (m.items || []).map(name => ({ name })),
            })}
          />
        </View>

        {/* Just for You — daily AI coach insight */}
        <View style={[styles.sectionTight, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Ionicons name="bulb-outline" size={16} color={colors.text} />
              <Text style={[styles.sectionTitleTight, { marginBottom: 0 }]}>Just for {userName || 'You'}</Text>
            </View>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eduScrollCompact}>
            {jfyLoading ? (
              <JfySkeletonCard style={{ width: JFY_CARD_WIDTH, marginRight: 12 }} />
            ) : justForYouInsight ? (
              <JfyCard
                palette={JFY_PALETTES[0]}
                label={justForYouTag}
                cta={jfyCta(0)}
                text={justForYouInsight}
                width={JFY_CARD_WIDTH}
                onPress={() => { setJfyOpen({ text: justForYouInsight, title: "Today's Insight" }); setJfyExpanded(true); setJfyFreshReady(false); }}
              />
            ) : null}

            {/* Three more insights: real ones for Pro, locked previews for Free */}
            {!jfyLoading && justForYouInsight && (isPro
              ? (proCards || []).slice(0, 3).map((c, i) => (
                <JfyCard
                  key={`pro-${i}`}
                  palette={JFY_PALETTES[i + 1]}
                  label={c.tag || LENS_LABELS[c.lens] || 'Insight'}
                  cta={jfyCta(i + 1)}
                  text={c.insight}
                  width={JFY_CARD_WIDTH}
                  onPress={() => { setJfyOpen({ text: c.insight, title: LENS_LABELS[c.lens] || 'Insight' }); setJfyExpanded(true); }}
                />
              ))
              : LOCKED_LENSES.map((lens, i) => (
                <LockedJfyCard
                  key={`locked-${lens}`}
                  palette={JFY_PALETTES[i + 1]}
                  label={LOCKED_TAGS[lens]}
                  width={JFY_CARD_WIDTH}
                  onPress={() => unlock('jfy')}
                />
              )))}

          </ScrollView>
        </View>

        {/* Activities this week (Mon-Sun) */}
        <View style={styles.activityCard}>
          <View style={styles.activityHead}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="barbell-outline" size={16} color="#F97316" />
              <Text style={styles.activityTitle}>Activities</Text>
            </View>
            <TouchableOpacity onPress={onShowActivityLog} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.activitySeeAll}>See all</Text>
              <Ionicons name="arrow-forward" size={13} color="#047857" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              [weekActivity.count, 'Workouts'],
              [weekActivity.minutes, 'Minutes'],
              [weekActivity.kcal, 'Est. kcal'],
            ].map(([value, label]) => (
              <View key={label} style={styles.activityStat}>
                <Text style={styles.activityStatValue}>{value ? value.toLocaleString() : '0'}</Text>
                <Text style={styles.activityStatLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.activityWeekLabel}>Your active days this week</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekActivity.days.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View style={[styles.activityDot, d.active && styles.activityDotOn, d.future && { opacity: 0.5 }]}>
                  {d.active && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <Text style={styles.activityDayLetter}>{d.letter}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.activityLogBtn} onPress={onShowAddActivity} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color={colors.text} />
            <Text style={styles.activityLogBtnText}>Log activity</Text>
          </TouchableOpacity>
        </View>

        {/* Based on Your Pattern */}
        <View style={[styles.sectionTight, { marginTop: 16 }]}>
          <Text style={styles.sectionTitleTight}>Based on Your Pattern</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patternScrollCompact}>
            {patternCards.map((card, i) => (
              <TouchableOpacity key={i} style={styles.patternCardLarge} onPress={() => setSelectedArticle(card)}>
                <Image source={card.image} style={styles.patternImageArea} resizeMode="cover" />
                <Text style={styles.patternTitleLarge}>{card.title}</Text>
                <Text style={styles.patternTimeLarge}>{card.time}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* This Week */}
        <View style={[styles.sectionTight, { marginTop: 16 }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>This Week</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyCard}>
            <Text style={styles.historyCardSubtitle}>Days you logged your meals</Text>
            <View style={styles.historyDots}>
              {weekDays.map((day, i) => (
                <View key={i} style={styles.historyDay}>
                  {calHistory[i] === true ? (
                    <LinearGradient colors={['#6EE7B7', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.historyDot}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={[
                      styles.historyDot,
                      {
                        backgroundColor: calHistory[i] === null ? colors.cardAlt : 'transparent',
                        borderWidth: calHistory[i] === false ? 2 : 0,
                        borderColor: calHistory[i] === false ? colors.border : 'transparent',
                      }
                    ]} />
                  )}
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
            const cutoff7 = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            const week7Meals = (recentMeals || []).filter(m => {
              const t = m.timestamp || new Date(m.date).getTime();
              return !isNaN(t) && t >= cutoff7;
            });
            const daysLogged = new Set(week7Meals.map(m => m.date)).size;
            const byDate7Live = {};
            week7Meals.forEach(m => { byDate7Live[m.date] = (byDate7Live[m.date] || 0) + (m.calories || 0); });
            // Ledger's real eaten total per day, not the live recompute -- falls back to live
            // only for a day the ledger hasn't caught up to yet (today, before the next hourly
            // refresh).
            const byDate7 = {};
            Object.entries(byDate7Live).forEach(([ds, liveTotal]) => {
              byDate7[ds] = resolveCaloriesEaten(ledgerMap, ds, liveTotal);
            });
            const totalCals7 = Object.values(byDate7).reduce((s, c) => s + c, 0);
            const avgCals = daysLogged > 0 ? Math.round(totalCals7 / daysLogged) : 0;
            // Each day judged against the goal that was active THAT day, not today's live
            // goal — otherwise changing your goal retroactively repaints the past week.
            const daysOnTarget = Object.entries(byDate7).filter(([ds, dc]) => {
              if (!dc || !dailyCalorieGoal) return false;
              const dayGoal = resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal);
              const r = dc / dayGoal; return r >= 0.7 && r <= 1.15;
            }).length;
            // "On track"/"High" is judged against the average of each logged day's own goal,
            // not today's live goal — a week mostly logged under an old goal shouldn't get
            // graded against whatever the goal was just changed to.
            const loggedDates7 = Object.keys(byDate7);
            const avgGoal7 = loggedDates7.length
              ? loggedDates7.reduce((s, ds) => s + resolveCalorieGoal(ledgerMap, goalHistory, ds, dailyCalorieGoal), 0) / loggedDates7.length
              : dailyCalorieGoal;

            return (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{daysLogged > 0 ? avgCals.toLocaleString() : '--'}</Text>
                  <Text style={styles.statLabel}>Avg daily cal</Text>
                  {daysLogged > 0 && dailyCalorieGoal > 0 && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>{avgCals <= avgGoal7 * 1.1 ? 'On track' : 'High'}</Text>
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
              {onQuickAddWater && (
                undoWaterId != null ? (
                  <TouchableOpacity style={styles.waterAddBtn} onPress={undoQuickWater} activeOpacity={0.7}>
                    <Text style={[styles.waterAddText, { color: '#6B7280' }]}>Undo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.waterAddBtn} onPress={quickAddWater} activeOpacity={0.7} accessibilityLabel={`Add ${quickWaterLabel(volumeUnit)} of water`}>
                    <Ionicons name="add" size={18} color="#059669" />
                  </TouchableOpacity>
                )
              )}
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
            <Text style={styles.articleHeaderTitle}>{jfyOpen?.title || "Today's Insight"}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={styles.articleScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            <FormattedText text={jfyOpen?.text || justForYouInsight || ''} bodyStyle={[styles.insightDetailBody, { fontSize: 15.5, lineHeight: 24 }]} />
            <Text style={styles.articleNote}>Written by AI from your logs. General information, not medical advice. Check with a doctor before making medical decisions.</Text>
            <SourcesLink topic="food" only style={{ marginTop: 10 }} />
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

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
              <SourceList ids={selectedArticle.sources} />
              <Text style={styles.articleNote}>General information, not medical advice. Talk to a doctor or dietitian before big changes to your diet or exercise.</Text>
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
  greetHeader: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 8 },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#059669', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  greetAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  greetAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  greetHello: { fontSize: 13, color: c.textSecondary },
  greetName: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
  greetIconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  greetBellDot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#fff' },
  weekStrip: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: 'rgba(5,150,105,0.08)',
  },
  weekDay: { width: 42, paddingTop: 9, paddingBottom: 6, borderRadius: 22, backgroundColor: '#F1F6F3', alignItems: 'center', gap: 7 },
  weekDaySelected: { backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 4 },
  weekDayName: { fontSize: 11, fontWeight: '500', color: '#9CA3AF' },
  weekDayNameSelected: { fontWeight: '600', color: '#fff' },
  weekDayNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  weekDayNumSelected: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  weekDayNumText: { fontSize: 13, fontWeight: '700', color: '#1F1F1F' },
  gaugeCenter: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  gaugeNumber: { fontSize: 36, fontWeight: '700', color: c.text, letterSpacing: -1, lineHeight: 40, marginTop: 2 },
  gaugeLabel: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
  activityCard: { marginTop: 16, marginHorizontal: 20, padding: 14, backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  activityHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  activityTitle: { fontSize: 15, fontWeight: '700', color: c.text },
  activitySeeAll: { fontSize: 13, fontWeight: '600', color: '#047857' },
  activityStat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: c.cardAlt === '#F3F4F6' ? '#F7F7F8' : c.cardAlt },
  activityStatValue: { fontSize: 17, fontWeight: '600', color: c.text },
  activityStatLabel: { fontSize: 11, color: c.textSecondary },
  activityWeekLabel: { fontSize: 12, color: c.textSecondary, marginTop: 14, marginBottom: 8 },
  activityDot: { width: '100%', aspectRatio: 1, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: c.cardAlt === '#F3F4F6' ? '#F7F7F8' : c.cardAlt, alignItems: 'center', justifyContent: 'center' },
  activityDotOn: { backgroundColor: '#F97316', borderColor: '#F97316' },
  activityDayLetter: { fontSize: 11, color: c.textSecondary },
  activityLogBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: c.card },
  activityLogBtnText: { fontSize: 14, fontWeight: '600', color: c.text },
  waterLogBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  waterLogPlus: { position: 'absolute', top: 5, right: 4, width: 15, height: 15, borderRadius: 8, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 14,
    backgroundColor: '#D1FAE5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
  },
  goalChipText: { fontSize: 12, fontWeight: '700', color: '#047857' },
  dayNutrition: {
    alignSelf: 'stretch', marginHorizontal: -12, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: c.cardAlt === '#F3F4F6' ? '#F6F8F7' : c.cardAlt, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  dayNutritionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 12 },
  dayNutritionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNutritionStat: { flex: 1, alignItems: 'center', gap: 3 },
  dayNutritionValue: { fontSize: 18, fontWeight: '700', color: c.text },
  dayNutritionLabel: { fontSize: 11, color: c.textSecondary },
  dayNutritionDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.07)' },
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
  avatarImageSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  waterAddBtn: {
    marginLeft: 4,
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,150,105,0.1)',
  },
  waterAddText: { color: '#059669', fontSize: 12, fontWeight: '700' },
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
    marginTop: 2,
    marginHorizontal: 20,
    padding: 14,
    paddingHorizontal: 16,
    backgroundColor: c.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  fastTypeBadge: {
    position: 'relative',
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
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
  articleNote: {
    fontSize: 12.5,
    lineHeight: 18,
    color: c.textMuted,
    marginTop: 16,
  },
  articleBody: {
    fontSize: 16,
    lineHeight: 26,
    color: c.text,
    letterSpacing: 0.2,
  },
});

export default TodayTab;
