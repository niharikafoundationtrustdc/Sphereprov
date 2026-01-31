
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
const IS_CONFIG_VALID = SUPABASE_ANON_KEY !== FALLBACK_KEY && !SUPABASE_ANON_KEY.includes('placeholder');

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
  // 1. Check for valid config
  if (!IS_CONFIG_VALID) {
    return true; // Silently skip sync if no real key is provided
  }

  // 2. Check if device is online
  if (!navigator.onLine) {
    return true; 
  }

  try {
    if (!data) return true;
    const payload = Array.isArray(data) ? data : [data];
    if (payload.length === 0) return true;

    const { error } = await supabase
      .from(tableName)
      .upsert(payload, { onConflict: 'id' });
    
    if (error) {
      if (error.code === '42P01') {
        console.error(`[Supabase Error] Table "${tableName}" missing. Run database_setup.sql.`);
      } else if (error.message?.includes('JWT')) {
        console.warn(`[Supabase Auth] Invalid API Key detected. Cloud sync disabled.`);
      } else {
        console.error(`[Supabase Sync Error] ${tableName}:`, error.message);
      }
      return false;
    }
    return true;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      // Avoid spamming logs for network/CORS/Paused project issues
      console.debug(`[Cloud Sync] Unreachable: Project might be paused or network is blocked.`);
    } else {
      console.error(`[Cloud Connection Failed] ${tableName}:`, err);
    }
    return false;
  }
}

/**
 * Helper to remove record from Supabase.
 */
export async function removeFromCloud(tableName: string, id: string) {
  if (!IS_CONFIG_VALID || !navigator.onLine) return true;

  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.debug(`[Cloud Delete Failed] ${tableName}:`, err);
    return false;
  }
}

/**
 * Fetches all records from a Supabase table.
 */
export async function pullFromCloud(tableName: string) {
  if (!IS_CONFIG_VALID || !navigator.onLine) return [];

  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.debug(`[Cloud Pull Failed] ${tableName}:`, err);
    return [];
  }
}

/**
 * Subscribe to real-time changes for a table.
 */
export function subscribeToTable(tableName: string, onUpdate: (payload: any) => void) {
  if (!IS_CONFIG_VALID) return { unsubscribe: () => {} };

  return supabase
    .channel(`${tableName}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] Subscription error for ${tableName}. Ensure Realtime is enabled in Supabase.`);
      }
    });
}
