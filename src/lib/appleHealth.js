// Apple Health exists only on iPhone (see appleHealth.ios.js). Everywhere else these do nothing.
export const appleHealthSupported = () => false;
export async function connectAppleHealth() { return false; }
export async function readDailySteps() { return []; }
