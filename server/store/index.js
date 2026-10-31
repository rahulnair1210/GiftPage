import { createLocalStore } from './local.js';
import { createSupabaseStore } from './supabase.js';

let cached;
/** Supabase when SUPABASE_URL is set, otherwise the local file store. */
export async function getStore(cfg) {
  if (!cached) {
    cached = cfg.supabase.url && cfg.supabase.serviceKey ? createSupabaseStore(cfg) : Promise.resolve(createLocalStore(cfg));
    cached.catch(() => { cached = null; }); // don't remember a failed connection: retry on the next request
  }
  return cached;
}
