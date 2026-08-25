// Relative path: src/lib/auth.ts -> ../../supabase/client.ts
// Adjust the "../../" if your actual folder depth differs.
import { supabase } from "../../supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type { Session, User };

type UserRoleRow = { role: "admin" | "staff" };

// ============================================================================
// Real Supabase Auth. Replaces the old localStorage mock that accepted any
// email + 6-character password and never talked to a server.
//
// Session tokens are managed by the supabase-js client itself (persisted
// and auto-refreshed under the "bbm-auth" storage key set in
// "/supabase/client.ts"). Server functions that need to act as this user
// (admin catalog/order management) take the access token explicitly —
// call `auth.getSession()` and pass `session.access_token` in.
// ============================================================================

export const auth = {
  async getSession(): Promise<{ data: { session: Session | null } }> {
    const { data } = await supabase.auth.getSession();
    return { data };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: Error | null }> {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  },

  async signInWithPassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  },

  async signUp({
    email,
    password,
    options,
  }: {
    email: string;
    password: string;
    options?: { data?: { full_name?: string } };
  }): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: options?.data },
    });
    return { error };
  },

  async signOut(): Promise<{ error: Error | null }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * Real admin/staff check — replaces the old getMyAccess() that returned
   * { roles: ["admin"] } unconditionally for anyone. This reads the
   * user_roles table through RLS, so a plain customer session can only
   * ever see their own row (or none) — there's no client-side value to
   * tamper with to gain admin access, unlike the old mock.
   */
  async getMyRoles(): Promise<{ isAdmin: boolean; isStaff: boolean }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return { isAdmin: false, isStaff: false };

    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error || !data) return { isAdmin: false, isStaff: false };

    const roles = (data as UserRoleRow[]).map((r: UserRoleRow) => r.role);
    return {
      isAdmin: roles.includes("admin"),
      isStaff: roles.includes("admin") || roles.includes("staff"),
    };
  },
};
