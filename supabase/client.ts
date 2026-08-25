import { createClient } from "@supabase/supabase-js";

// Public, browser-safe client. Uses the anon key, which is meant to be
// exposed — Row Level Security on every table is what actually protects
// the data, not this key being secret.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Set these in your Netlify environment (and .env.local for dev).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "bbm-auth",
  },
});
