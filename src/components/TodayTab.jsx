import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Image, Modal, Platform, Animated, RefreshControl } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { getJustForYou, getCachedJustForYou } from '../lib/claudeInsights';
import FormattedText from '../lib/FormattedText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Pool of long-form articles. Image URLs are placeholders — swap as needed.
const ARTICLE_POOL = [
  {
    title: 'Fat burning starts here',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400' },
    body: "After about 12 hours without food, your body finishes using up the glucose stored in your liver and starts dipping into fat reserves for fuel. This metabolic switch is why intermittent fasting can be such a powerful tool for fat loss.\n\nThe science is straightforward. When you eat carbohydrates, your body breaks them down into glucose, which is stored in your liver and muscles as glycogen. Once those stores run low — usually around the 12-hour mark of a fast — your body has to find another energy source. It turns to triglycerides stored in fat cells.\n\nThis state is called fat-adaptation. Your liver starts producing ketones from fat, which your brain and muscles can use as fuel. Many people report mental clarity and steady energy once they reach this state.\n\nThe key word is gradually. Your first few fasts won't get you deep into fat-burning mode because your body needs time to become efficient at switching fuel sources. Stick with it for 2–3 weeks and the transition becomes smoother.\n\nA practical tip: don't break your fast with a big sugar hit. That spikes insulin and stops fat-burning immediately. Start with protein, fat, and fibre to keep the metabolic state stable.",
  },
  {
    title: 'Protein protects muscle',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    body: "Many people worry that fasting will eat away their hard-earned muscle. That fear is mostly misplaced — but it does have a kernel of truth, and getting enough protein is how you handle it.\n\nYour body has two main fuel banks: fat and muscle protein. When food is scarce, it can pull from both. The shorter your fast and the better your overall protein intake, the more your body protects muscle and burns fat instead.\n\nResearch suggests that fasts under 24 hours rarely cause measurable muscle loss in healthy adults, especially if you train and eat enough protein during your eating window. Aim for 1.6–2.2 grams of protein per kilogram of body weight, spread across your meals.\n\nGood African sources include eggs, fish, beans, lentils, peanuts, milk, yoghurt, and meat. If you're plant-based, combine grains and legumes (rice and beans, or moimoi with bread) to get a complete amino-acid profile.\n\nIf you're doing extended fasts beyond 24 hours, plan a slow protein-led return to eating: a small protein snack, then your main meal an hour later. This helps your body rebuild rather than scramble.",
  },
  {
    title: 'Water amplifies fasting',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400' },
    body: "Most fasting hunger you feel between meals isn't real hunger — it's thirst. The brain regions that trigger hunger and thirst sit close together, and dehydration often gets misread as a craving.\n\nDuring a fast you're missing the water that normally comes from food, so dehydration is a real risk. The result is headaches, fatigue, brain fog, and what feels like overwhelming hunger but is actually a thirst signal.\n\nA simple test: when you feel hungry mid-fast, drink a full glass of water and wait 10 minutes. Most of the time, the feeling passes. If it stays, that's real hunger and worth listening to.\n\nAim for 2–3 litres of plain water across the day. Sparkling water, plain tea, and black coffee in moderation also count. Anything with sugar or cream technically breaks the fast.\n\nIf the heat where you live is intense, add a pinch of salt or some electrolytes. You'll lose more sodium through sweat, and water alone can leave you feeling worse instead of better.",
  },
  {
    title: 'Sleep is your secret weapon',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1455642305367-68834a9d4337?w=400' },
    body: "Poor sleep raises ghrelin (the hunger hormone) by up to 24% and drops leptin (the fullness hormone) by 18%. Those numbers come from controlled studies on otherwise healthy people who slept 5 hours instead of 8. The result is what feels like uncontrollable hunger the next day.\n\nThis is why fasting feels brutal after a bad night and easy after a good one. It's not willpower — it's hormones.\n\nThe relationship runs both ways. Fasting itself improves deep sleep and reduces middle-of-the-night wake-ups. So a consistent fasting routine and a consistent sleep routine reinforce each other.\n\nWhat actually moves the needle on sleep:\n\nFinish eating 2–3 hours before bed. Late eating disrupts deep sleep regardless of what you ate.\n\nKeep your room cool — 18–20°C. The body needs to drop its core temperature to fall asleep.\n\nDim lights an hour before bed. Bright overhead lights, especially blue-spectrum from screens, suppress melatonin.\n\nIf there's one habit that protects everything else — fasting, weight loss, mood, energy — it's protecting your sleep.",
  },
  {
    title: 'The 16h milestone',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1495364141860-b0d03eccd065?w=400' },
    body: "Around the 16-hour mark of a fast, your body starts producing significantly more human growth hormone (HGH). Studies have measured increases of 1,300% in women and 2,000% in men during a 24-hour fast. That's not a typo.\n\nHGH does several useful things: it preserves lean muscle, mobilises fat for fuel, and supports tissue repair. This is one reason 16:8 has become such a popular fasting schedule — it sits right at the edge of these benefits without being extreme.\n\nIt's also when autophagy starts ramping up. Autophagy is your body's cellular cleanup process — old, damaged components get recycled into new ones. Think of it as your body taking out the rubbish.\n\nThe practical takeaway: if you can comfortably extend a fast from 14 to 16 hours, you cross a meaningful threshold. Beyond 16, the curve flattens — the difference between 16 and 18 hours is much smaller than the difference between 12 and 16.\n\nNew to fasting? Start with 12:12, then move to 14:10, then 16:8 over a few weeks. Forcing 16+ from day one usually backfires.",
  },
  {
    title: 'Electrolytes matter',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400' },
    body: "When you fast, your body excretes electrolytes faster than usual. Insulin levels drop, and one of insulin's jobs is keeping sodium in your kidneys. Less insulin means more sodium leaves your body, taking potassium and magnesium along for the ride.\n\nThis is why people often get headaches, leg cramps, irritability, or fatigue during longer fasts — what's called the 'keto flu'. It's not the fast itself, it's electrolyte depletion.\n\nThree minerals matter most:\n\nSodium: a pinch of unrefined salt (Himalayan, sea salt) in your water, especially in the morning. Most people need 3–5 grams of sodium a day during fasting.\n\nPotassium: avocado, banana, leafy greens, and tomatoes are excellent sources. Get these into your eating window.\n\nMagnesium: dark leafy greens, nuts (especially almonds and cashews), pumpkin seeds, and dark chocolate. A magnesium glycinate supplement before bed can help with sleep too.\n\nA simple electrolyte drink: 500ml water + a pinch of pink salt + squeeze of lime. Sip during your fasting window.",
  },
  {
    title: 'Breaking your fast right',
    time: '5 min read',
    image: { uri: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=400' },
    body: "What you eat to break your fast can make or break the benefits. After hours without food, your gut and blood sugar are sensitive — the wrong first meal causes bloating, energy crashes, and immediate cravings.\n\nThe golden rule: start small and gentle. A handful of nuts, a piece of fruit, or some bone broth eases your digestive system back into action. Wait 20–30 minutes before your main meal.\n\nFor your main meal, build it around protein and fibre. Eggs, fish, chicken, beans, or moimoi paired with vegetables. The protein keeps you full, the fibre slows down the rest of digestion.\n\nAvoid these common mistakes:\n\nGoing straight to white rice, white bread, or sugary drinks. These spike your blood sugar, drop it just as fast, and you'll be ravenous within an hour.\n\nEating until painfully full. Your stomach has shrunk slightly during the fast — overdoing the first meal is uncomfortable and undoes a lot of the metabolic work.\n\nFried, heavy, oily foods. Suya at midnight is great in theory but rough on a digestive system that's been resting for 16 hours.",
  },
  {
    title: 'Your gut needs rest too',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400' },
    body: "We talk a lot about how fasting helps fat loss, but one of its most underrated benefits is what it does for your gut. Your digestive system rarely gets a real break — most people are eating something every 2–3 hours from morning until late at night.\n\nGiving your gut a 12+ hour rest each day allows for something called the migrating motor complex (MMC). This is a wave of muscle contractions that sweeps through your intestines, clearing out leftover food particles and bacteria. The MMC only runs when you're not eating.\n\nWithout these rest periods, bacteria can overgrow in places they shouldn't, leading to bloating, gas, and what some doctors call SIBO (small intestinal bacterial overgrowth).\n\nFasting also gives your gut lining time to heal. The cells lining your intestine renew every 3–5 days, and they do this best when not constantly bathed in food.\n\nIf you have any digestive issues — bloating, cramping, irregular bowel movements — a consistent fasting routine is one of the cheapest and most effective interventions to try. Many people see noticeable improvements within 2–3 weeks.",
  },
  {
    title: 'Consistency beats perfection',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400' },
    body: "Six imperfect 14-hour fasts every week beats two perfect 18-hour fasts. This is the most important thing to understand about making fasting actually work in your life.\n\nThe metabolic and hormonal benefits of fasting come from consistency, not heroic single efforts. A long, hard fast on Sunday followed by erratic eating Monday through Saturday gives you almost none of the benefits.\n\nWhat consistency looks like:\n\nFasting most days, even when life is busy. A 12:12 schedule on a hard day is better than skipping fasting entirely.\n\nForgiving yourself when a day goes off-plan. One late dinner doesn't undo a week of good habits.\n\nPicking a fasting window that fits your life. If you're a morning person, eat breakfast and skip dinner. If you're a night owl, do the opposite.\n\nNot trying to copy someone else's schedule. The 'best' fasting window is the one you can actually stick to for months and years.\n\nThe goal is for fasting to feel as automatic as brushing your teeth — something you do without much thought. That only comes with consistency.",
  },
  {
    title: 'Morning light resets hunger',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400' },
    body: "Getting natural light in your eyes within the first hour of waking has a measurable effect on how hungry you'll feel for the rest of the day. The science of this is well-established but rarely talked about.\n\nLight hitting your retina early in the morning sets your circadian clock, which controls hundreds of processes — including the release of cortisol, melatonin, leptin, and ghrelin (the hunger and fullness hormones).\n\nWhen your morning light cue is strong, your hunger hormones release on a predictable schedule. You feel hungry at your normal eating times, full when you should be, and not ravenous between meals.\n\nWhen morning light is weak (think dark rooms, screens, only artificial lighting), this rhythm gets scrambled. The result is irregular hunger, late-night cravings, and a fasting window that feels much harder than it should.\n\nThe practical fix is simple: 10–15 minutes outside in the morning, even on a cloudy day. The light intensity outdoors is far higher than indoors, even when it doesn't seem so. Combine this with a glass of water and your fasting window will feel noticeably easier.",
  },
  {
    title: 'African foods and fasting',
    time: '5 min read',
    image: { uri: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400' },
    body: "African cuisine has a head start when it comes to gut health and fasting. Many traditional foods are naturally fermented, and fermented foods support the bacteria that make fasting easier.\n\nOgi (pap, akamu) is fermented millet or maize porridge. The fermentation process produces lactic acid bacteria — the same kind in yoghurt — that feed your gut microbiome. A small bowl of ogi when you break your fast can be gentle on your stomach and helpful for digestion.\n\nOther fermented African foods to know:\n\nKenkey (Ghana) — fermented maize dough, similar in benefits to ogi.\n\nGari — cassava that's been fermented and dried; rich in resistant starch which feeds beneficial gut bacteria.\n\nIru and ogiri — fermented locust beans and melon seeds, packed with probiotics, often used in soups.\n\nSorghum and millet beers (in moderation) — yes, traditional brewing also produces probiotic-rich foods.\n\nThese foods do something modern packaged probiotics struggle to do: they introduce a diverse mix of live bacteria your body has co-evolved with for generations. If you're fasting and want easier mornings, work some of these into your eating window.",
  },
  {
    title: 'Stress breaks fasts (sort of)',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400' },
    body: "Technically, stress doesn't break a fast. You're still not eating, and the metabolic state continues. But chronic stress can stall the benefits of fasting in ways that frustrate a lot of people.\n\nWhen you're stressed, your body releases cortisol. Cortisol's job is to free up energy fast — it does this partly by signalling your liver to release glucose into your bloodstream. That glucose hit is the same as eating sugar, hormonally speaking. It spikes insulin, which stops fat-burning.\n\nThis is why some people fast diligently but see no fat loss: chronic stress is keeping their insulin elevated even during the fasted state.\n\nWhat helps:\n\nSleep — the single biggest cortisol regulator. 7–8 hours non-negotiable.\n\nLight movement — walking, gentle yoga, stretching. Not high-intensity exercise during a fasted state if you're already stressed.\n\nBreathing exercises — 5 minutes of slow nasal breathing (4 in, 6 out) drops cortisol measurably.\n\nReducing stimulants — coffee on top of stress amplifies cortisol. If you're going through a tough patch, scale back caffeine.\n\nSometimes the best way to improve your fasting results isn't to fast harder. It's to manage stress better.",
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
    body: "Hunger isn't a constant signal that gets worse and worse until you eat. It comes in waves. Each wave peaks for about 20 minutes, then fades — whether you eat or not.\n\nThis is one of the most useful things to understand about fasting. The hunger you feel at 11am isn't going to keep climbing all day. If you ride it out, it weakens.\n\nThe biology behind it: ghrelin, your hunger hormone, is released in pulses tied to your usual eating schedule. If you normally eat at 11am, you'll get a ghrelin pulse around then. Skip the meal and the pulse subsides on its own as your body realises food isn't coming.\n\nWithin 2–3 weeks of consistent fasting, your ghrelin pulses recalibrate to your new schedule. The hunger that felt unbearable the first week becomes barely noticeable.\n\nWhen a wave hits:\n\nDrink a glass of water and wait 10 minutes.\n\nDistract yourself — go for a walk, start a task, take a shower.\n\nRemind yourself it'll pass. Set a timer for 20 minutes and check back in.",
  },
  {
    title: "Calories aren't the whole story",
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=400' },
    body: "A calorie is a calorie when it comes to physics. But your body doesn't process 2,000 calories spread across 12 hours the same way it processes 2,000 calories eaten in 8 hours. Timing matters more than most people realise.\n\nResearch on time-restricted eating shows that people who confine the same calorie intake to a shorter eating window often lose more fat, sleep better, and have better blood-sugar control than those who graze across 14+ hours.\n\nWhy? Several reasons stack up:\n\nYour body becomes more insulin-sensitive when given long stretches without food. Better insulin sensitivity means easier fat-burning and steadier energy.\n\nYour gut, liver, and pancreas all have circadian rhythms. Eating in alignment with daylight (earlier in the day) tends to work better than late-night eating.\n\nLate eating disrupts sleep, and poor sleep raises hunger hormones the next day. Eating earlier is a virtuous cycle.\n\nSo if you're tracking calories diligently but not seeing results, take a look at your eating window. Compressing the same calories into 8–10 hours, ideally finishing 3 hours before bed, often unlocks progress that calorie counting alone can't.",
  },
  {
    title: 'Movement extends your fast',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1502810365585-3a92e3ca1b27?w=400' },
    body: "A 10-minute walk after eating does something remarkable: it lowers your blood sugar response by 20–30%. This makes your next fasting window noticeably easier.\n\nWhen you eat, especially carbs, glucose floods your bloodstream. Insulin rises to clear it into cells. This insulin spike — and the crash that follows — is what makes you hungry an hour after a meal.\n\nWalking activates your muscles, which pull glucose out of your blood without needing as much insulin. The result is a smaller blood-sugar swing, which means smaller hunger swings.\n\nThe science is clear and simple: even a slow, 10-minute walk after each meal beats a single 30-minute walk in the morning, calorie for calorie, when it comes to blood-sugar control.\n\nTry this for a week:\n\nAfter your last meal of the day, walk for 10–15 minutes. Don't push the pace — slow walking actually works better for this purpose than fast walking.\n\nNotice how you feel later that evening and the next morning. Most people sleep better and find the fasting hours feel easier.",
  },
  {
    title: 'Best foods to break your fast',
    time: '5 min read',
    image: { uri: 'https://estherafricanfoods.com/wp-content/uploads/2023/02/Healthy-foods-1080x675.webp' },
    body: "Breaking your fast with the right foods is just as important as the fast itself. After hours without eating, your digestive system is in a sensitive state, and what you eat first can either support or undo the benefits of your fast.\n\nStart with something gentle. Bone broth, a small portion of fruits like watermelon or bananas, or a handful of nuts are excellent choices. These foods are easy to digest and won't spike your blood sugar dramatically.\n\nAvoid diving straight into heavy, processed, or fried foods. Large meals right after fasting can cause bloating, nausea, and blood sugar crashes. Instead, eat a small snack first, wait 15-20 minutes, then have your main meal.\n\nProtein-rich foods like eggs, fish, or legumes are great for your main meal. Pair them with healthy fats like avocado or olive oil, and complex carbs like sweet potatoes or brown rice. This combination keeps you full longer and provides sustained energy.\n\nHydration matters too. Drink water slowly throughout your eating window. Adding a pinch of salt or electrolytes to your first glass can help with absorption after a long fast.",
  },
  {
    title: 'Common mistakes at your stage',
    time: '4 min read',
    image: { uri: 'https://www.manipalhospitals.com/uploads/blog/diet-mistakes-that-affect-overall-health.png' },
    body: "Starting a fasting routine is exciting, but many beginners fall into the same traps that can slow progress or make the experience unnecessarily difficult.\n\nMistake #1: Eating too much during your window. Fasting isn't a license to binge. If you consume more calories than your body needs during your eating window, you won't see the results you're hoping for. Focus on nutrient-dense meals, not just quantity.\n\nMistake #2: Not drinking enough water. Dehydration is one of the most common issues. Since you're not getting water from food during your fast, you need to be intentional about hydrating. Aim for at least 2-3 liters throughout the day.\n\nMistake #3: Going too hard too fast. If you're new to fasting, jumping straight into a 20:4 or OMAD schedule can be overwhelming. Start with 12:12 or 14:10 and gradually extend your fasting window as your body adapts.\n\nMistake #4: Ignoring sleep. Poor sleep raises cortisol and ghrelin (the hunger hormone), making fasting significantly harder. Prioritize 7-8 hours of quality sleep.\n\nMistake #5: Breaking your fast with sugar or processed food. This spikes insulin rapidly and can lead to energy crashes, cravings, and inflammation.",
  },
  {
    title: 'Why energy may feel low',
    time: '3 min read',
    image: { uri: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400' },
    body: "Feeling tired or sluggish during a fast is completely normal, especially in the first 1-2 weeks. Understanding why it happens can help you push through it.\n\nYour body is transitioning. When you fast, your body shifts from using glucose (from food) as its primary fuel source to burning stored fat. This metabolic switch takes time, and during the transition, energy dips are common.\n\nElectrolyte imbalance plays a big role. When you fast, your body excretes more sodium, potassium, and magnesium through urine. Low levels of these minerals cause fatigue, headaches, and brain fog. Consider adding a pinch of pink salt to your water or taking an electrolyte supplement.\n\nBlood sugar regulation is adjusting. If you previously ate frequently throughout the day, your body is used to constant glucose hits. Fasting forces it to stabilize blood sugar on its own, which initially can feel like low energy.\n\nThe good news? This gets better. Most people report significantly improved and more stable energy levels after 2-3 weeks of consistent fasting. Your body becomes more efficient at burning fat for fuel, and the energy crashes associated with blood sugar spikes disappear.",
  },
  {
    title: 'Optimize your eating window',
    time: '6 min read',
    image: { uri: 'https://food-ubc.b-cdn.net/wp-content/uploads/2026/02/AdobeStock_475418037-1024x683.jpeg' },
    body: "Your eating window is precious. How you use it determines whether fasting becomes a sustainable lifestyle or a frustrating cycle.\n\nPlan your meals in advance. Knowing what you'll eat removes decision fatigue and prevents impulsive, unhealthy choices. Meal prep on weekends can save you during busy weekdays.\n\nEat your largest meal first. After breaking your fast with a light snack, make your next meal the biggest and most nutrient-dense. This ensures you get essential nutrients when your body is most receptive to absorbing them.\n\nPrioritize protein. Aim for 1.6-2.2g of protein per kg of body weight daily. Protein preserves muscle mass during fasting, keeps you full, and has a high thermic effect, meaning your body burns more calories digesting it.\n\nDon't forget fiber. Vegetables, fruits, legumes, and whole grains support gut health and keep digestion smooth. Fiber also slows glucose absorption, preventing energy crashes.\n\nTime your eating window wisely. Research suggests earlier eating windows (e.g., 10am-6pm) align better with your circadian rhythm and may offer greater metabolic benefits than late-night eating. If possible, finish your last meal at least 3 hours before bed.",
  },
  {
    title: 'Sleep & fasting connection',
    time: '4 min read',
    image: { uri: 'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=400' },
    body: "Sleep and fasting are deeply connected. One affects the other more than most people realize, and optimizing both can dramatically improve your results.\n\nFasting improves sleep quality. Studies show that intermittent fasting can enhance deep sleep phases, improve sleep onset time, and regulate your circadian rhythm. Many fasters report falling asleep faster and waking up feeling more refreshed.\n\nBut poor sleep sabotages fasting. When you're sleep-deprived, your body produces more ghrelin (hunger hormone) and less leptin (satiety hormone). This makes fasting feel much harder and increases cravings for high-calorie, sugary foods.\n\nTiming matters. Eating too close to bedtime disrupts sleep quality. Your body has to focus on digestion instead of repair and recovery. Try to finish your last meal at least 2-3 hours before you plan to sleep.\n\nCreate a sleep routine that supports your fast. Dim lights an hour before bed, avoid screens, and keep your room cool (18-20°C). If you fast in the morning, the slight hunger can actually help you stay alert and focused during the day while promoting better sleep at night.\n\nMagnesium supplementation can help both sleep and fasting. It relaxes muscles, calms the nervous system, and helps prevent the muscle cramps that some people experience during longer fasts.",
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
    width: 280,
    height: 220,
    borderRadius: 24,
    backgroundColor: '#C4C4C4',
    marginRight: 12,
    padding: 24,
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
}) => {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  const [timeSinceFast, setTimeSinceFast] = useState(null);
  const [justForYouCards, setJustForYouCards] = useState(null);
  const [jfyLoading, setJfyLoading] = useState(true);
  const [jfyRefreshing, setJfyRefreshing] = useState(false);
  const [jfyFreshReady, setJfyFreshReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [readCards, setReadCards] = useState(new Set());

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
      selectedPlan,
      goal,
      targetWeight,
      startingWeight,
      dailyCalorieGoal,
      hydrationGoal,
      volumeUnit,
      proteinGoal,
      carbsGoal,
      fatsGoal,
    },
    fastingSessions: fastingSessions || [],
    checkInHistory: checkInHistory || [],
    recentMeals: recentMeals || [],
    weightLogs: weightLogs || [],
    waterLogs: waterLogs || [],
    enrichedMealLogs: buildEnrichedMealLogs(),
    goalHistory: goalHistory || [],
  });

  const fetchInsights = async (payload) => {
    const userId = payload?.profile?.userId;

    // Phase 1 — show cached cards instantly so the screen is never blank
    const cached = await getCachedJustForYou(userId);
    if (cached?.length) {
      setJustForYouCards(cached);
      setJfyLoading(false);
      setJfyFreshReady(false);
    }

    // Phase 2 — fetch fresh cards in the background
    setJfyRefreshing(true);
    getJustForYou(payload)
      .then(freshCards => {
        if (!freshCards?.length) return;
        const cachedStr = JSON.stringify(cached || []);
        const freshStr = JSON.stringify(freshCards);
        setJustForYouCards(freshCards);
        setJfyLoading(false);
        if (freshStr !== cachedStr) {
          // Genuinely new cards arrived — reset read state and show badge
          setReadCards(new Set());
          setJfyFreshReady(true);
        }
      })
      .catch(() => {})
      .finally(() => setJfyRefreshing(false));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setJfyFreshReady(false);
    const payload = buildPayload();
    fetchInsights(payload);
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

  const completedDates = new Set(
    (fastingSessions || []).filter(s => s.endTime).map(s => (s.date || s.startTime || '').split('T')[0])
  );
  let streak = 0;
  const streakDate = new Date();
  for (let i = 0; i < 30; i++) {
    if (completedDates.has(streakDate.toISOString().split('T')[0])) {
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

  // Card 1: Fasting stage
  if (isFasting) {
    const stageMessages = {
      'Fed State':         { subtitle: 'Your body is still winding down from your last meal' },
      'Settling In':       { subtitle: 'Your fast is underway — the hard part is behind you' },
      'Fat-Burning Shift': { subtitle: 'This is where the magic starts to happen' },
      'Almost There':      { subtitle: "You're so close — don't quit now" },
      'Goal Reached':      { subtitle: "You've hit your goal — your body is thriving" },
    };
    const msg = stageMessages[stageInfo.stage] || { subtitle: 'Your body is working hard for you' };
    insights.push({ title: stageInfo.stage, subtitle: msg.subtitle, color: '#E8F5E9', accent: '#4CAF50' });
  } else {
    insights.push({ title: "Today's fasting stage", subtitle: "Understanding fat burning", color: '#E8F5E9', accent: '#4CAF50' });
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
    insights.push({ title: "What to expect at hour 12", subtitle: "Your body at midpoint", color: '#FFF3E0', accent: '#FF9800' });
  }

  // Card 3: Hydration nudge
  if ((waterLogs || []).length > 0 && hydrationGoal) {
    const hitGoal = todayWater >= hydrationGoal;
    const low = todayWater === 0;
    insights.push({
      title: hitGoal ? 'Hydrated and thriving' : low ? 'Your body is thirsty' : 'Keep sipping',
      subtitle: hitGoal ? 'Great job — hydration makes fasting so much easier'
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
    insights.push({ title: "Electrolyte guide", subtitle: "3 min read", color: '#FCE4EC', accent: '#E91E63' });
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


  const patternCards = getDailyArticles(5);

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState(null);

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Calculate this week's fasting history from real sessions
  const sessions = fastingSessions || [];
  const getWeekHistory = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    return weekDays.map((_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const dayStr = day.toDateString();
      const todayStr = today.toDateString();

      if (dayStr === todayStr) {
        const fastedToday = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
        return isFasting || fastedToday ? true : null;
      } else if (day > today) {
        return null;
      } else {
        const fasted = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
        return fasted ? true : false;
      }
    });
  };
  const fastHistory = getWeekHistory();

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
        {/* Primary Status Card */}
        <View style={styles.heroCardCompact}>
          <View style={styles.heroContent}>
            {/* Fast type badge */}
            <TouchableOpacity style={styles.fastTypeBadge} onPress={onShowPlanPage}>
              <Text style={styles.fastTypeBadgeText}>{selectedPlan ? `${selectedPlan} Fast` : 'Choose a plan'}</Text>
              <Ionicons name="chevron-forward" size={14} color="#059669" />
            </TouchableOpacity>

            <View style={styles.progressRingSmall}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                <Defs>
                  <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#059669" />
                    <Stop offset="100%" stopColor="#34D399" />
                  </LinearGradient>
                </Defs>
                {/* Background track */}
                <Circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="#D1FAE5"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Progress arc */}
                <Circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke="url(#ringGradient)"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 100 100)"
                />
              </Svg>
              <View style={styles.progressInnerSmall}>
                {isRefining ? (
                  <>
                    <Text style={styles.refiningIconSmall}>{'\u2728'}</Text>
                    <Text style={styles.refiningTextSmall}>Refining...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.fastingLabelSmall}>
                      {isFasting ? 'FASTING' : timeSinceFast ? 'EATING WINDOW' : 'NOT FASTING'}
                    </Text>
                    <Text style={styles.timeDisplayCompact}>
                      {isFasting
                        ? `${fastingHours}h ${fastingMinutes}m\n${fastingSeconds}s`
                        : timeSinceFast
                          ? `${timeSinceFast.h}h ${timeSinceFast.m}m\n${timeSinceFast.s}s`
                          : '0h 0m\n0s'}
                    </Text>
                    {isFasting
                      ? <Text style={styles.stageTextSmall}>{getStageInfo().stage}</Text>
                      : timeSinceFast
                        ? <Text style={styles.stageTextSmall}>since last fast</Text>
                        : null}
                  </>
                )}
              </View>
            </View>

            {/* Check-in Button */}
            <TouchableOpacity style={styles.checkInBtnIntegrated} onPress={onShowCheckInPage}>
              <Text style={styles.checkInIcon}>+</Text>
              <Text style={styles.checkInText}>Check In</Text>
            </TouchableOpacity>

            <View style={styles.fastingControlsContainer}>
              {!isFasting ? (
                <TouchableOpacity
                  style={[styles.fastActionBtn, isRestoringFast && { opacity: 0.4 }]}
                  onPress={isRestoringFast ? null : onStartFast}
                  disabled={isRestoringFast}
                >
                  <Text style={styles.fastActionBtnText}>
                    {isRestoringFast ? 'Restoring...' : 'Start Fast'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.fastActionBtn} onPress={onEndFast}>
                  <Text style={styles.fastActionBtnText}>End Fast</Text>
                </TouchableOpacity>
              )}
              <View style={styles.fastTimesRow}>
                <TouchableOpacity style={styles.fastTimeBlock} onPress={isFasting ? onEditStartTime : undefined} disabled={!isFasting}>
                  <Text style={styles.fastTimeLabel}>STARTED</Text>
                  <Text style={[styles.fastTimeValue, !isFasting && styles.fastTimeDash]}>{isFasting ? formatTime(startHour, startMinute) : '--:--'}</Text>
                  <Text style={[styles.fastTimeDate, !isFasting && styles.fastTimeDash]}>{isFasting ? formatDisplayDate(startDay) : '--'}</Text>
                  {isFasting && (
                    <View style={styles.fastTimeEditBadge}>
                      <Text style={styles.fastTimeEditIcon}>{'\u270E'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.fastTimeDivider} />
                <TouchableOpacity style={styles.fastTimeBlock} onPress={canEditEndTime ? onEditEndTime : undefined} disabled={!canEditEndTime}>
                  <Text style={styles.fastTimeLabel}>ENDS</Text>
                  <Text style={[styles.fastTimeValue, !isFasting && styles.fastTimeDash]}>{isFasting ? formatTime(endHour, endMinute) : '--:--'}</Text>
                  <Text style={[styles.fastTimeDate, !isFasting && styles.fastTimeDash]}>{isFasting ? formatDisplayDate(endDay) : '--'}</Text>
                  {canEditEndTime && (
                    <View style={styles.fastTimeEditBadge}>
                      <Text style={styles.fastTimeEditIcon}>{'\u270E'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Just for You Cards — weekly AI insights (analyst + card pipeline) */}
        <View style={[styles.sectionTight, { marginTop: 28 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={[styles.sectionTitleTight, { marginBottom: 0 }]}>{'\u{1F4A1}'} Just for {userName || 'You'}</Text>
            {jfyFreshReady && readCards.size < (justForYouCards || []).length && (
              <View style={{ backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>New Insights</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eduScrollCompact}>
            {jfyLoading ? (
              [0, 1, 2].map(i => <JfySkeletonCard key={i} />)
            ) : (justForYouCards || []).map((card, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.educationCard, { backgroundColor: ['#059669', '#0F766E', '#9333EA', '#1D4ED8', '#B45309'][i % 5] }]}
                onPress={() => {
                  const next = new Set([...readCards, i]);
                  setReadCards(next);
                  if (next.size >= (justForYouCards || []).length) setJfyFreshReady(false);
                  setSelectedInsight(card);
                }}
                activeOpacity={0.82}
              >
                <View style={styles.eduContent}>
                  <Text style={styles.eduFeeling} numberOfLines={4}>{card.feeling}</Text>
                  <View style={styles.eduBtn}>
                    <Text style={styles.eduBtnText}>{card.cta || 'Read on'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Based on Your Pattern */}
        <View style={[styles.sectionTight, { marginTop: 28 }]}>
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
        <View style={styles.sectionTight}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitleTightInline}>This Week</Text>
            <TouchableOpacity onPress={onNavigateToProgress}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyCard}>
            <View style={styles.historyDots}>
              {weekDays.map((day, i) => (
                <View key={i} style={styles.historyDay}>
                  <View style={[
                    styles.historyDot,
                    {
                      backgroundColor: fastHistory[i] === null ? colors.cardAlt : fastHistory[i] ? '#059669' : 'transparent',
                      borderWidth: fastHistory[i] === false ? 2 : 0,
                      borderColor: fastHistory[i] === false ? colors.border : 'transparent',
                    }
                  ]}>
                    {fastHistory[i] && fastHistory[i] !== null && <Text style={styles.dotCheck}>{'\u2713'}</Text>}
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
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekSessions = sessions.filter(s => s.startTime >= weekAgo.getTime());
            const hasData = weekSessions.length > 0;

            const avgHours = hasData
              ? Math.round(weekSessions.reduce((sum, s) => sum + s.durationHours + s.durationMinutes / 60, 0) / weekSessions.length)
              : 0;

            // Streak — start from yesterday if no fast today yet
            let streak = 0;
            const todayStr = now.toDateString();
            const hasFastToday = sessions.some(s => new Date(s.startTime).toDateString() === todayStr);
            const startOffset = hasFastToday ? 0 : 1;
            for (let i = startOffset; i < 365; i++) {
              const d = new Date(now);
              d.setDate(d.getDate() - i);
              const dayStr = d.toDateString();
              const hasFast = sessions.some(s => new Date(s.startTime).toDateString() === dayStr);
              if (hasFast) streak++;
              else break;
            }

            return (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{hasData ? `${avgHours}h` : '--'}</Text>
                  <Text style={styles.statLabel}>Avg fast length</Text>
                  {hasData && (
                    <View style={styles.statBadge}>
                      <Text style={styles.statBadgeText}>{avgHours >= 16 ? 'Great' : avgHours >= 12 ? 'Good' : 'Building'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{hasData ? weekSessions.length : '--'}</Text>
                  <Text style={styles.statLabel}>Weekly fasts</Text>
                  {hasData && (
                    <View style={[styles.statBadge, { backgroundColor: weekSessions.length >= 5 ? '#E8F5E9' : '#FFF3E0' }]}>
                      <Text style={[styles.statBadgeText, { color: weekSessions.length >= 5 ? '#2E7D32' : '#E65100' }]}>{weekSessions.length >= 5 ? 'Great' : 'Normal'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{streak > 0 ? streak : '--'}</Text>
                  <Text style={styles.statLabel}>Day streak</Text>
                  {streak > 0 && (
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

      {/* Insight Detail Modal */}
      <Modal
        visible={selectedInsight !== null}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setSelectedInsight(null)}
      >
        <View style={[styles.articleModal, Platform.OS === 'android' && { paddingTop: 44 }]}>
          <View style={styles.articleHeader}>
            <TouchableOpacity onPress={() => setSelectedInsight(null)} style={styles.articleCloseBtn}>
              <Text style={styles.articleCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.articleHeaderTitle}>Today's Insight</Text>
            <View style={{ width: 40 }} />
          </View>
          {selectedInsight && (
            <ScrollView style={styles.articleScroll} showsVerticalScrollIndicator={false}>
              {jfyRefreshing && (
                <View style={{ backgroundColor: '#F0FDF4', borderBottomWidth: 1, borderBottomColor: '#BBF7D0', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>Today's fresh insights are loading in the background</Text>
                </View>
              )}
              <View style={[styles.insightDetailHeader, { backgroundColor: selectedInsight.color || '#E8F5E9', borderLeftColor: selectedInsight.accent || '#4CAF50' }]}>
                <Text style={[styles.insightDetailFeeling, { color: selectedInsight.accent || '#059669' }]}>{selectedInsight.feeling}</Text>
              </View>
              <View style={styles.insightDetailSection}>
                <Text style={styles.insightDetailLabel}>WHY THIS IS HAPPENING</Text>
                <FormattedText text={selectedInsight.why} bodyStyle={styles.insightDetailBody} />
              </View>
              <View style={styles.insightDetailSection}>
                <Text style={styles.insightDetailLabel}>WHAT TO DO</Text>
                <FormattedText text={selectedInsight.action} bodyStyle={styles.insightDetailBody} />
              </View>
              {selectedInsight.takeaway ? (
                <View style={[styles.insightDetailSection, { borderLeftWidth: 3, borderLeftColor: selectedInsight.accent || '#059669', paddingLeft: 12 }]}>
                  <Text style={[styles.insightDetailLabel, { color: selectedInsight.accent || '#059669' }]}>TAKEAWAY</Text>
                  <FormattedText text={selectedInsight.takeaway} bodyStyle={styles.insightDetailBody} />
                </View>
              ) : null}
              {onShowChat && (
                <TouchableOpacity
                  style={{ marginHorizontal: 20, marginTop: 24, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => { setSelectedInsight(null); onShowChat(`I just read this insight: "${selectedInsight?.feeling}" — can you tell me more?`); }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Talk to Coach</Text>
                </TouchableOpacity>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
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
