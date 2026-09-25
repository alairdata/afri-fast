import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const SUPABASE_URL = 'https://exvbplhajnvuhanykumm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dmJwbGhham52dWhhbnlrdW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODY2NTEsImV4cCI6MjA5MDY2MjY1MX0.L-D_1nnehcjcQZ52XEl0rhKOoUm7HmOMC4_wGIwQETE';

// Uploads a profile photo to the public "avatars" bucket at a fixed per-user path (so a new photo
// replaces the old one instead of piling up) and returns its public URL, or null on any failure.
// The ?v= suffix busts the CDN/image cache after a replace.
export const uploadAvatar = async (uri) => {
  if (!uri) return null;
  if (uri.startsWith('https://')) return uri;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const path = `${session.user.id}/avatar.jpg`;

    if (Platform.OS !== 'web') {
      const result = await FileSystem.uploadAsync(
        `${SUPABASE_URL}/storage/v1/object/avatars/${path}`,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType?.BINARY_CONTENT ?? 0,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true',
          },
        }
      );
      if (result.status !== 200) {
        console.log('[Avatar upload error] native', { status: result.status, body: result.body });
        return null;
      }
    } else {
      const blob = await (await fetch(uri)).blob();
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
      if (error) {
        console.log('[Avatar upload error] web', { message: error.message, statusCode: error.statusCode });
        return null;
      }
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (e) {
    console.log('[Avatar upload error] exception', { message: e.message });
    return null;
  }
};
