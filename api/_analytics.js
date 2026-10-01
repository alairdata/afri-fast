// Server-side Mixpanel events (emails sent, sign-ups...). Same idea as SUAI's trackServerEvent: the
// Mixpanel HTTP API, keyed by the user's id so server events line up with the app's own events.
// Needs MIXPANEL_TOKEN on Vercel (Logga's own Mixpanel project). With no token it does nothing.
export async function trackServerEvent(distinctId, event, properties = {}) {
  const token = process.env.MIXPANEL_TOKEN;
  if (!token || !distinctId) return;
  try {
    await Promise.race([
      fetch('https://api.mixpanel.com/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
        body: JSON.stringify([{
          event,
          properties: {
            ...properties,
            distinct_id: distinctId,
            token,
            time: Math.floor(Date.now() / 1000),
            $insert_id: `${event}-${distinctId}-${Date.now()}`,
            source: 'server',
          },
        }]),
      }),
      // Serverless functions can be frozen once they reply, so wait briefly, but never hang a request.
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch (_) { /* analytics must never break auth */ }
}
