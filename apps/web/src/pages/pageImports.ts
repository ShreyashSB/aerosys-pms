/**
 * Pages are split into separate files that load on first visit. Each one is listed here once, so the same import can
 * be used both for the lazy page and for preloading it in the background (see preloadPages).
 */
export const pageImports = {
  login: () => import("@/pages/LoginPage"),
  dashboard: () => import("@/pages/DashboardPage"),
  projects: () => import("@/pages/ProjectsPage"),
  projectDetail: () => import("@/pages/ProjectDetailPage"),
  engineers: () => import("@/pages/EngineersPage"),
  engineerDetail: () => import("@/pages/EngineerDetailPage"),
  expenses: () => import("@/pages/ExpensesPage"),
  instruments: () => import("@/pages/InstrumentsPage"),
  employees: () => import("@/pages/EmployeesPage"),
  reports: () => import("@/pages/ReportsPage"),
  history: () => import("@/pages/HistoryPage"),
  settings: () => import("@/pages/SettingsPage"),
};
/**
 * Once the app is idle after signing in, fetch every page's code in the background, one after another, so the first
 * click on a module opens it straight away instead of waiting for its file to download. Failures are ignored: the
 * page simply loads on demand as before.
 */
let preloaded = false;
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  const run = async () => {
    for (const load of Object.values(pageImports)) {
      try {
        await load();
      } catch {
        // Offline or a deploy changed the file names: the page will load normally when opened.
      }
    }
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idle) idle(() => void run());
  else setTimeout(() => void run(), 1500);
}
