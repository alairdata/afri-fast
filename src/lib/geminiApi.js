import { Platform } from 'react-native';
import { ensureAiConsent, AiConsentError } from './consent';
import { aiHeaders } from './aiAuth';

const BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';
const GEMINI_API_URL = `${BASE}/api/gemini`;

// The food AI endpoint (api/gemini.js). Throws AiConsentError without consent, and the server's error otherwise.
export async function callGeminiApi(type, data) {
  // Nothing goes to Google without the person's say-so (guideline 5.1.2(i)); the screen that opened this already asked.
  if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: await aiHeaders(),
    body: JSON.stringify({ type, data }),
  });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Server returned an unexpected response. Try again.'); }
  if (!response.ok) throw new Error(result.error || 'AI service error');
  return result;
}
