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
    ""
  );
}

function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (typeof import.meta !== "undefined" && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY) ||
    ""
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
