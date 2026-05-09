import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const WILLPOWER_KEY = 'willpower_v1';

export async function addWillpowerEntry(userId, label = null) {
  if (!userId) return;
  try {
    await supabase.from('willpower_logs').insert({ user_id: userId, label });
  } catch (_) {}
  try {
    const key = `${WILLPOWER_KEY}_${userId}`;
    const raw = await AsyncStorage.getItem(key);
    await AsyncStorage.setItem(key, String((raw ? parseInt(raw) : 0) + 1));
  } catch (_) {}
}

export async function getWillpowerCount(userId) {
  if (!userId) return 0;
  try {
    const raw = await AsyncStorage.getItem(`${WILLPOWER_KEY}_${userId}`);
    if (raw) return parseInt(raw) || 0;
  } catch (_) {}
  return 0;
}
