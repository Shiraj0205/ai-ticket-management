import { createContext, useContext, type ReactNode } from "react";
import type { User } from "../types/index.js";
import { authClient } from "../lib/auth-client.js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  type SessionUser = NonNullable<typeof session>["user"] & { role?: string };
  const sessionUser = session?.user as SessionUser | undefined;

  const user: User | null = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: (sessionUser.role ?? "AGENT") as User["role"],
        createdAt:
          sessionUser.createdAt instanceof Date
            ? sessionUser.createdAt.toISOString()
            : String(sessionUser.createdAt),
      }
    : null;

  async function login(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message ?? "Login failed");
    }
  }

  async function logout() {
    await authClient.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading: isPending, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
