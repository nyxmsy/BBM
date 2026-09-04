import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SERVER-ONLY FILE. Never import this from client components.

const HARDCODED_FALLBACK_URL = "https://kwvsvxahejllixzwwxeb.supabase.co";

function normalizeEnvVar(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v : String(v);
  const t = s.trim();
  if (!t) return null;
  if (t === "undefined" || t === "null") return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (/^[\w.-]+\.[\w.-]+/.test(t)) return `https://${t}`;
  return null;
}

function rawReadEnv(name: string): string | null {
  try {
    const fromProcess = process.env[name];
    if (fromProcess != null) return fromProcess;
  } catch {
    /* process.env may throw in restricted environments */
  }
  try {
    if (
      typeof import.meta !== "undefined" &&
      (import.meta.env as Record<string, unknown>)?.[name]
    ) {
      return String((import.meta.env as Record<string, unknown>)[name]);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getSupabaseUrl(): string {
  const candidates = [rawReadEnv("SUPABASE_URL"), rawReadEnv("VITE_SUPABASE_URL")];
  for (const c of candidates) {
    const n = normalizeEnvVar(c);
    if (n) return n;
  }
  // Last-resort fallback so Netlify at least boots if env vars are missing.
  // This matches the Supabase project URL from .env.local — this value is NOT
  // a secret, it appears in every supabase.co call anyway.
  return HARDCODED_FALLBACK_URL;
}

function getSupabaseAnonKey(): string {
  const candidates = [rawReadEnv("SUPABASE_ANON_KEY"), rawReadEnv("VITE_SUPABASE_ANON_KEY")];
  for (const c of candidates) {
    if (c && c.length > 10) return c;
  }
  return "";
}

function getSupabaseServiceRoleKey(): string {
  const v = rawReadEnv("SUPABASE_SERVICE_ROLE_KEY");
  return v && v.length > 10 ? v : "";
}

/** Anonymous server-side client — for public reads (product catalog, checkout). */
export function getAnonServerClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey() || "invalid-missing-anon-key";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Builds a client authenticated as the calling user, so RLS policies apply.
 */
export function getUserScopedServerClient(accessToken: string | undefined | null): SupabaseClient {
  if (!accessToken) {
    throw new Error("Not authenticated.");
  }
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey() || "invalid-missing-anon-key";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
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
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client, or null when the key is not configured. */
export function tryGetServiceRoleClient(): SupabaseClient | null {
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey) return null;
  return createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
