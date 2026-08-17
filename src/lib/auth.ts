// Standalone Authentication & Session Management
// Ready to connect to your custom auth backend / database.

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
}

export interface Session {
  user: User;
  access_token: string;
}

const STORAGE_KEY = "bbm_auth_session";

function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function setStoredSession(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    void e;
  }
}

export const auth = {
  async getSession(): Promise<{ data: { session: Session | null } }> {
    const session = getStoredSession();
    return { data: { session } };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: Error | null }> {
    const session = getStoredSession();
    if (!session?.user) {
      return { data: { user: null }, error: new Error("Not authenticated") };
    }
    return { data: { user: session.user }, error: null };
  },

  async signInWithPassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ error: Error | null }> {
    if (!email || !password) {
      return { error: new Error("Email and password are required") };
    }
    if (password.length < 6) {
      return { error: new Error("Password must be at least 6 characters") };
    }

    const user: User = {
      id: "usr_" + Math.random().toString(36).slice(2, 10),
      email,
      user_metadata: {
        full_name: email.split("@")[0],
      },
    };
    const session: Session = {
      user,
      access_token: "token_" + Date.now().toString(36),
    };
    setStoredSession(session);
    return { error: null };
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
    if (!email || !password) {
      return { error: new Error("Email and password are required") };
    }
    if (password.length < 6) {
      return { error: new Error("Password must be at least 6 characters") };
    }

    const user: User = {
      id: "usr_" + Math.random().toString(36).slice(2, 10),
      email,
      user_metadata: {
        full_name: options?.data?.full_name || email.split("@")[0],
      },
    };
    const session: Session = {
      user,
      access_token: "token_" + Date.now().toString(36),
    };
    setStoredSession(session);
    return { error: null };
  },

  async signOut(): Promise<{ error: Error | null }> {
    setStoredSession(null);
    return { error: null };
  },
};
