// Worrying words in what someone writes (check-in notes), found by fixed patterns on the phone and the server.
// No AI reads the note for this. Two levels:
//   'urgent': thoughts of self-harm, not wanting to live, making themselves sick, stopping eating, fainting
//   'hard':   a heavy day (hating their body, feeling like a failure, giving up)
// The wording below is fixed on purpose: safety messages are never improvised.

const URGENT = [
  /\bsuicid/i,
  /\b(kill|hurt|harm|cut)(ing)? (myself|me)\b/i,
  /\bself[- ]?harm/i,
  /\bend (it all|my life|everything)\b/i,
  /\b(don'?t|do not|no longer) want to (live|be here|exist|wake up)\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\b(make|made|making) myself (sick|throw up|vomit|puke)\b/i,
  /\b(purg(e|ed|ing)|laxatives?|diet pills?)\b/i,
  /\bstarv(e|ed|ing) myself\b/i,
  /\b(stop|quit)(ped)? eating (completely|altogether|entirely|for days)\b/i,
  /\bjust (stop|quit) eating\b/i,
  /\bnot eat(en|ing)? (at all|anything) (for|in) (days|a week)\b/i,
  /\b(fainted|passed out|blacked out)\b/i,
];

const HARD = [
  /\bhate (my|this) (body|self|weight|stomach|belly|thighs|face)\b/i,
  /\bhate myself\b/i,
  /\b(disgusting|disgusted with myself|ashamed of myself|so fat)\b/i,
  /\b(i'?m|i am|i feel like) (a |such a )?(failure|worthless|useless|hopeless)\b/i,
  /\b(feel like |want to |about to )giv(e|ing) up\b/i,
  /\bgiv(e|ing) up on (myself|me|this|everything)\b/i,
  /\b(should|might as well|just) (just )?give up\b/i,
  /\bwhat'?s the point\b/i,
  /\bpunish(ing)? myself\b/i,
  /\bnothing (is )?work(s|ing)\b/i,
];

/** 'urgent', 'hard' or null for one piece of text. */
export function worryLevel(text) {
  const t = String(text || '');
  if (!t.trim()) return null;
  if (URGENT.some((re) => re.test(t))) return 'urgent';
  if (HARD.some((re) => re.test(t))) return 'hard';
  return null;
}

/** The most worrying level across several texts. */
export function worstWorry(texts = []) {
  let worst = null;
  for (const t of texts) {
    const level = worryLevel(t);
    if (level === 'urgent') return 'urgent';
    if (level === 'hard') worst = 'hard';
  }
  return worst;
}

export const HELPLINE_URL = 'https://findahelpline.com';

export const SUPPORT_TEXT = {
  urgent: {
    title: "You don't have to carry this alone",
    body: "What you wrote sounds really hard. If you're thinking about hurting yourself, have stopped eating, or have made yourself sick, please talk to someone today: a doctor, someone you trust, or a free helpline. If you're in danger right now, call your local emergency number.",
    button: 'Find a helpline',
  },
  hard: {
    title: 'That sounds like a heavy day',
    body: "A hard day doesn't undo your progress, and your worth isn't a number on a scale. If these feelings keep coming back, talking to a doctor or someone you trust can really help.",
  },
};
