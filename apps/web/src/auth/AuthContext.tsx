import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { can, type Permission } from "./permissions";
import type { Employee, Role, User } from "@/types/models";
import { authToken, http, setUnauthorizedHandler, USE_API } from "@/api/http";
import { qk } from "@/hooks/queries";
import { employeeService } from "@/services";

const SESSION_KEY = "aerosys.session.userId";

/** What GET /api/auth/me and POST /api/auth/login return for the signed-in person. */
interface Me extends User {
  name: string;
  mustChangePassword: boolean;
}

interface AuthState {
  user: User | null;
  employee: Employee | null;
  users: User[];
  loading: boolean;
  /** Live database: a new or reset login must pick its own password before anything else. */
  mustChangePassword: boolean;
  /** Live database: checks the email and password with the server. */
  signIn: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Demo data: signs in as any demo user, no password needed. */
  login: (userId: string) => void;
  logout: () => void;
  /** Demo role switcher – signs in as the first user of that role. */
  switchRole: (role: Role) => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return USE_API ? <ApiAuthProvider>{children}</ApiAuthProvider> : <DemoAuthProvider>{children}</DemoAuthProvider>;
}

/**
 * Live database. The token from POST /api/auth/login is kept in localStorage
 * and sent with every request; GET /api/auth/me says whose it is. A 401 from
 * any request (expired token, login switched off) signs the person out.
 */
function ApiAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(authToken.get);

  const me = useQuery({
    queryKey: ["me", token],
    queryFn: () => http.get<Me>("/api/auth/me"),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
  const ready = !!me.data && !me.data.mustChangePassword;
  // Everyone else's data is only readable once signed in with a password of their own.
  const users = useQuery({ queryKey: qk.users, queryFn: employeeService.listUsers, enabled: ready });
  const employees = useQuery({ queryKey: qk.employees, queryFn: employeeService.list, enabled: ready });

  const logout = useCallback(() => {
    authToken.set(null);
    setToken(null);
    // Drop everything cached for this person, so the next one starts clean.
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(() => {});
  }, [logout]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await http.post<{ token: string; user: Me }>("/api/auth/login", { email, password });
      authToken.set(res.token);
      qc.setQueryData(["me", res.token], res.user);
      setToken(res.token);
    },
    [qc],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const updated = await http.post<Me>("/api/auth/change-password", { currentPassword, newPassword });
      qc.setQueryData(["me", token], updated);
    },
    [qc, token],
  );

  const user: User | null = me.data ? { id: me.data.id, employeeId: me.data.employeeId, role: me.data.role, email: me.data.email } : null;
  const employee = user ? (employees.data?.find((e) => e.id === user.employeeId) ?? null) : null;

  const value: AuthState = {
    user,
    employee,
    users: (users.data ?? []).filter((u) => u.active !== false),
    loading: (!!token && me.isLoading) || (ready && (users.isLoading || employees.isLoading)),
    mustChangePassword: !!me.data?.mustChangePassword,
    signIn,
    changePassword,
    login: () => {},
    logout,
    switchRole: () => {},
    can: (p) => (user ? can(user.role, p) : false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** In-browser demo data: pick any demo user, no password. */
function DemoAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: users = [], isLoading: usersLoading } = useQuery({ queryKey: qk.users, queryFn: employeeService.listUsers });
  const { data: employees = [], isLoading: empLoading } = useQuery({ queryKey: qk.employees, queryFn: employeeService.list });
  const [userId, setUserId] = useState<string | null>(readSession);

  const user = users.find((u) => u.id === userId) ?? null;
  const employee = user ? (employees.find((e) => e.id === user.employeeId) ?? null) : null;

  const login = useCallback(
    (id: string) => {
      localStorage.setItem(SESSION_KEY, id);
      setUserId(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    [qc],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUserId(null);
  }, []);

  const switchRole = useCallback(
    (role: Role) => {
      const target = users.find((u) => u.role === role);
      if (target) login(target.id);
    },
    [users, login],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      employee,
      users,
      loading: usersLoading || empLoading,
      mustChangePassword: false,
      signIn: async () => {},
      changePassword: async () => {},
      login,
      logout,
      switchRole,
      can: (p) => (user ? can(user.role, p) : false),
    }),
    [user, employee, users, usersLoading, empLoading, login, logout, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** For components rendered only inside the authenticated shell. */
export function useCurrentUser() {
  const { user, employee } = useAuth();
  if (!user || !employee) throw new Error("No authenticated user");
  return { user, employee };
}
