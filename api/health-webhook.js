// Receives Apple Health data pushed from an iOS Shortcuts automation on your phone (see the
// setup notes at the bottom of this file, or ask Claude) and writes it into the same tables the
// app itself reads from — step_logs for now, extensible to other metrics via ?metric=.
//
// This is hit directly by the Shortcuts app, never from inside the PWA, so there's no Supabase
// session behind the request — auth is a shared secret header instead. HEALTH_WEBHOOK_USER_ID is
// fixed server-side (not read from the request body) so a leaked secret still can't be used to
// write into a different account.

async function insertSupabase(table, rows) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase service credentials not configured');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${text}`);
  }
}

// Best-effort extraction of a total steps count from whatever shape the "Find Health Samples"
// Shortcuts action hands us — the exact JSON keys vary by iOS version and how the shortcut's
// fields are wired, and can't be known for certain without a real payload to look at. Tries
// several plausible shapes; the raw body is always logged either way so the parser can be
// tightened to match exactly once we've seen one real request.
function extractStepsTotal(body) {
  const samples = Array.isArray(body) ? body
    : Array.isArray(body?.samples) ? body.samples
    : Array.isArray(body?.HealthSamples) ? body.HealthSamples
    : [body];

  const asNumber = (v) => {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') {
      if (typeof v.Amount === 'number') return v.Amount;
      if (typeof v.amount === 'number') return v.amount;
    }
    return null;
  };

  let total = 0;
  let found = false;
  samples.forEach((s) => {
    if (s == null) return;
    for (const key of ['Quantity', 'quantity', 'Sum', 'sum', 'Value', 'value', 'Steps', 'steps', 'Amount', 'amount']) {
      const n = asNumber(s[key]);
      if (n != null) { total += n; found = true; break; }
    }
  });

  return found ? Math.round(total) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SECRET = process.env.HEALTH_WEBHOOK_SECRET;
  const USER_ID = process.env.HEALTH_WEBHOOK_USER_ID;
  if (!SECRET || !USER_ID) return res.status(500).json({ error: 'Webhook not configured' });

  const provided = req.headers['x-webhook-secret'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (provided !== SECRET) {
    // Never log the actual secret values -- just enough shape info (length, first/last char) to
    // tell a copy-paste mismatch (whitespace, wrong header, truncation) apart from a genuinely
    // different string, without exposing anything usable.
    console.error('[health-webhook] secret mismatch', {
      providedLen: provided.length, expectedLen: SECRET.length,
      providedEdges: provided ? `${provided[0]}...${provided[provided.length - 1]}` : '(empty)',
      expectedEdges: `${SECRET[0]}...${SECRET[SECRET.length - 1]}`,
      headerKeysSeen: Object.keys(req.headers).filter((k) => k.toLowerCase().includes('secret') || k.toLowerCase() === 'authorization'),
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;
  console.log('[health-webhook] raw payload:', JSON.stringify(body).slice(0, 5000));

  const metric = (req.query.metric || 'steps').toString();
  const dateStr = new Date().toDateString(); // automation runs nightly for the day just finished

  try {
    if (metric === 'steps') {
      const total = extractStepsTotal(body);
      if (total == null) {
        console.error('[health-webhook] could not extract a steps total — payload shape was:', JSON.stringify(body).slice(0, 500));
        return res.status(200).json({ ok: false, reason: 'unrecognized payload shape, logged for review' });
      }
      await insertSupabase('step_logs', [{
        id: Date.now(),
        user_id: USER_ID,
        date: dateStr,
        display_date: dateStr,
        steps: total,
      }]);
      return res.status(200).json({ ok: true, metric: 'steps', date: dateStr, steps: total });
    }

    return res.status(400).json({ error: `Unknown metric: ${metric}` });
  } catch (e) {
    console.error('[health-webhook] exception', e);
    return res.status(500).json({ error: e.message });
  }
}

/*
SETUP (one-time):

1. Vercel dashboard -> Project -> Settings -> Environment Variables, add:
   - HEALTH_WEBHOOK_SECRET   any long random string you generate yourself
   - HEALTH_WEBHOOK_USER_ID  your Supabase auth user id (Supabase dashboard -> Authentication ->
                              Users -> find your account -> copy the UUID)
   Redeploy after adding these (or they won't be picked up).

2. iOS Shortcuts app -> new shortcut:
   a. Add Action: "Find Health Samples" -> type: Steps -> Group By: Day ->
      filter: Start Date is in the last 1 day
   b. Add Action: "Get Contents of URL"
      - URL: https://afri-fast.vercel.app/api/health-webhook?metric=steps
      - Method: POST
      - Headers: add one — Key: X-Webhook-Secret, Value: <the secret from step 1>
      - Request Body: JSON -> Add new field -> Array -> long-press the value ->
        Insert Variable -> Find Health Samples
   c. Tap Play to test once manually — iOS will ask for Health + network permission, allow both.

3. Automation tab -> Personal Automation -> Time of Day (e.g. 11:30pm nightly) -> run this
   shortcut -> turn OFF "Ask Before Running" so it's silent.

After the first manual test run, check Vercel's function logs for this endpoint (Vercel
dashboard -> Deployments -> Functions, or `vercel logs`) and look for the
"[health-webhook] raw payload:" line — send that shape back so extractStepsTotal() above can be
tightened to match exactly instead of guessing at the key names.
*/
