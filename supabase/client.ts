import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
    const fromProcess = (globalThis as unknown as { process?: { env?: Record<string, string> } })
      .process?.env?.[name];
    if (fromProcess != null) return fromProcess;
  } catch {
    /* ignore */
  }
  try {
    if (typeof import.meta !== "undefined" && (import.meta.env as Record<string, unknown>)?.[name]) {
      return String((import.meta.env as Record<string, unknown>)[name]);
    }
  } catch {
    /* ignore */
  }
  return null;
}

function getSupabaseUrl(): string | null {
  const candidates = [
    rawReadEnv("SUPABASE_URL"),
    rawReadEnv("VITE_SUPABASE_URL"),
  ];
  for (const c of candidates) {
    const n = normalizeEnvVar(c);
    if (n) return n;
  }
  return null;
}

function getSupabaseAnonKey(): string | null {
  const candidates = [
    rawReadEnv("SUPABASE_ANON_KEY"),
    rawReadEnv("VITE_SUPABASE_ANON_KEY"),
  ];
  for (const c of candidates) {
    if (c && c.length > 10) return c;
  }
  return null;
}

let _instance: SupabaseClient | null = null;
let _initError: Error | null = null;

function initClient(): SupabaseClient {
  if (_instance) return _instance;
  if (_initError) throw _initError;

  const rawUrl = rawReadEnv("VITE_SUPABASE_URL") ?? rawReadEnv("SUPABASE_URL");
  const rawAnon = rawReadEnv("VITE_SUPABASE_ANON_KEY") ?? rawReadEnv("SUPABASE_ANON_KEY");

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    const where = typeof window !== "undefined" ? "browser" : "server";
    const msg =
      `[bbm:${where}] Missing or invalid Supabase config. ` +
      `VITE_SUPABASE_URL must be a valid https:// URL (got: ${String(rawUrl)}), ` +
      `and VITE_SUPABASE_ANON_KEY must be set (length ok: ${!!supabaseAnonKey}). ` +
      `Set these in Netlify Site → Environment variables (and .env.local for dev).`;
    _initError = new Error(msg);
    throw _initError;
  }

  _instance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: true,
      storageKey: "bbm-auth",
    },
  });
  return _instance;
}

export function getSupabase(): SupabaseClient {
  return initClient();
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = initClient();
    return Reflect.get(client, prop, receiver);
  },
  apply(_target, thisArg, args) {
    const client = initClient();
    return Reflect.apply(client as unknown as (...a: unknown[]) => unknown, thisArg, args);
  },
}) as unknown as SupabaseClient;
