// Native (iOS/Android) sign-in. The web build keeps using supabase.auth.signInWithOAuth's
// full-page redirect (see AuthScreen); on a phone there's no page to redirect back to, so:
//  - Apple: the system Sign in with Apple sheet -> identity token -> Supabase signInWithIdToken
//  - Google (and any other provider): open the provider in an in-app browser, come back through
//    the app's own `logga://` link, and hand the returned tokens to Supabase.
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URL = 'logga://auth-callback';

// Resolves to { error?: string, cancelled?: true }.
export async function signInNative(provider) {
  try {
    if (provider === 'apple' && Platform.OS === 'ios') return await signInWithApple();
    return await signInWithBrowser(provider);
  } catch (e) {
    return { error: e?.message || 'Sign-in failed. Please try again.' };
  }
}

async function signInWithApple() {
  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
    throw e;
  }
  if (!credential.identityToken) return { error: 'Apple did not return an identity token.' };
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
  if (error) return { error: error.message };
  // Apple only sends the name on the very first sign-in, so save it now or it's lost.
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
  return {};
}

async function signInWithBrowser(provider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) return { error: error.message };
  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
  if (result.type !== 'success' || !result.url) return { cancelled: true };
  // Implicit flow: tokens come back in the URL fragment (#access_token=...&refresh_token=...).
  const params = new URLSearchParams(result.url.split('#')[1] || result.url.split('?')[1] || '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return { error: params.get('error_description') || 'Sign-in did not complete.' };
  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  return sessionError ? { error: sessionError.message } : {};
}
