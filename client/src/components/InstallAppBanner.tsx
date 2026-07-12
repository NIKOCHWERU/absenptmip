import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user dismissed previously in this session
      const dismissed = sessionStorage.getItem("pwa_install_dismissed");
      if (!dismissed) {
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // If app is already installed
    window.addEventListener("appinstalled", () => {
      setVisible(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:right-6 md:left-auto md:w-96 bg-primary border border-primary-foreground/10 rounded-3xl p-4 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300 text-primary-foreground">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white">Pasang Aplikasi</h4>
          <p className="text-[10px] text-white/80 leading-relaxed">
            Instal di Layar Utama HP untuk akses cepat & notifikasi.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInstall}
          className="py-2 px-4 rounded-xl bg-white text-primary text-xs font-semibold hover:bg-white/90 transition-colors shadow-sm"
        >
          Instal
        </button>
        <button
          onClick={handleDismiss}
          className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
