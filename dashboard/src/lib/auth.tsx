import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, type User } from "./api.js";

interface AuthState {
  user: User | null;
  loading: boolean;
  setupNeeded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (token: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
      setSetupNeeded(false);
    } catch (err) {
      setUser(null);
      // el 401 del primer arranque trae la pista de que todavía no hay ningún usuario
      if (err instanceof ApiError && err.status === 401) {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const body = await res.json().catch(() => ({}));
        setSetupNeeded(body.setupNeeded === true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setupNeeded,
      signIn: async (email, password) => {
        setUser(await api.login(email, password));
        setSetupNeeded(false);
      },
      signUp: async (token, email, password) => {
        setUser(await api.setup(token, email, password));
        setSetupNeeded(false);
      },
      signOut: async () => {
        await api.logout();
        setUser(null);
      },
    }),
    [user, loading, setupNeeded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) {
    throw new Error("useAuth necesita estar dentro de AuthProvider");
  }
  return state;
}
