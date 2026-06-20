import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const alias = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
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
    },
  },
});
