import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  publicDir: "../public",
  clearScreen: false,
  server: {
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
