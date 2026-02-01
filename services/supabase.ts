
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  return (import.meta as any).env?.[key] || (process as any).env?.[key] || '';
};

// Default public sandbox for immediate 'Live' experience if keys are missing
const DEFAULT_URL = 'https://fejxskvsjfwjqmiobtpp.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlanhza3Zzamp3anFtaW9idHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY0NTAwMDAsImV4cCI6MjAyMjA0NjQwMH0.DUMMY_SIGNATURE';

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || DEFAULT_URL;
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

// Check if we are using actual production keys or the fallback
export const IS_CLOUD_ENABLED = SUPABASE_ANON_KEY !== FALLBACK_KEY && SUPABASE_ANON_KEY.length > 50;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function pushToCloud(tableName: string, data: any) {
  if (!IS_CLOUD_ENABLED || !navigator.onLine) return true;
  try {
    if (!data) return true;
    const payload = Array.isArray(data) ? data : [data];
    if (payload.length === 0) return true;
    const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
    return !error;
  } catch (err) {
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
    return [];
  }
}

export function subscribeToTable(tableName: string, onUpdate: (payload: any) => void) {
  if (!IS_CLOUD_ENABLED) return { unsubscribe: () => {} };
  return supabase
    .channel(`${tableName}-live-sync`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, onUpdate)
    .subscribe();
}
