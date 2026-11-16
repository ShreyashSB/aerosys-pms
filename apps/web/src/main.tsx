import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthContext";
import { AppearanceProvider, useAppearance } from "@/appearance/AppearanceContext";
import { App } from "./App";
import { ServerWakeNotice } from "@/components/common/ServerWakeNotice";
import { AppErrorBoundary, reloadForUpdate } from "@/components/common/ErrorBoundary";
import "./index.css";

/** Toasts follow the app theme (sunlight counts as light). */
function ThemedToaster() {
  const { resolvedTheme } = useAppearance();
  return <Toaster position="top-right" richColors closeButton theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}

// A page's shared code was replaced by a new deploy while this tab was open: reload once to get the new version.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForUpdate()) event.preventDefault();
});

// Lists stay fresh for 2 minutes, so moving between pages doesn't re-download all of them in the background each time.
// Saves still refresh what they change straight away, and notifications poll on their own.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppearanceProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
            <ThemedToaster />
            <ServerWakeNotice />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppearanceProvider>
  </StrictMode>,
);
