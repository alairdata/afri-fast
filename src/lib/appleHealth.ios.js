// Apple Health (HealthKit) on iPhone: read the daily step count straight from the Health app, so nobody has to
// set up a Shortcut or type steps in. Read-only: Logga never writes to Health.
// Other platforms get appleHealth.js (does nothing).
//
// The library is loaded on first use, inside try/catch: if its native part were ever missing from a build,
// Apple Health just reports "not available" instead of crashing the app at launch.
const STEPS = 'HKQuantityTypeIdentifierStepCount';

let hk;
const lib = () => {
  if (hk !== undefined) return hk;
  try {
    hk = require('@kingstinct/react-native-healthkit');
  } catch (e) {
    console.log('[AppleHealth] not in this build:', e?.message);
    hk = null;
  }
  return hk;
};

export const appleHealthSupported = () => {
  try { return !!lib()?.isHealthDataAvailable(); } catch (_) { return false; }
};

// Shows Apple's permission sheet the first time. iOS never tells apps whether reading was allowed (privacy),
// so success here only means the request went through; a refusal simply reads as 0 steps.
export async function connectAppleHealth() {
  if (!appleHealthSupported()) return false;
  try {
    await lib().requestAuthorization({ toRead: [STEPS] });
    return true;
  } catch (e) {
    console.log('[AppleHealth] authorization failed:', e?.message);
    return false;
  }
}

// Total steps per day for the last `days` days (today included), oldest first:
// [{ date: 'Sun Oct 04 2026', steps: 6200 }, ...]. Days with no steps are left out.
export async function readDailySteps(days = 7) {
  if (!appleHealthSupported()) return [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0); // buckets run midnight to midnight, local time
  try {
    const buckets = await lib().queryStatisticsCollectionForQuantity(
      STEPS, ['cumulativeSum'], anchor, { day: 1 },
      { filter: { date: { startDate: start, endDate: new Date() } }, unit: 'count' },
    );
    return (buckets || [])
      .map((b) => ({ date: b.startDate ? new Date(b.startDate).toDateString() : null, steps: Math.round(b.sumQuantity?.quantity || 0) }))
      .filter((r) => r.date && r.steps > 0);
  } catch (e) {
    console.log('[AppleHealth] read failed:', e?.message);
    return [];
  }
}
