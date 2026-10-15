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
// weekday: the predicted day's name, or null when it's within a day.
export function burnoutCopy(tone, weekday) {
  const when = weekday ? `around ${weekday}` : 'soon';
  switch (tone) {
    case 'cheerleader': return { title: 'Heads up 🌤️', body: `A rough patch may come ${when}. A proper meal and some water today and we beat it together!` };
    case 'gentle': return { title: 'Be easy on yourself 🌤️', body: `Things may feel heavy ${when}. A proper meal and some water today will help.` };
    case 'auntie': return { title: 'Listen to me 🌤️', body: `You may feel worn out ${when}. Eat a proper meal today, not just snacks o.` };
    case 'elder': return { title: 'Rest is part of the journey 🌤️', body: `A harder day may come ${when}. Eat well today and it will pass more gently.` };
    default: return { title: 'Heads up 🌤️', body: weekday ? `You may hit a rough patch around ${weekday}. Eating well today helps.` : 'You may hit a rough patch soon. A proper meal and some water today will help.' };
  }
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
