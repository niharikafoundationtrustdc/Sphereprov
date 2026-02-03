
import { createClient } from '@supabase/supabase-js';

// User provided credentials for Project: fejxskvsjfwjqmiobtpp
const SUPABASE_URL = 'https://fejxskvsjfwjqmiobtpp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2uT90ihz2_hKT4ax30ysbA_hZZBiX9P';

// CRITICAL: Set to true to enable "Green" status and Enterprise Multi-Device Live Sync
export const IS_CLOUD_ENABLED = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    headers: { 'x-application-name': 'hotelsphere-pro' }
  }
});

/**
 * Pushes local changes to the Supabase Cloud.
 * Uses upsert with onConflict 'id' to ensure sync consistency across devices.
 */
export async function pushToCloud(tableName: string, data: any) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return true;
  try {
    if (!data) return true;
    
    // Clean data: remove any circular references or undefined fields that might break JSON serialization
    const cleanData = JSON.parse(JSON.stringify(data));
    const payload = Array.isArray(cleanData) ? cleanData : [cleanData];
    
    if (payload.length === 0) return true;
    
    // Remote upsert handles insert/update automatically based on 'id'
    const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
    
    if (error) {
      // Specifically catch and ignore AbortErrors as they are transient and usually fixed by the next sync cycle
      if (error.message?.includes('AbortError') || error.code === 'ABORT_ERR') {
        console.debug(`Sync [${tableName}]: Request aborted (transient).`);
        return true;
      }
      console.warn(`Cloud Sync Issue [${tableName}]: ${error.message}`);
      return false;
    }
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return true; // Ignore fetch abortions
    console.error("Critical Sync Failure:", err);
    return false;
  }
}

export async function removeFromCloud(tableName: string, id: string) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return true;
  try {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}

export async function pullFromCloud(tableName: string) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return [];
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`Fetch Error [${tableName}]:`, err);
    return [];
  }
}

export function subscribeToTable(tableName: string, onUpdate: (payload: any) => void) {
  if (!IS_CLOUD_ENABLED) return { unsubscribe: () => {} };
  return supabase
    .channel(`${tableName}-global-sync`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
      onUpdate(payload);
    })
    .subscribe();
}

/**
 * Checks if the Supabase connection is currently reachable
 */
export async function checkCloudHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.from('settings').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}
