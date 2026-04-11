// Web stub for expo-notifications — not supported on web
export const setNotificationHandler = () => {};
export const requestPermissionsAsync = async () => ({ status: 'denied' });
export const scheduleNotificationAsync = async () => {};
export const cancelScheduledNotificationAsync = async () => {};
export const SchedulableTriggerInputTypes = { DATE: 'date', DAILY: 'daily' };
export default {
  setNotificationHandler,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  SchedulableTriggerInputTypes,
};
