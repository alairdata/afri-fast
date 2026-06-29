import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── Daily Weigh-In Reminder ───
export const scheduleWeighInReminder = async (hour = 7, minute = 0) => {
  await Notifications.cancelScheduledNotificationAsync('weigh-in-daily').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'weigh-in-daily',
    content: {
      title: 'Time to weigh in 📊',
      body: 'Log your weight first thing this morning for the most accurate reading.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const cancelWeighInReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('weigh-in-daily').catch(() => {});
};

// ─── Calorie Check Reminder (evening) ───
export const scheduleCalorieCheckReminder = async (hour = 20, minute = 0) => {
  await Notifications.cancelScheduledNotificationAsync('calorie-check-daily').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'calorie-check-daily',
    content: {
      title: 'How are your calories today? 🍽️',
      body: "Check your calorie total and log any meals you haven't tracked yet.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const cancelCalorieCheckReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('calorie-check-daily').catch(() => {});
};

// ─── Goal Streak Celebration (fires immediately on milestone) ───
export const fireStreakCelebration = async (streakDays) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${streakDays}-day streak! 🔥`,
      body: `You've hit your calorie goal ${streakDays} days in a row. Keep it up!`,
    },
    trigger: null,
  });
};

// ─── Meal Log Reminder ───
export const scheduleMealReminder = async (hour = 19, minute = 0) => {
  await Notifications.cancelScheduledNotificationAsync('meal-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'meal-reminder',
    content: {
      title: 'Log your meals 🍽️',
      body: "Don't forget to track what you ate today.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
};

export const cancelMealReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('meal-reminder').catch(() => {});
};

// ─── Predictive insight notification (one per day, model-timed) ───
export const schedulePredictionNotification = async (prediction) => {
  await Notifications.cancelScheduledNotificationAsync('prediction-daily').catch(() => {});
  if (!prediction?.text || prediction.hour == null) return;
  const fireAt = new Date();
  fireAt.setDate(fireAt.getDate() + 1);
  fireAt.setHours(prediction.hour, prediction.minute ?? 0, 0, 0);
  if (fireAt <= new Date()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'prediction-daily',
    content: {
      title: 'AfriFast has a tip for you',
      body: prediction.text,
      data: { type: 'prediction', cardIndex: prediction.cardIndex ?? 0 },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
};

// ─── Celebration / Achievement notification (fires immediately) ───
export const fireCelebrationNotification = async (title, body) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};

// ─── Legacy stubs (kept for backward compatibility, do nothing) ───
export const scheduleFastEndNotification = async () => {};
export const scheduleMilestoneNotifications = async () => {};
export const cancelFastingNotifications = async () => {};
export const scheduleBreakFastReminder = async () => {};
export const scheduleEatingWindowCloseReminder = async () => {};
export const cancelEatingWindowReminder = async () => {};
export const scheduleFastStartReminder = async (hour = 7) => scheduleWeighInReminder(hour);
export const cancelFastStartReminder = async () => cancelWeighInReminder();
export const scheduleFastEndReminderDaily = async (hour = 20) => scheduleCalorieCheckReminder(hour);
export const cancelFastEndReminderDaily = async () => cancelCalorieCheckReminder();
