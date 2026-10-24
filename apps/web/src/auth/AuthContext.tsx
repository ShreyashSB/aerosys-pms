import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { can, type Permission } from "./permissions";
import type { Employee, Role, User } from "@/types/models";
import { useEmployees, useUsers } from "@/hooks/queries";

const SESSION_KEY = "aerosys.session.userId";

interface AuthState {
  user: User | null;
  employee: Employee | null;
  users: User[];
  loading: boolean;
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
  const qc = useQueryClient();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: employees = [], isLoading: empLoading } = useEmployees();
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
