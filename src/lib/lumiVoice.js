// What Lumi says outside the AI: reminder notifications and the chat greeting, in the voice picked in
// onboarding (profiles.coach_tone: cheerleader | gentle | auntie | elder). No voice chosen = the plain lines.
// The AI side (chat, "Just for you", Insights) gets the same voices from api/_tone.js.
//
// Each kind has a few variants; pick() rotates them by day so the same line doesn't come back every day.

const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const comma = (name) => (first(name) ? `, ${first(name)}` : '');

const pick = (list, day = 0) => list[Math.abs(day) % list.length];

// slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
const MEAL = {
  plain: {
    breakfast: (n) => [{ title: `Good morning${comma(n)}`, body: 'Snap your breakfast so today starts on track.' }],
    lunch: (n) => [{ title: `Lunch time${comma(n)}`, body: 'Snap your plate so today stays on track.' }],
    dinner: (n) => [{ title: `Dinner time${comma(n)}`, body: "Log what you ate so today's total is right." }],
    snack: (n) => [{ title: `Snack time${comma(n)}?`, body: 'Small bites count too. Log it in a few seconds.' }],
  },
  cheerleader: {
    breakfast: (n) => [
      { title: `Good morning${comma(n)}! ☀️`, body: "Breakfast time! Snap it and let's start strong!" },
      { title: `Rise and shine${comma(n)}!`, body: 'Log that breakfast and the day is already a win!' },
    ],
    lunch: (n) => [
      { title: `Lunch time${comma(n)}!`, body: "Snap that plate, let's go! 📸" },
      { title: 'Lunch o’clock! 🍲', body: "Ten seconds to log it. Oya, let's keep the streak alive!" },
    ],
    dinner: (n) => [
      { title: `Dinner time${comma(n)}!`, body: 'Log it and close today like a champion! 🏆' },
      { title: 'Last one for today!', body: "Snap your dinner and we're done. We move!" },
    ],
    snack: (n) => [{ title: `Snack time${comma(n)}?`, body: "Small bites count too! Log it, you're doing great!" }],
  },
  gentle: {
    breakfast: (n) => [
      { title: `Good morning${comma(n)}`, body: 'Snap your breakfast whenever you’re ready.' },
      { title: 'Morning, my dear', body: 'If you’ve eaten, log it when you can. No rush.' },
    ],
    lunch: (n) => [
      { title: `Lunch time${comma(n)}`, body: 'Snap your plate when you’re ready. No rush.' },
      { title: 'Lunch time, my dear', body: 'Whenever you’ve eaten, a quick photo is enough.' },
    ],
    dinner: (n) => [
      { title: `Evening${comma(n)}`, body: 'If you’ve eaten, log it when you can. Small small.' },
      { title: 'Evening, my dear', body: 'Log your dinner when you’re ready, then rest well.' },
    ],
    snack: (n) => [{ title: `A little snack${comma(n)}?`, body: 'Log it whenever you like. Every bit counts.' }],
  },
  auntie: {
    breakfast: (n) => [
      { title: `${first(n) || 'My dear'}, have you eaten? 👀`, body: "Don't tell me you're skipping breakfast again o. Log it." },
      { title: 'Good morning 👀', body: 'Whatever you ate this morning, Auntie wants to see it.' },
    ],
    lunch: (n) => [
      { title: `What did you eat${comma(n)}? 👀`, body: "Don't hide it from me o. Snap the plate." },
      { title: 'Ehen, lunch 👀', body: 'Snap it before you finish it. I know you.' },
    ],
    dinner: (n) => [
      { title: 'Ehen, dinner 👀', body: 'Whatever you ate, log it. Auntie will find out anyway.' },
      { title: `${first(n) || 'My dear'}, it's evening`, body: "Log your dinner o. Don't make me come and check." },
    ],
    snack: (n) => [{ title: 'Snacking again? 👀', body: 'Puff puff, chin chin, whatever it is. Log it o.' }],
  },
  elder: {
    breakfast: (n) => [
      { title: 'Good morning, my child', body: 'The day is shaped by how it begins. Log your breakfast.' },
    ],
    lunch: (n) => [
      { title: 'Midday, my child', body: 'The meal you log today guides tomorrow.' },
      { title: 'The sun is high', body: 'Pause and write down what you ate. It will serve you later.' },
    ],
    dinner: (n) => [
      { title: 'Evening, my child', body: 'Before the day closes, write down what you ate.' },
      { title: 'The day is ending', body: 'A farmer counts his harvest at dusk. Log your dinner.' },
    ],
    snack: (n) => [{ title: 'A small bite, my child?', body: 'Small things, counted, become wisdom. Log it.' }],
  },
};

export function mealReminderCopy(tone, slot, name, day = 0) {
  const voice = MEAL[tone] || MEAL.plain;
  return pick((voice[slot] || voice.lunch)(name), day);
}

// pct: % of today's water goal (null for a day that hasn't happened yet).
export function waterCopy(tone, pct, day = 0) {
  const at = pct != null ? `${pct}%` : null;
  switch (tone) {
    case 'cheerleader': return pick([
      { title: 'Water break! 💧', body: at ? `You're at ${at}. Let's push it up, you've got this!` : 'A sachet now and you’re flying!' },
      { title: 'Hydration time! 💧', body: 'One sachet and you’re winning. Go go go!' },
    ], day);
    case 'gentle': return pick([
      { title: 'A little water? 💧', body: at ? `You're at ${at} today. A sachet now would be nice.` : 'A sachet now would be nice. Small small.' },
    ], day);
    case 'auntie': return pick([
      { title: at ? `${at} of your water? 💧` : 'Water check 💧', body: 'Are you a plantain? Drink water!' },
      { title: 'Water check 💧', body: "I hope you're not living on Fanta today o. Drink water." },
    ], day);
    case 'elder': return pick([
      { title: 'Water, my child 💧', body: at ? `You are at ${at}. Even the farmer waters his crops before sunset.` : 'Even the farmer waters his crops before sunset.' },
    ], day);
    default: return { title: 'Water check 💧', body: at ? `You're at ${at} of today's goal.` : 'How is your water today?' };
  }
}

export function streakCopy(tone, days, day = 0) {
  switch (tone) {
    case 'cheerleader': return { title: `${days}-day streak! 🔥`, body: "Don't let it die! Log something small and keep the fire going!" };
    case 'gentle': return { title: `${days} days 🤍`, body: 'If you can, log anything small today. No pressure.' };
    case 'auntie': return pick([
      { title: `${days} days, don't spoil it 👀`, body: "You've been doing well. Don't come and spoil it tonight. Log something." },
      { title: `${days}-day streak 👀`, body: 'Ehen, so you want to break it? Log one small thing o.' },
    ], day);
    case 'elder': return { title: `${days} days of seeds planted 🌱`, body: 'Water them once more today. Log something small.' };
    default: return { title: `${days}-day streak 🔥`, body: 'Log something small to keep it going.' };
  }
}

// steps: today's steps so far (0/null = none yet, or a day that hasn't happened).
export function moveCopy(tone, steps, day = 0) {
  const so = steps > 0 ? `${steps.toLocaleString()} steps so far.` : null;
  switch (tone) {
    case 'cheerleader': return { title: 'Quick walk? 🚶', body: so ? `${so} Ten more minutes and you're a champion!` : "Ten minutes of walking and you're a champion! 💪" };
    case 'gentle': return { title: 'Fancy a short walk?', body: so ? `${so} Even 10 more minutes counts.` : 'Even 10 minutes counts.' };
    case 'auntie': return { title: 'Get up small 🚶', body: so ? `Only ${steps.toLocaleString()} steps? Get up and walk small.` : "You've been sitting since morning. Get up and walk small." };
    case 'elder': return { title: 'A short walk, my child', body: so ? `${so} The path is made by walking.` : 'The path is made by walking. Ten minutes will do.' };
    default: return { title: 'A short walk? 🚶', body: so || 'Even 10 minutes counts.' };
  }
}

// A heads-up about a possible rough patch: calm in every voice (never alarming).
// when: the predicted day as read on the day the message arrives ('today', 'tomorrow', 'around Thursday',
// 'around next Tuesday'), so a bare weekday never leaves people guessing which week it means.
export function burnoutCopy(tone, when = 'soon') {
  switch (tone) {
    case 'cheerleader': return { title: 'Heads up 🌤️', body: `A rough patch may come ${when}. A proper meal and some water today and we beat it together!` };
    case 'gentle': return { title: 'Be easy on yourself 🌤️', body: `Things may feel heavy ${when}. A proper meal and some water today will help.` };
    case 'auntie': return { title: 'Listen to me 🌤️', body: `You may feel worn out ${when}. Eat a proper meal today, not just snacks o.` };
    case 'elder': return { title: 'Rest is part of the journey 🌤️', body: `A harder day may come ${when}. Eat well today and it will pass more gently.` };
    default: return { title: 'Heads up 🌤️', body: `You may hit a rough patch ${when}. A proper meal and some water today will help.` };
  }
}

// Messages for where someone is in their journey (see lifecycleMoments in smartNotifications.js).
// kind: firstLog | new1 | new2 | slip2 | slip3 | quiet14 | quiet30 | comeback.
// meal: their most-logged meal (slip3 only, may be null).
export function lifecycleCopy(tone, kind, name, meal = null) {
  const n = first(name);
  const lines = {
    plain: {
      firstLog: { title: 'Your first log is waiting', body: 'Snap or type something you ate today. It takes a few seconds.' },
      new1: { title: `Day 2${comma(name)}`, body: 'Log one meal today and Logga starts learning how you eat.' },
      new2: { title: `Day 3${comma(name)}`, body: 'Every day you log, Logga gets to know your eating a little better.' },
      slip2: { title: 'Quick log?', body: 'Nothing logged for 2 days. One quick log keeps your week on track.' },
      slip3: meal
        ? { title: `Had ${meal} today?`, body: 'Log it in a few seconds and pick up where you left off.' }
        : { title: `Still with us${comma(name)}?`, body: 'Log one meal today and pick up where you left off.' },
      quiet14: { title: 'Ready to pick it back up?', body: "It's been two weeks. One meal is all it takes to start again." },
      quiet30: { title: 'A fresh start? 🌱', body: 'Logga is ready whenever you are.' },
      comeback: { title: 'Day 2 of your comeback', body: 'Yesterday was a great restart. Log one meal today to keep it going.' },
    },
    cheerleader: {
      firstLog: { title: 'Your first log! 🎉', body: 'Snap something you ate today and watch your day fill up!' },
      new1: { title: "Day 2, let's go! 💪", body: 'Log a meal today and keep the momentum rolling!' },
      new2: { title: 'Three days in! 🔥', body: 'Log your dinner. The more you log, the smarter I get about you!' },
      slip2: { title: `Missed you${comma(name)}! 💛`, body: "Two days off is nothing. One quick log and we're back in it!" },
      slip3: meal
        ? { title: `Had ${meal} today? 😋`, body: "Log it in a few seconds and you're right back on track!" }
        : { title: 'Comeback time! 💪', body: "Log one meal today and you're right back on track!" },
      quiet14: { title: `We miss you${comma(name)}! 💛`, body: "Two weeks away? No problem. One log and we're back in business!" },
      quiet30: { title: 'Fresh start? 🌱', body: "Whenever you're ready, I'll be right here cheering you on!" },
      comeback: { title: 'Comeback, day 2! 💪', body: "You're back and I love it! Log a meal today and keep it rolling!" },
    },
    gentle: {
      firstLog: { title: `Whenever you're ready${comma(name)}`, body: 'Your first log can be anything you ate today. A quick photo is enough.' },
      new1: { title: `Day 2${comma(name)}`, body: 'One meal logged today is plenty. Go at your own pace.' },
      new2: { title: `Three days${comma(name)}`, body: 'Log your dinner when you can. Each day helps me understand you better.' },
      slip2: { title: `Busy few days${comma(name)}?`, body: "No pressure. When you're ready, one quick log is enough." },
      slip3: meal
        ? { title: `Had ${meal} today?`, body: "If you have, a quick log is all it takes. No rush." }
        : { title: `Whenever you're ready${comma(name)}`, body: "One meal logged today and you're back. No rush." },
      quiet14: { title: `Thinking of you${comma(name)}`, body: "It's been a while, and that's okay. I'm here when you want me." },
      quiet30: { title: 'A fresh start, whenever 🌱', body: "No rush at all. I'll be here when you're ready." },
      comeback: { title: `Good to have you back${comma(name)}`, body: 'Yesterday was a lovely restart. One log today keeps it going.' },
    },
    auntie: {
      firstLog: { title: `${n || 'My dear'}, nothing logged yet 👀`, body: 'You signed up and disappeared? Show me one thing you ate today.' },
      new1: { title: 'Day 2 👀', body: 'Yesterday was the easy part. Let me see what you eat today.' },
      new2: { title: "Day 3, I'm watching 👀", body: 'The more you log, the more I know. So log your dinner o.' },
      slip2: { title: 'Where have you been? 👀', body: 'Two days and not one meal? Come and show me what you ate.' },
      slip3: meal
        ? { title: `${meal} again today? 👀`, body: "Don't think I've forgotten you. Log it." }
        : { title: 'Three days o 👀', body: "I'm still waiting. Log one meal today." },
      quiet14: { title: `Two weeks${n ? `, ${n}` : ''}? 👀`, body: "I'm not angry. Just come back and log one meal." },
      quiet30: { title: "Okay, I'll stop asking 👀", body: 'When you are ready, you know where to find me.' },
      comeback: { title: "So you're back for real? 👀", body: 'Yesterday was good. Let me see if today will be too.' },
    },
    elder: {
      firstLog: { title: 'The first step, my child', body: 'Every journey begins with one. Log one thing you ate today.' },
      new1: { title: 'The second day, my child', body: 'A habit is built in the days after the first. Log one meal today.' },
      new2: { title: 'Three days, my child', body: 'The more you share, the better I can guide you. Log your dinner.' },
      slip2: { title: 'Two quiet days, my child', body: 'A path not walked grows over. One log today clears it.' },
      slip3: meal
        ? { title: `Your ${meal}, my child?`, body: 'If it was on your plate today, write it down.' }
        : { title: 'Three days, my child', body: 'Returning is also part of the journey. Log one meal today.' },
      quiet14: { title: 'Two weeks have passed, my child', body: 'The door is still open. One log is enough to begin again.' },
      quiet30: { title: 'A new season, my child 🌱', body: 'When you are ready, we begin again.' },
      comeback: { title: 'Welcome back, my child', body: 'The return was the hard part. Log one meal today and walk on.' },
    },
  };
  return (lines[tone] || lines.plain)[kind];
}

export function coachGreeting(tone, name) {
  const n = first(name);
  switch (tone) {
    case 'cheerleader': return `${n ? `Hey ${n}!` : 'Hey!'} I'm Lumi, your biggest fan. I can see your meals, water and weight, so ask me anything and let's win this together!`;
    case 'gentle': return `${n ? `Hi ${n}.` : 'Hi.'} I'm Lumi. I can see your meals, water and weight, so ask me anything, whenever you're ready. No pressure.`;
    case 'auntie': return `${n ? `Ehen, ${n}.` : 'Ehen.'} It's Lumi. I can see your meals, your water, your weight, everything o. So ask me anything, and don't hide anything from me.`;
    case 'elder': return `${n ? `Welcome, ${n}.` : 'Welcome, my child.'} I'm Lumi. I can see your meals, water and weight. Ask me anything; we'll take it one step at a time.`;
    default: return n
      ? `Hi ${n}! I'm your personal weight loss coach. I have access to all your data — your meals, calories, weight, and hydration. Ask me anything!`
      : `Hi! I'm your personal weight loss coach. I have access to all your data — ask me anything about your progress, goals, or how to improve!`;
  }
}
