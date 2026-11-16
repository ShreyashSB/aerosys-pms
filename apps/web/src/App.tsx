import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/auth/AuthContext";
import { PageSkeleton } from "@/components/common/States";
import type { Permission } from "@/auth/permissions";
import { pageImports } from "@/pages/pageImports";
const LoginPage = lazy(() => pageImports.login().then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => pageImports.dashboard().then((m) => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => pageImports.projects().then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => pageImports.projectDetail().then((m) => ({ default: m.ProjectDetailPage })));
const EngineersPage = lazy(() => pageImports.engineers().then((m) => ({ default: m.EngineersPage })));
const EngineerDetailPage = lazy(() => pageImports.engineerDetail().then((m) => ({ default: m.EngineerDetailPage })));
const ExpensesPage = lazy(() => pageImports.expenses().then((m) => ({ default: m.ExpensesPage })));
const InstrumentsPage = lazy(() => pageImports.instruments().then((m) => ({ default: m.InstrumentsPage })));
const EmployeesPage = lazy(() => pageImports.employees().then((m) => ({ default: m.EmployeesPage })));
const ReportsPage = lazy(() => pageImports.reports().then((m) => ({ default: m.ReportsPage })));
const HistoryPage = lazy(() => pageImports.history().then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => pageImports.settings().then((m) => ({ default: m.SettingsPage })));

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
          <Route path="history" element={<Guard permission="history.view"><HistoryPage /></Guard>} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
