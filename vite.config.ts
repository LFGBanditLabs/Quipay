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
      },
    },
    optimizeDeps: {
      exclude: ["@stellar/stellar-xdr-json"],
    },
    build: {
      target: "esnext",
    },
    define: {
      global: "window",
    },
    envPrefix: ["PUBLIC_", "VITE_"],
    server: {
      headers: {
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; connect-src 'self' https://horizon.stellar.org; report-uri /csp-report",
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
