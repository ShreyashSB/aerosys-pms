import { Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { notificationService } from "@/services";
import { useQueryClient } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/common/States";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "aerosys.sidebar.collapsed";

export function AppShell() {
  const { user, employee, loading } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Simulated scheduled job: deadline / completion alerts.
  useEffect(() => {
    notificationService.runScheduledChecks().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [qc]);

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton />
      </div>
    );
  }
  if (!user || !employee) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
