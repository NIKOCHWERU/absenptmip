import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth.js";
import { useToast } from "../hooks/use-toast.js";
import { User, ArrowRight, Download, Share, X, Check, ChevronRight, Smartphone, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// Detect iOS
function isIos(): boolean {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

// Detect Android
function isAndroid(): boolean {
  return /android/.test(window.navigator.userAgent.toLowerCase());
}

export default function LoginPage() {
  const { loginMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const hasDismissed = localStorage.getItem("installPromptDismissed2");

    if (!isStandalone && !hasDismissed) {
      // Small delay so page loads first
      setTimeout(() => setShowInstallPopup(true), 800);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setShowInstallPopup(false);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShowInstallPopup(false);
      }
      setDeferredPrompt(null);
    } else {
      toast({
        title: "Instalasi Manual",
        description: "Browser Anda tidak mendukung instalasi otomatis. Silakan ketuk ikon Menu (⋮) di pojok kanan atas lalu pilih 'Tambahkan ke Layar Utama'.",
        variant: "default",
      });
    }
  };

  const handleDismissInstall = () => {
    localStorage.setItem("installPromptDismissed2", "true");
    setShowInstallPopup(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        title: "Peringatan",
        description: "NIK wajib diisi",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate(
      { username: username.trim(), password: "bypassed-for-employee" },
      {
        onError: (err: any) => {
          toast({
            title: "Gagal Masuk",
            description: err.message || "Pastikan NIK yang Anda masukkan terdaftar.",
            variant: "destructive",
          });
        },
        onSuccess: async (data) => {
          if (data.role !== "employee") {
            toast({
              title: "Akses Dialihkan",
              description: "Admin mendeteksi login. Silakan masuk melalui Portal Admin.",
              variant: "destructive",
            });
            fetch("/api/logout", { method: "POST" }).then(() => {
              setLocation("/admin/login");
            });
            return;
          }
          toast({
            title: "Berhasil Masuk",
            description: "Selamat datang kembali di Portal PT ABC.",
            variant: "success",
          });
        },
      }
    );
  };

  const { data: config } = useQuery<any>({
    queryKey: ["/api/config"],
  });

  const singkatanPt = config?.singkatanPt || config?.namaPt || import.meta.env.VITE_SINGKATAN_PT || import.meta.env.VITE_NAMA_PT || "PT MIP";
  const logoUrl = config?.logoUrl || import.meta.env.VITE_LOGO_FILE || "/logo_elok_buah.jpg";
  const logoInisial = config?.logoInisial || import.meta.env.VITE_LOGO_INISIAL || singkatanPt.charAt(0);

  const isIosDevice = isIos();
  const isAndroidDevice = isAndroid();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] aspect-square rounded-full bg-orange-100/30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] aspect-square rounded-full bg-orange-100/20 blur-3xl" />

      <div className="w-full max-w-md bg-white border border-orange-100/50 rounded-[2.5rem] shadow-2xl p-8 md:p-10 relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          {logoUrl && logoUrl !== "/logo_elok_buah.jpg" ? (
             <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-orange-500/10 mb-4 border border-orange-100 p-2">
               <img src={logoUrl} alt="Logo PT" className="w-full h-full object-contain" />
             </div>
          ) : (
             <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4 text-3xl font-bold uppercase">
               {logoInisial}
             </div>
          )}
          <h1 className="font-heading font-black text-2xl text-slate-800 tracking-tight uppercase">Absensi {singkatanPt}</h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase">Sistem manajemen absensi tenaga kerja</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nomor Induk Tenaga Kerja (NIK)</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan NIK Anda"
                className="w-full pl-11 pr-4 py-3.5 text-sm bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-orange-500/25 hover:bg-primary/95 transition-all duration-300 disabled:opacity-50 mt-2"
          >
            {loginMutation.isPending ? "Memverifikasi..." : "Masuk Sekarang"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <span className="text-slate-400">Belum memiliki akun? </span>
          <a href="/employee/signup" className="text-primary font-bold hover:underline">
            Daftar Sekarang
          </a>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100/80 text-center">
          <button 
            type="button"
            onClick={() => setShowInstallPopup(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Install Aplikasi ke HP
          </button>
        </div>
      </div>

      {/* ===================== INSTALL POPUP ===================== */}
      {showInstallPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            style={{ animation: "slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}
          >
            {/* Header bar */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 pt-8 pb-8 px-6 relative flex flex-col items-center justify-center">
              <button
                onClick={handleDismissInstall}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {/* App icon */}
              <div className="w-20 h-20 rounded-[1.25rem] bg-white flex items-center justify-center shadow-xl shadow-black/20 mb-4 mt-2">
                {logoUrl && logoUrl !== "/logo_elok_buah.jpg" ? (
                  <img src={logoUrl} alt="App Icon" className="w-14 h-14 object-contain" />
                ) : (
                  <span className="text-3xl font-black text-blue-700 uppercase">{logoInisial}</span>
                )}
              </div>
              
              <div className="text-center text-white">
                <p className="font-black text-2xl leading-tight">Absensi {singkatanPt}</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6">

              {/* Android: show Install button */}
              {(isAndroidDevice || deferredPrompt) && (
                <>
                  <button
                    onClick={handleInstall}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base shadow-lg shadow-blue-500/30 transition-all bg-gradient-to-r from-blue-600 to-blue-800"
                  >
                    <Download className="w-5 h-5" />
                    Pasang Aplikasi
                  </button>
                  {!deferredPrompt && (
                    <p className="text-center text-xs text-slate-400 mt-2">Ketuk ⋮ → "Tambahkan ke Layar Utama"</p>
                  )}
                </>
              )}

              {/* iOS: Show Share instructions */}
              {isIosDevice && !isAndroidDevice && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700 text-center">Cara Install di iPhone / iPad</p>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    {[
                      {
                        icon: <Share className="w-4 h-4 text-blue-500" />,
                        step: "1",
                        text: "Ketuk ikon Share (kotak panah atas) di Safari"
                      },
                      {
                        icon: <Plus className="w-4 h-4 text-blue-500" />,
                        step: "2",
                        text: "Pilih \"Add to Home Screen\" (Tambahkan ke Layar Utama)"
                      },
                      {
                        icon: <Smartphone className="w-4 h-4 text-blue-500" />,
                        step: "3",
                        text: "Ketuk \"Add\" — aplikasi langsung terpasang!"
                      },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          {item.icon}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed flex-1 pt-1">{item.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                    <span>⚠️ Harus menggunakan Safari (bukan Chrome/Firefox)</span>
                  </div>
                </div>
              )}

              {/* Non-mobile fallback */}
              {!isIosDevice && !isAndroidDevice && !deferredPrompt && (
                <div className="bg-slate-50 rounded-2xl p-4 text-center">
                  <Smartphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Buka di <strong>Chrome Android</strong> atau <strong>Safari iOS</strong> untuk install sebagai aplikasi.</p>
                </div>
              )}

              <button
                onClick={handleDismissInstall}
                className="w-full mt-3 py-3 rounded-2xl text-slate-500 font-semibold text-sm hover:bg-slate-100 transition-colors"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(60px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
      `}</style>
    </div>
  );
}

