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

// ─── Fast End ───
export const scheduleFastEndNotification = async (fastStartTimestamp, planHours) => {
  await Notifications.cancelScheduledNotificationAsync('fast-end').catch(() => {});
  const endTime = new Date(fastStartTimestamp + planHours * 60 * 60 * 1000);
  if (endTime <= new Date()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'fast-end',
    content: {
      title: 'Fast complete! 🎉',
      body: `You've hit ${planHours} hours. Break your fast mindfully.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endTime,
    },
  });
};

// ─── Milestones ───
const MILESTONES = [
  { hours: 12, title: '12 hours down 💪', body: 'Your body is in fat-burning mode. Keep going!' },
  { hours: 16, title: '16 hours! You\'re on fire 🔥', body: 'This is where the magic happens. Autophagy may have kicked in.' },
  { hours: 24, title: '24 hours fasted 🏆', body: 'A full day! Deep cellular repair is happening right now.' },
];

export const scheduleMilestoneNotifications = async (fastStartTimestamp, planHours) => {
  for (const m of MILESTONES) {
    const id = `milestone-${m.hours}h`;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    if (m.hours >= planHours) continue;
    const triggerTime = new Date(fastStartTimestamp + m.hours * 60 * 60 * 1000);
    if (triggerTime <= new Date()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: m.title, body: m.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
  }
};

export const cancelFastingNotifications = async () => {
  const ids = ['fast-end', 'milestone-12h', 'milestone-16h', 'milestone-24h'];
  await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
};

// ─── Daily Fast Start Reminder (8pm) ───
export const scheduleFastStartReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('fast-start-daily').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'fast-start-daily',
    content: {
      title: 'Time to start your fast 🌙',
      body: 'Tap to begin your fasting window for tonight.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
};

export const cancelFastStartReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('fast-start-daily').catch(() => {});
};

// ─── Meal Log Reminder (7pm) ───
export const scheduleMealReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('meal-reminder').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'meal-reminder',
    content: {
      title: 'Log your meals 🍽️',
      body: "Don't forget to track what you ate today.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 0,
    },
  });
};

export const cancelMealReminder = async () => {
  await Notifications.cancelScheduledNotificationAsync('meal-reminder').catch(() => {});
};
