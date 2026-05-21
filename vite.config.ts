import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",          // Docker 経由アクセスに必須
    port: 5173,
    strictPort: true,
    open: false,
    allowedHosts: true,       // Tailscale Funnel ホスト名を許可 (403 防止)
    hmr: process.env.VITE_HMR_HOST
      ? { protocol: "wss", host: process.env.VITE_HMR_HOST, clientPort: 443 }
      : false,                // Funnel 経由では HMR を無効化 (ERR_SSL_PROTOCOL_ERROR 防止)
  },
  optimizeDeps: {
    include: ["pdf-lib", "pdfjs-dist", "jszip"],
  },
  worker: {
    format: "es",
  },
});
