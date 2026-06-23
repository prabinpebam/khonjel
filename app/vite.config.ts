import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Strict Content-Security-Policy for the packaged (file://) renderer. Injected only into the
// production build so Vite's dev server (HMR + React Fast Refresh, which need eval/ws) is untouched.
// script-src 'self' blocks inline/remote script — the backstop that contains any XSS from the
// untrusted text the renderer shows (transcripts, notes, LLM output) before it can reach the IPC
// bridge. See docs/archive/security-privacy-hardening-plan.md (WS-A).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join("; ");

function cspMetaPlugin() {
  return {
    name: "khonjel-csp-meta",
    transformIndexHtml: {
      order: "pre" as const,
      handler(html: string, ctx: { server?: unknown }) {
        if (ctx.server) return html; // dev server: skip so HMR/Fast Refresh keep working
        return html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        );
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cspMetaPlugin()],
  // No inline module-preload polyfill, so the production build emits no inline <script> and a strict
  // `script-src 'self'` does not break loading the bundle.
  build: {
    modulePreload: { polyfill: false },
  },
  resolve: {
    alias: {
      "@": alias("./src"),
      "@app": alias("./src/app"),
      "@surfaces": alias("./src/surfaces"),
      "@features": alias("./src/features"),
      "@components": alias("./src/components"),
      "@services": alias("./src/services"),
      "@stores": alias("./src/stores"),
      "@mock": alias("./src/mock"),
      "@config": alias("./src/config"),
      "@hooks": alias("./src/hooks"),
      "@lib": alias("./src/lib"),
      "@styles": alias("./src/styles"),
      "@types": alias("./src/types"),
      "@ipc": alias("./electron/shared"),
    },
  },
});
