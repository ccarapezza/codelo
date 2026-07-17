import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const dbIndexPath = fileURLToPath(new URL("../../packages/db/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@fulbo/db": path.resolve(dbIndexPath),
      // Match tsconfig.json `paths`: "@/*" maps to the app root, used by
      // shadcn/ui primitives (e.g. components/ui/*.tsx → "@/lib/utils").
      "@": appRoot,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
