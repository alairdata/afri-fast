// Single source of truth for "current meal-logging streak" -- how many consecutive days,
// counting backward from anchorDate, have at least one meal logged. Three places in the app
// show a version of this number (the Meals tab banner, the meal share card, and the Insights
// tab's Streaks tile) -- they used to each hand-roll their own loop, and drifted: the Insights
// tab capped its lookback at whatever chart-range window was active (as low as 7 days) while
// the Meals tab banner looked back a full year, so a real 40-day streak could show as "6" in
// one place and "40" in the other. All three now call this instead.
//
// If anchorDate itself has no log yet (e.g. "today" before you've eaten), that alone doesn't
// zero the streak -- it just starts counting from the day before, so a streak in progress isn't
// wiped out purely because today hasn't happened yet.
export const computeCurrentMealStreak = (recentMeals, anchorDate = new Date()) => {
  const loggedDates = new Set((recentMeals || []).map(m => m.date));
  const hasLoggedAnchor = loggedDates.has(anchorDate.toDateString());
  let streak = 0;
  for (let i = hasLoggedAnchor ? 0 : 1; i < 365; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    if (loggedDates.has(d.toDateString())) streak++;
    else break;
  }
  return streak;
};
