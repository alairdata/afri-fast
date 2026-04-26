import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const SUPABASE_URL = 'https://exvbplhajnvuhanykumm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dmJwbGhham52dWhhbnlrdW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODY2NTEsImV4cCI6MjA5MDY2MjY1MX0.L-D_1nnehcjcQZ52XEl0rhKOoUm7HmOMC4_wGIwQETE';

const PENDING_QUEUE_KEY = 'afri_pending_meal_photos_v1';
const STAGING_DIR = Platform.OS !== 'web' && FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}pendingMealPhotos/`
  : null;
const MAX_ATTEMPTS = 5;

const ensureStagingDir = async () => {
  if (!STAGING_DIR) return;
  try {
    const info = await FileSystem.getInfoAsync(STAGING_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(STAGING_DIR, { intermediates: true });
  } catch (e) {
    console.log('[Pending uploads] could not create staging dir:', e.message);
  }
};

const loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.log('[Pending uploads] could not save queue:', e.message);
  }
};

export const uploadMealPhoto = async (uri) => {
  if (!uri) return null;
  if (uri.startsWith('https://')) return uri;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[Upload] no session, skipping upload');
      return null;
    }
    const fileName = `${session.user.id}/${Date.now()}.jpg`;

    if (Platform.OS !== 'web') {
      const result = await FileSystem.uploadAsync(
        `${SUPABASE_URL}/storage/v1/object/meal-photos/${fileName}`,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType?.BINARY_CONTENT ?? 0,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'false',
          },
        }
      );
      if (result.status !== 200) {
        console.log('[Upload Error] native', { status: result.status, body: result.body, fileName });
        return null;
      }
    } else {
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) {
        console.log('[Upload Error] web', { message: error.message, statusCode: error.statusCode, fileName });
        return null;
      }
    }

    const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.log('[Upload Error] exception', { message: e.message, name: e.name });
    return null;
  }
};

// Copy a temp camera URI into a stable directory so the retry queue still has the file
// after an app restart (iOS especially can evict the camera cache).
export const enqueuePendingMealPhoto = async ({ mealId, localUri, items }) => {
  if (!STAGING_DIR || !localUri) return;
  try {
    await ensureStagingDir();
    const stagedPath = `${STAGING_DIR}${mealId}.jpg`;
    const srcInfo = await FileSystem.getInfoAsync(localUri);
    if (!srcInfo.exists) {
      console.log('[Pending uploads] source URI no longer exists, cannot enqueue:', localUri);
      return;
    }
    await FileSystem.copyAsync({ from: localUri, to: stagedPath });
    const queue = await loadQueue();
    const filtered = queue.filter(e => e.mealId !== mealId);
    filtered.push({
      mealId,
      localPath: stagedPath,
      items: items || [],
      attempts: 0,
      enqueuedAt: Date.now(),
    });
    await saveQueue(filtered);
    console.log('[Pending uploads] enqueued meal', mealId);
  } catch (e) {
    console.log('[Pending uploads] enqueue error:', e.message);
  }
};

// Drain the queue. For each entry, retry the upload; on success update the meal's photo
// in the DB, write community photos, delete the staged file, and call onPhotoUploaded so
// the UI can swap the image. Drops entries after MAX_ATTEMPTS.
export const processPendingMealPhotos = async ({
  saveCommunityPhotos,
  recipes,
  userEmail,
  onPhotoUploaded,
}) => {
  if (!STAGING_DIR) return;
  const queue = await loadQueue();
  if (!queue.length) return;
  console.log('[Pending uploads] draining', queue.length, 'entries');
  const remaining = [];
  for (const entry of queue) {
    const photoUrl = await uploadMealPhoto(entry.localPath);
    if (photoUrl) {
      const { error } = await supabase.from('meals').update({ photo: photoUrl }).eq('id', entry.mealId);
      if (error) {
        console.log('[Pending uploads] DB update failed for meal', entry.mealId, error.message);
        remaining.push({ ...entry, attempts: (entry.attempts || 0) + 1 });
        continue;
      }
      try { saveCommunityPhotos?.(entry.mealId, photoUrl, entry.items, recipes, userEmail); } catch (_) {}
      onPhotoUploaded?.(entry.mealId, photoUrl);
      try { await FileSystem.deleteAsync(entry.localPath, { idempotent: true }); } catch (_) {}
    } else {
      const attempts = (entry.attempts || 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.log('[Pending uploads] dropping meal', entry.mealId, 'after', attempts, 'attempts');
        try { await FileSystem.deleteAsync(entry.localPath, { idempotent: true }); } catch (_) {}
      } else {
        remaining.push({ ...entry, attempts });
      }
    }
  }
  await saveQueue(remaining);
};
