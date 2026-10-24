import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/auth/AuthContext";
import { PageSkeleton } from "@/components/common/States";
import type { Permission } from "@/auth/permissions";
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage").then((m) => ({ default: m.ProjectDetailPage })));
const EngineersPage = lazy(() => import("@/pages/EngineersPage").then((m) => ({ default: m.EngineersPage })));
const EngineerDetailPage = lazy(() => import("@/pages/EngineerDetailPage").then((m) => ({ default: m.EngineerDetailPage })));
const ExpensesPage = lazy(() => import("@/pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage })));
const InstrumentsPage = lazy(() => import("@/pages/InstrumentsPage").then((m) => ({ default: m.InstrumentsPage })));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage })));
const ReportsPage = lazy(() => import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
import { ForbiddenPage, NotFoundPage } from "@/pages/StatusPages";

function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <ForbiddenPage />;
}

export function App() {
  return (
    <Suspense fallback={<div className="p-8"><PageSkeleton /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="engineers" element={<Guard permission="engineer.view"><EngineersPage /></Guard>} />
          <Route path="engineers/:id" element={<Guard permission="engineer.view"><EngineerDetailPage /></Guard>} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="instruments" element={<Guard permission="instrument.view"><InstrumentsPage /></Guard>} />
          <Route path="employees" element={<Guard permission="employee.view"><EmployeesPage /></Guard>} />
          <Route path="reports" element={<Guard permission="report.view"><ReportsPage /></Guard>} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
