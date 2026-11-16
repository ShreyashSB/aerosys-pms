import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * The free API host sleeps when idle and takes up to a minute to wake. This adds a tiny script to index.html that
 * pings /api/health the moment the page opens, before the app's code has downloaded, so the server is already waking
 * while the person types their password or the app loads. Only added when the app talks to the API.
 */
function wakeApi(apiBase: string): Plugin {
  return {
    name: "aerosys-wake-api",
    transformIndexHtml() {
      if (!apiBase) return [];
      return [
        { tag: "link", attrs: { rel: "preconnect", href: new URL(apiBase).origin, crossorigin: "" }, injectTo: "head" },
        {
          tag: "script",
          children: `try{fetch(${JSON.stringify(apiBase.replace(/\/$/, "") + "/api/health")},{mode:"no-cors",cache:"no-store"}).catch(function(){})}catch(e){}`,
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), wakeApi(env.VITE_API_BASE_URL ?? "")],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
  };
});
