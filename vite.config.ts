import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hmrHost = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.VITE_HMR_HOST;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",          // Docker 経由アクセスに必須
    port: 5173,
    strictPort: true,
    open: false,
    allowedHosts: true,       // Tailscale Funnel ホスト名を許可 (403 防止)
    hmr: hmrHost
      ? { protocol: "wss", host: hmrHost, clientPort: 443 }
      : false,                // Funnel 経由では HMR を無効化 (ERR_SSL_PROTOCOL_ERROR 防止)
  },
  optimizeDeps: {
    include: ["pdf-lib", "pdfjs-dist", "jszip"],
  },
  worker: {
    format: "es",
  },
});
