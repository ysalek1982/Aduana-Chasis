import { useEffect, useState } from "react";
import { Download, Share, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerPwa } from "@/lib/pwa-register";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaManager() {
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    void registerPwa({
      onOfflineReady: () => {
        toast.success("Aplicación lista para funcionar sin conexión.", {
          description: "El verificador ya está disponible desde este dispositivo.",
        });
      },
      onNeedRefresh: (updateSW) => {
        toast("Nueva versión disponible", {
          description: "Recargá para aplicar la actualización.",
          duration: Infinity,
          action: { label: "Actualizar", onClick: () => void updateSW() },
        });
      },
    });

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvt(event as BIPEvent);
      setShowPrompt(true);
    };
    const installedHandler = () => {
      setInstallEvt(null);
      setShowPrompt(false);
      toast.success("Aduana VIN fue instalada correctamente.");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const promptTimer = window.setTimeout(() => {
      if (!standalone) {
        setShowPrompt(true);
        if (ios) setShowIosHelp(true);
      }
    }, 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      window.clearTimeout(promptTimer);
    };
  }, []);

  if (!showPrompt && !showIosHelp) return null;

  return (
    <aside
      aria-label="Instalar aplicación Aduana VIN"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#071426]/95 text-white shadow-[0_24px_70px_rgba(2,8,23,.45)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[430px]"
    >
      <div className="h-1 bg-gradient-to-r from-[#d52b1e] via-[#f6c445] to-[#208750]" />
      <div className="flex gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
          {showIosHelp ? <Share className="h-5 w-5 text-[#f6c445]" /> : <Download className="h-5 w-5 text-[#f6c445]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold tracking-tight">Instalar Aduana VIN</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {showIosHelp
                  ? "En Safari, tocá Compartir y luego “Agregar a inicio”."
                  : "Acceso directo, pantalla completa y funciones esenciales disponibles sin conexión."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso de instalación"
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              onClick={() => {
                setShowPrompt(false);
                setShowIosHelp(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Aplicación verificada
            </span>
            {!showIosHelp && (
              <Button
                size="sm"
                className="bg-[#f6c445] font-semibold text-[#071426] hover:bg-[#ffd768]"
                onClick={async () => {
                  if (installEvt) {
                    await installEvt.prompt();
                    const result = await installEvt.userChoice;
                    setShowPrompt(false);
                    if (result.outcome === "accepted") setInstallEvt(null);
                    return;
                  }
                  toast.info("Instalá Aduana VIN desde el menú del navegador", {
                    description: "Elegí “Instalar aplicación” o “Agregar a la pantalla de inicio”.",
                  });
                }}
              >
                {installEvt ? "Instalar ahora" : "Cómo instalar"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
