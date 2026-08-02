import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Nitro genera Vercel Functions y el routing SSR esperado por Vercel.
  nitro: { preset: "vercel" },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        manifestFilename: "manifest.webmanifest",
        strategies: "generateSW",
        // Permite comprobar la instalación también al trabajar en localhost.
        devOptions: { enabled: true, type: "module" },
        includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png", "pwa-maskable-512.png"],
        manifest: false, // we ship public/manifest.webmanifest ourselves
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          runtimeCaching: [
            {
              // HTML navigations — always try network first
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-navigations",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Same-origin hashed built assets
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\/assets\/.+\.(?:js|css|woff2?)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Images (logos, icons)
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
