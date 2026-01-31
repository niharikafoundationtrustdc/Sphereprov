
import { createClient } from '@supabase/supabase-js';

// Vercel/Vite environment variables
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://fejxskvsjfwjqmiobtpp.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2uT90ihz2_hKT4ax30ysbA_hZZBiX9P';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper to sync local table data to Supabase.
 */
export async function pushToCloud(tableName: string, data: any) {
  try {
    if (!data) return true;
    const payload = Array.isArray(data) ? data : [data];
    if (payload.length === 0) return true;

    const { error } = await supabase
      .from(tableName)
      .upsert(payload, { onConflict: 'id' });
    
    if (error) {
      console.error(`[Supabase Sync Error] ${tableName}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Cloud Connection Failed] ${tableName}:`, err);
    return false;
  }
}

/**
 * Fetches all records from a Supabase table.
 */
export async function pullFromCloud(tableName: string) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error(`[Cloud Pull Failed] ${tableName}:`, err);
    return [];
  }
}
