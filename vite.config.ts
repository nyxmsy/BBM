import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(({ mode }) => {
  // Client bundle needs the Supabase URL + anon key inlined at build time.
  // Accept either the VITE_-prefixed names or the plain server-side names so
  // no shell interpolation is required in netlify.toml. The service-role key
  // is deliberately NOT inlined here — it stays server-side via process.env only.
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseClientDefine = {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? "",
    ),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
      env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? "",
    ),
  };

  return {
    define: supabaseClientDefine,

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
  };
});
