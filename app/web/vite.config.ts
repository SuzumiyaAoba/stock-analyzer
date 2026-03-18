import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [".output/**", "src/routeTree.gen.ts"],
  },
  lint: {
    ignorePatterns: [".output/**", "src/routeTree.gen.ts"],
  },
  server: {
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || "3001"),
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
    nitro(),
  ],
});
