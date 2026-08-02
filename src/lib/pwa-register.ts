// Guarded PWA service worker registration wrapper.
// Refuses to register in dev, iframes, Lovable preview hosts, or with ?sw=off.
// Uses virtual:pwa-register from vite-plugin-pwa (generateSW).

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!import.meta.env.PROD && !isLocal) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL;
      if (scriptURL && new URL(scriptURL).pathname === SW_URL) {
        await r.unregister();
      }
    }
  } catch {
    /* noop */
  }
}

export type PwaCallbacks = {
  onNeedRefresh?: (updateSW: () => Promise<void>) => void;
  onOfflineReady?: () => void;
};

export async function registerPwa(cb: PwaCallbacks = {}) {
  if (isRefusedContext()) {
    await unregisterMatching();
    return;
  }
  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      cb.onNeedRefresh?.(() => updateSW(true));
    },
    onOfflineReady() {
      cb.onOfflineReady?.();
    },
  });
}
