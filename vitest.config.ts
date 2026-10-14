import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/app/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Test files share database roles (account_app), so they run one after another.
    fileParallelism: false,
  },
});
