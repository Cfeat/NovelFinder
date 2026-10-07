import vinext from "vinext";
import { defineConfig } from "vite";
import "./scripts/local-env.mjs";

export default defineConfig(async () => {
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "127.0.0.1",
      allowedHosts: ["localhost", "127.0.0.1"],
      ...(process.env.CODEX_SANDBOX === "seatbelt"
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          main: "./build/worker.ts",
          compatibility_flags: ["nodejs_compat"],
          d1_databases: [{
            binding: "DB",
            database_name: "novel-finder-local",
            // Local emulator placeholder; no cloud database is provisioned.
            database_id: "00000000-0000-4000-8000-000000000000",
          }],
        },
      }),
    ],
  };
});
