import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      tailwindcss(),
      react(),
      nodePolyfills({
        include: ["buffer"],
        globals: {
          Buffer: true,
        },
      }),
      wasm(),
      VitePWA({
        registerType: "autoUpdate",
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          maximumFileSizeToCacheInBytes: 4194304, // 4MiB
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/horizon-testnet\.stellar\.org\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "stellar-horizon-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        manifest: {
          name: "Quipay",
          short_name: "Quipay",
          description: "Quipay - Stellar Payroll Automation",
          theme_color: "#ffffff",
          icons: [
            {
              src: "favicon.ico",
              sizes: "64x64 32x32 24x24 16x16",
              type: "image/x-icon",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@stellar/design-system": path.resolve(
          __dirname,
          "./src/lib/stellar-compat.tsx",
        ),
      },
    },
    optimizeDeps: {
      exclude: ["@stellar/stellar-xdr-json"],
      // Ensure React is pre-bundled first so TanStack Query v5 can safely
      // patch React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      include: ["react", "react-dom", "@tanstack/react-query"],
    },
    build: {
      target: "esnext",
      rollupOptions: {
        output: {
          // Put React in its own chunk so it always loads first
          manualChunks: (id) => {
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/")
            ) {
              return "react-vendor";
            }
            if (id.includes("node_modules/@tanstack/")) {
              return "query-vendor";
            }
          },
        },
      },
    },
    define: {
      global: "window",
    },
    envPrefix: ["PUBLIC_", "VITE_"],
    server: {
      headers: {
        // Dev-only CSP — relaxed to allow Vite HMR (inline scripts/styles,
        // WebSocket). Production keeps the strict policy in nginx.conf.
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          [
            "connect-src 'self'",
            "ws://localhost:*",
            "wss://localhost:*",
            "http://localhost:*",
            "https://horizon.stellar.org",
            "https://horizon-testnet.stellar.org",
            "https://soroban-testnet.stellar.org",
          ].join(" "),
          "img-src 'self' data: blob: https:",
          "worker-src 'self' blob:",
          "report-uri /csp-report",
        ].join("; "),
      },
      proxy: {
        "/friendbot": {
          target: "http://localhost:8000/friendbot",
          changeOrigin: true,
        },
      },
    },
  };
});
