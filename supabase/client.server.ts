import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY FILE. Never import this from client components.

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    "https://kwvsvxahejllixzwwxeb.supabase.co"
  );
}

function getSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dnN2eGFoZWpsbGl4end3eGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTg5NDcsImV4cCI6MjEwMjYzNDk0N30.WE8SKkt_N9zitONtxqO-lvMsfiTPDbZrW1VAageO5Wc"
  );
}

function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (typeof import.meta !== "undefined" && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dnN2eGFoZWpsbGl4end3eGViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzA1ODk0NywiZXhwIjoyMTAyNjM0OTQ3fQ.OqRMgRXX5zCsYlTVsmTR2ZtYYrpei-4Tu7STpmmhZ9k"
  );
}

/** Anonymous server-side client — for public reads (product catalog, checkout). */
export function getAnonServerClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

/**
 * Builds a client authenticated as the calling user, so RLS policies apply.
 */
export function getUserScopedServerClient(accessToken: string | undefined | null): SupabaseClient {
  if (!accessToken) {
    throw new Error("Not authenticated.");
  }
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/** Service-role client for privileged operations. */
export function getServiceRoleClient(): SupabaseClient {
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY server env var.");
  }
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false },
  });
}
