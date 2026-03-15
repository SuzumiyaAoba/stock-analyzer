import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: ["dist/**"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
