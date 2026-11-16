import { Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { notificationService } from "@/services";
import { useQueryClient } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/common/States";
import { useAppearance } from "@/appearance/AppearanceContext";
import { BottomNav } from "./BottomNav";
import { CalmHeader } from "./CalmHeader";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Topbar } from "./Topbar";
import { FirstPasswordScreen } from "@/features/auth/FirstPasswordScreen";
import { preloadPages } from "@/pages/pageImports";
import { AppErrorBoundary } from "@/components/common/ErrorBoundary";

const COLLAPSE_KEY = "aerosys.sidebar.collapsed";

export function AppShell() {
  const { user, employee, loading, mustChangePassword } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedView: view, style } = useAppearance();
  // Calm style has its own pill header on laptops, so the sidebar, top bar and top menu are for phones only there.
  const calm = style === "calm";

  // After sign-in, download the other pages' code in the background so first visits open instantly.
  useEffect(() => {
    if (user) preloadPages();
  }, [user]);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Simulated scheduled job: deadline / completion alerts.
  useEffect(() => {
    notificationService.runScheduledChecks().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [qc]);

  if (mustChangePassword) return <FirstPasswordScreen />;
  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton />
      </div>
    );
  }
  if (!user || !employee) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div data-slot="shell" className="flex min-h-screen">
      {/* The sidebar is always available as the phone slide-out menu; "Top bar" view hides it on laptops. */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        hideOnDesktop={view === "topnav" || calm}
      />
      <div data-slot="canvas" className="flex min-w-0 flex-1 flex-col">
        {calm && <CalmHeader />}
        <Topbar onOpenMobile={() => setMobileOpen(true)} view={view} />
        {view === "topnav" && !calm && <TopNav />}
        <main data-ground className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
          {/* Keyed by page: React Router switches pages inside a transition, which keeps the old page on screen while
              the new one's code downloads and makes the app look stuck. A fresh boundary per page shows the loading
              skeleton straight away instead. The error boundary is keyed too, so moving to another page clears an error. */}
          <AppErrorBoundary key={location.pathname} compact>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </AppErrorBoundary>
        </main>
      </div>
      {view === "field" && <BottomNav onOpenMore={() => setMobileOpen(true)} />}
    </div>
  );
}
