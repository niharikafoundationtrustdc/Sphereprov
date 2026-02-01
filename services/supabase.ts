
import { createClient } from '@supabase/supabase-js';

// Vercel/Vite environment variables access
const getEnv = (key: string) => {
  return (import.meta as any).env?.[key] || (process as any).env?.[key] || '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://fejxskvsjfwjqmiobtpp.supabase.co';

/**
 * Validates if the provided key is a real Supabase key or a placeholder.
 * Supabase keys are 3-part JWTs starting with 'eyJ'.
 */
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanhza3Zzamp3anFtaW9idHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY0NTAwMDAsImV4cCI6MjAyMjA0NjQwMH0.DUMMY_SIGNATURE_REPLACE_WITH_REAL_KEY';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

// Guard: Check if sync should even be attempted
// If this is FALSE, data remains LOCAL to the current browser/device.
export const IS_CLOUD_ENABLED = SUPABASE_ANON_KEY !== FALLBACK_KEY && !SUPABASE_ANON_KEY.includes('placeholder') && SUPABASE_ANON_KEY.length > 50;

if (!IS_CLOUD_ENABLED) {
  console.warn("⚠️ DATABASE STATUS: Local-Only Mode. Changes will NOT sync to other devices until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided in environment variables.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: { 'x-application-name': 'hotelsphere-pro' },
  },
});

/**
 * Helper to sync local table data to Supabase.
 */
export async function pushToCloud(tableName: string, data: any) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return true;

  try {
    if (!data) return true;
    const payload = Array.isArray(data) ? data : [data];
    if (payload.length === 0) return true;

    const { error } = await supabase
      .from(tableName)
      .upsert(payload, { onConflict: 'id' });
    
    if (error) {
      console.error(`[Cloud Sync Error] ${tableName}:`, error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    return false;
  }
}

/**
 * Helper to remove record from Supabase.
 */
export async function removeFromCloud(tableName: string, id: string) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return true;

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Fetches all records from a Supabase table.
 */
export async function pullFromCloud(tableName: string) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return [];

  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Subscribe to real-time changes for a table.
 */
export function subscribeToTable(tableName: string, onUpdate: (payload: any) => void) {
  if (!IS_CLOUD_ENABLED) return { unsubscribe: () => {} };

  return supabase
    .channel(`${tableName}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();
}
