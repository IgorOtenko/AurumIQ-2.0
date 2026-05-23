import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // Playwright specs live under tests/e2e and are run via `pnpm test:e2e`.
    // Excluding them keeps `pnpm test` (Vitest) focused on unit tests and
    // avoids the "Playwright Test did not expect test() to be called here"
    // error when Vitest's default glob picks up `*.spec.ts` files.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
