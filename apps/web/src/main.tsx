import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthContext";
import { AppearanceProvider, useAppearance } from "@/appearance/AppearanceContext";
import { App } from "./App";
import "./index.css";

/** Toasts follow the app theme (sunlight counts as light). */
function ThemedToaster() {
  const { resolvedTheme } = useAppearance();
  return <Toaster position="top-right" richColors closeButton theme={resolvedTheme === "dark" ? "dark" : "light"} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppearanceProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ThemedToaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppearanceProvider>
  </StrictMode>,
);
