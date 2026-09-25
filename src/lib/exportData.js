import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const EXPORT_TABLES = [
  ['meals', 'user_id'],
  ['weight_logs', 'user_id'],
  ['water_logs', 'user_id'],
  ['check_ins', 'user_id'],
  ['step_logs', 'user_id'],
  ['activities', 'user_id'],
  ['fasting_sessions', 'user_id'],
  ['daily_goal_ledger', 'user_id'],
];

const PAGE = 1000;

// Pulls every row (paging past the 1000-row default) for one table. A table that errors out (missing,
// blocked) is left out of the export rather than failing the whole thing.
async function fetchAll(table, column, userId) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq(column, userId).range(from, from + PAGE - 1);
    if (error) {
      console.log(`[Export] ${table}: ${error.message}`);
      return null;
    }
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Builds a JSON file of everything the user has stored and hands it over: a browser download on web,
// the system share sheet on phones. Returns { ok, error? }.
export async function exportMyData(userId) {
  if (!userId) return { ok: false, error: 'Not signed in' };
  try {
    const payload = { exportedAt: new Date().toISOString(), userId };

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    payload.profile = profile || null;

    for (const [table, column] of EXPORT_TABLES) {
      const rows = await fetchAll(table, column, userId);
      if (rows) payload[table] = rows;
    }

    const json = JSON.stringify(payload, null, 2);
    const fileName = `logga-data-${new Date().toISOString().slice(0, 10)}.json`;

    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { ok: true };
    }

    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, json);
    if (!(await Sharing.isAvailableAsync())) return { ok: false, error: 'Sharing is not available on this device' };
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export my Logga data', UTI: 'public.json' });
    return { ok: true };
  } catch (e) {
    console.log('[Export] failed:', e.message);
    return { ok: false, error: e.message };
  }
}
