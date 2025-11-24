import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // Global setup for integration tests (starts SQL Server container)
    globalSetup: ["./tests/setup/global-setup.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "tests/**"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },

    // Integration tests need more time for container startup and database operations
    testTimeout: 30000,   // 30 seconds
    hookTimeout: 30000,   // 30 seconds for beforeAll/afterAll
  },
});
