// Plain-language "what is this?" text for the (i) icons on the Insights tab. Say what a card shows and how to
// read it; never how it is worked out (no formulas, weights, thresholds or windows: those are Logga's own).

export const INSIGHT_HELP = {
  streaks: {
    title: 'Streaks',
    body: "Current streak is how many days in a row you've logged at least one meal. Best streak is your longest run so far.\n\nDays on target counts the days where what you ate was close to your calorie target. Days logged is every day you've logged anything.",
  },
  momentum: {
    title: 'Momentum',
    body: "A score from 0 to 100 that shows how well your recent days are moving you toward your goal. Higher is better.\n\nIt looks at how you've been eating, whether your meals keep you full, and how much you move. Tap \"See why\" to see what's helping and what's holding you back.\n\nThe small bars underneath show how steady you've been each week for the last 6 weeks.",
  },
  bmi: {
    title: 'Current BMI',
    body: "BMI (body mass index) compares your weight with your height. It gives a rough idea of whether your weight is in a healthy range for your height.\n\nThe World Health Organization ranges are: under 18.5 underweight, 18.5 to 24.9 healthy, 25 to 29.9 overweight, and 30 or more obese.\n\nBMI doesn't know how much muscle you have, so treat it as a guide, not a verdict.",
  },
  weight: {
    title: 'Weight trend',
    body: "Your weigh-ins over time. On days you don't weigh in, the chart keeps your last weight.\n\nDaily weight jumps up and down with water, salt and food, so look at the direction over a few weeks rather than any single day.",
  },
  prediction: {
    title: 'Prediction this week',
    body: "How much your weight is likely to change by the end of this week, based on what you've eaten and how active you've been.\n\nThe label tells you how that compares with the pace you chose: ahead, on track, drifting or stalled.",
  },
  forecast: {
    title: 'Forecast',
    body: "Where your weight is heading if you keep going the way you have been: your likely weight a week from now and the date you'd reach your goal.\n\nConfidence is higher when you log your meals and weigh yourself regularly.",
  },
  energy: {
    title: 'Energy balance',
    body: "Calories out versus calories in.\n\nTDEE is roughly how many calories your body burns in a day. Today is what you've eaten so far.\n\nA deficit means you ate less than you burn, which leads to weight loss over time. A surplus means you ate more.",
  },
  pace: {
    title: 'Pace to goal',
    body: "How far you've come from your starting weight toward your goal weight, and the date you'd reach it at your current rate.\n\nThe small line on the bar shows where your plan expected you to be by now.",
  },
  calories: {
    title: 'Calorie intake',
    body: "The calories you logged each day. Tap a bar to see that day.\n\nAvg daily cal is your average on the days you logged.\n\nThe percentage shows how far that average is above or below your calorie goal: +18% means about 18% over, −18% means about 18% under, and 0% is right on it. It turns green when you're close to your goal.",
  },
  burnout: {
    title: 'Burnout likelihood',
    body: "How likely you are to feel worn out and slip off your plan soon, from 0 (low) to 100 (high).\n\nIt tends to rise when you eat very little for a while, run low on protein or water, or your eating swings a lot from day to day. The bars show each day of this week.\n\nIt's a wellbeing guide, not a medical diagnosis.",
  },
  hydration: {
    title: 'Hydration',
    body: "The water you've logged each day, compared with your daily water goal. You can change the goal in Settings.",
  },
  steps: {
    title: 'Steps',
    body: "Your steps each day, from Apple Health or what you entered, compared with your daily step goal.",
  },
  activities: {
    title: 'Activities',
    body: "Workouts and activities you've logged.\n\nA dot is filled on each day this week where you logged an activity or walked 5,000 steps or more. Tap See all for your full list.",
  },
};
