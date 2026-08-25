import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },

  resolve: {
    alias: {
      "@": "/src",
    },

    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  plugins: [
    tailwindcss(),

    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),

    tanstackStart({
      server: {
        entry: "server",
      },

      importProtection: {
        behavior: "error",

        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),

    netlify(),

    viteReact(),
  ].filter(Boolean),
});
