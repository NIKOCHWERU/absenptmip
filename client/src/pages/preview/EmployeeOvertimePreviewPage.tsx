import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Upload, FileText, Camera, CheckCircle2, Play, ShieldAlert, ArrowLeft, LogOut, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function EmployeeOvertimePreviewPage() {
  const { toast } = useToast();

  // Shift & User Info Example from Screenshot
  const shiftName = "TIM STAMPING SHIFT 1";
  const shiftStart = "08:00";
  const shiftEnd = "17:00";
  const employeeName = "DENI";
  const nik = "3215180601940004";
  const cabang = "PT. AKINAWA";
  const jabatan = "OPERATOR STAMPING";

  // Attendance State
  const [hasCheckedIn, setHasCheckedIn] = useState(false); // Mode awal: BELUM ABSEN MASUK
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [regularCheckoutTime, setRegularCheckoutTime] = useState<string | null>(null);

  // Overtime State
  const [isOvertimeActive, setIsOvertimeActive] = useState(false);
  const [isOvertimeCompleted, setIsOvertimeCompleted] = useState(false);
  const [overtimeStartTime, setOvertimeStartTime] = useState<string | null>(null);
  const [overtimeEndTime, setOvertimeEndTime] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Alert Dialog Confirmation State
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  // Modal State - Start Overtime
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [splFile, setSplFile] = useState<File | null>(null);
  const [splPreview, setSplPreview] = useState<string | null>(null);
  const [initialProofFile, setInitialProofFile] = useState<File | null>(null);
  const [initialProofPreview, setInitialProofPreview] = useState<string | null>(null);
  const [startDescription, setStartDescription] = useState("");

  // Modal State - End Overtime
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [finalProofFile, setFinalProofFile] = useState<File | null>(null);
  const [finalProofPreview, setFinalProofPreview] = useState<string | null>(null);
  const [finalDescription, setFinalDescription] = useState("");

  // Digital Clock Simulation
  const [currentTimeStr, setCurrentTimeStr] = useState("10:35:14");
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Overtime Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isOvertimeActive && !isOvertimeCompleted) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isOvertimeActive, isOvertimeCompleted]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Step 1: User Action -> Absen Masuk
  const handleCheckIn = () => {
    setHasCheckedIn(true);
    toast({
      title: "Absen Masuk Berhasil",
      description: `Jam Masuk: 07:44 WIB (${shiftName})`,
    });
  };

  // Step 2: User Action -> Absen Pulang
  const handleCheckOut = () => {
    setIsCheckedOut(true);
    setRegularCheckoutTime(shiftEnd);
    toast({
      title: "Absen Pulang Berhasil",
      description: `Jam Pulang dicatat: ${shiftEnd} WIB`,
    });
  };

  // Step 3: Click Overtime Button -> Trigger Confirmation Alert First
  const handleOvertimeButtonClick = () => {
    setIsAlertOpen(true);
  };

  // Step 4: Confirm Alert -> Open Overtime Upload Form Modal
  const handleConfirmAlert = () => {
    setIsAlertOpen(false);

    // Rule: Jika langsung tekan lembur tanpa absen pulang dulu, otomatis catat absen pulang di jam 17:00 (shiftEnd)
    if (!isCheckedOut) {
      setIsCheckedOut(true);
      setRegularCheckoutTime(shiftEnd);
      toast({
        title: "Absen Pulang Otomatis",
        description: `Absen reguler otomatis dicatat tepat jam ${shiftEnd} WIB karena memulai lembur.`,
      });
    }

    setIsStartModalOpen(true);
  };

  // Step 5: Submit Start Overtime Modal
  const handleConfirmStartOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!splFile || !initialProofFile || !startDescription.trim()) {
      toast({
        title: "Dokumen Belum Lengkap",
        description: "Wajib unggah Surat Perintah Lembur (SPL), Foto Bukti Awal, dan Deskripsi Pekerjaan.",
        variant: "destructive",
      });
      return;
    }

    const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    setOvertimeStartTime(nowStr);
    setIsOvertimeActive(true);
    setIsStartModalOpen(false);

    toast({
      title: "Lembur Resmi Dimulai",
      description: `Timer lembur berjalan. Berkas SPL & Foto Awal tersimpan.`,
    });
  };

  // Step 6: End Overtime Click
  const handleEndOvertimeClick = () => {
    setIsEndModalOpen(true);
  };

  // Step 7: Confirm End Overtime Modal
  const handleConfirmEndOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalProofFile || !finalDescription.trim()) {
      toast({
        title: "Dokumen Hasil Belum Lengkap",
        description: "Wajib mengambil/mengunggah Foto Hasil Lembur dan Keterangan Hasil Pekerjaan.",
        variant: "destructive",
      });
      return;
    }

    const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    setOvertimeEndTime(nowStr);
    setIsOvertimeCompleted(true);
    setIsEndModalOpen(false);

    toast({
      title: "Lembur Selesai!",
      description: "Dokumentasi dan hasil lembur berhasil disimpan ke Google Drive (Folder Lembur).",
    });
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      if (file.type.startsWith("image/")) {
        setPreview(URL.createObjectURL(file));
      } else {
        setPreview("pdf");
      }
    }
  };

  const resetDemo = () => {
    setHasCheckedIn(false);
    setIsCheckedOut(false);
    setRegularCheckoutTime(null);
    setIsOvertimeActive(false);
    setIsOvertimeCompleted(false);
    setOvertimeStartTime(null);
    setOvertimeEndTime(null);
    setTimerSeconds(0);
    setSplFile(null);
    setSplPreview(null);
    setInitialProofFile(null);
    setInitialProofPreview(null);
    setStartDescription("");
    setFinalProofFile(null);
    setFinalProofPreview(null);
    setFinalDescription("");
    toast({ title: "Demo Direset", description: "Silakan mencoba alur dari awal." });
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col font-sans pb-12">
      {/* Top Banner Notice */}
      <div className="bg-amber-500 text-white px-4 py-2 text-xs flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span><strong>SIMULASI PREVIEW ALUR LEMBUR:</strong> Tampilan disamakan 100% dengan screenshot aplikasi asli.</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/preview/overtime-admin" className="underline font-bold text-white text-[11px]">
            Ke Preview Admin
          </Link>
          <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[10px] h-6 px-2 font-bold" onClick={resetDemo}>
            Reset Demo
          </Button>
        </div>
      </div>

      {/* 1. HEADER UTAMA DISAMAKAN DENGAN SCREENSHOT 2 */}
      <div className="bg-[#0b1d8a] text-white px-6 pt-6 pb-14 flex justify-between items-start rounded-b-[2rem] shadow-md">
        <div>
          <h1 className="text-base font-black tracking-wide uppercase">PT MEKANO INDUSTRIAL PRESISI</h1>
          <p className="text-[11px] text-blue-200 mt-0.5">ABSENSI TENAGA KERJA PT MIP</p>
        </div>
        {/* Logo Box */}
        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm">
          <div className="text-[#0b1d8a] font-black text-xs tracking-tighter text-center leading-none">
            MEKANO
          </div>
        </div>
      </div>

      {/* CONTAINER UTAMA */}
      <div className="max-w-md w-full mx-auto px-4 -mt-8 space-y-4">
        {/* Card 1: Notifikasi Pengumuman */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <h2 className="text-xs font-extrabold text-[#0b1d8a] uppercase tracking-wide">AKTIFKAN NOTIFIKASI PENGUMUMAN</h2>
          <p className="text-[11px] text-slate-500 leading-snug">
            AGAR ANDA TIDAK KETINGGALAN INFO PENTING DARI ADMIN MESKIPUN APLIKASI DITUTUP.
          </p>
          <Button className="w-full bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold h-9 rounded-xl shadow-sm">
            IZINKAN NOTIFIKASI
          </Button>
        </div>

        {/* Card 2: Profil Karyawan (Contoh: DENI - TIM STAMPING SHIFT 1) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-black text-slate-900">{employeeName}</h3>
            <p className="text-[10px] text-slate-500 font-mono">NIK: <strong className="text-slate-800 font-bold">{nik}</strong></p>
            <p className="text-[10px] text-slate-500">CABANG: <strong className="text-slate-800 font-bold">{cabang}</strong></p>
            <p className="text-[10px] text-slate-500">JABATAN: <strong className="text-slate-800 font-bold">{jabatan}</strong></p>
            <p className="text-[10px] text-slate-500">
              SHIFT: <strong className="text-[#0b1d8a] font-bold">{hasCheckedIn ? shiftName : "BELUM ABSEN MASUK"}</strong>
            </p>
          </div>
          <div className="w-16 h-20 bg-slate-200 rounded-xl overflow-hidden shrink-0 border border-slate-200">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80" 
              alt="Foto Profil" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Card 3: Digital Clock & Status Hari Ini */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center space-y-3">
          <div className="bg-[#f0f3ff] rounded-2xl py-4 border border-blue-100">
            <div className="text-3xl font-black font-mono tracking-widest text-slate-900">
              {currentTimeStr}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">Senin, 27 Jul 2026</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">STATUS HARI INI</span>
            <div className="text-sm font-black text-[#0b1d8a] uppercase">
              {!hasCheckedIn ? "BELUM ABSEN" : isCheckedOut ? "SUDAH ABSEN PULANG" : "HADIR (KERJA)"}
            </div>
          </div>
        </div>

        {/* Card 4: Tombol Absen Utama & Tombol Lembur */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
          {/* Tombol ABSEN MASUK / PULANG */}
          {!hasCheckedIn ? (
            <Button 
              className="w-full h-14 bg-[#0b1d8a] hover:bg-[#07135c] text-white font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 tracking-wider uppercase"
              onClick={handleCheckIn}
            >
              <Camera className="w-5 h-5" /> ABSEN MASUK
            </Button>
          ) : !isCheckedOut ? (
            <Button 
              className="w-full h-14 bg-[#0b1d8a] hover:bg-[#07135c] text-white font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 tracking-wider uppercase"
              onClick={handleCheckOut}
            >
              <LogOut className="w-5 h-5" /> ABSEN PULANG SHIFT 1 ({shiftEnd})
            </Button>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ABSEN PULANG TERKUNCI ({regularCheckoutTime} WIB)
            </div>
          )}

          {/* Tombol Pilihan Lainnya (Sakit, Izin, Libur) jika Belum Absen */}
          {!hasCheckedIn && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button variant="outline" className="h-10 text-xs font-bold text-[#0b1d8a] border-slate-200 rounded-xl">SAKIT</Button>
              <Button variant="outline" className="h-10 text-xs font-bold text-purple-700 border-slate-200 rounded-xl">IZIN</Button>
              <Button variant="outline" className="h-10 text-xs font-bold text-slate-700 border-slate-200 rounded-xl">LIBUR</Button>
            </div>
          )}

          {/* ATURAN BARU: LOGIKA MUNCULNYA TOMBOL LEMBUR (OVERTIME) */}
          {/* HANYA MUNCUL SETELAH TEKAN ABSEN MASUK. DAN TETAP ADA SETELAH TEKAN ABSEN PULANG! */}
          {hasCheckedIn && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-[11px] font-bold text-[#0b1d8a]">
                <span>⚡ LAYANAN LEMBUR (OVERTIME)</span>
                <span className="text-[9px] text-slate-400 font-normal">TIM STAMPING SHIFT 1</span>
              </div>

              {!isOvertimeActive && !isOvertimeCompleted && (
                <Button 
                  className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 tracking-wide uppercase"
                  onClick={handleOvertimeButtonClick}
                >
                  <Play className="w-5 h-5 fill-current" /> LEMBUR (OVERTIME)
                </Button>
              )}

              {/* State Sedang Lembur */}
              {isOvertimeActive && !isOvertimeCompleted && (
                <div className="bg-orange-50 border-2 border-orange-300 p-4 rounded-2xl space-y-3 text-center shadow-sm">
                  <div className="inline-flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> LEMBUR SEDANG BERJALAN
                  </div>
                  <div className="text-3xl font-black font-mono text-orange-700 tracking-wider">
                    {formatTimer(timerSeconds)}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Mulai Lembur: {overtimeStartTime} WIB</p>
                  
                  <Button 
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow text-sm"
                    onClick={handleEndOvertimeClick}
                  >
                    <CheckCircle2 className="mr-2 h-4 h-4" /> SELESAI LEMBUR
                  </Button>
                </div>
              )}

              {/* State Lembur Completed */}
              {isOvertimeCompleted && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1.5 text-xs text-emerald-800">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Lembur Hari Ini Selesai
                  </div>
                  <p>Total Durasi Lembur: <strong>{formatTimer(timerSeconds)}</strong> ({overtimeStartTime} - {overtimeEndTime})</p>
                  <p className="text-[10px] text-emerald-600">Dokumen SPL & Foto Hasil Kerja tersimpan di Google Drive <strong>Folder Lembur</strong>.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ALERT DIALOG KONFIRMASI (SESUAI PERINTAH: "ketika di klik alert dulu") */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent className="bg-white rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900">Konfirmasi Memulai Lembur?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2">
              <p>Anda memilih untuk melakukan <strong>Lembur (Overtime)</strong> setelah Shift 1 ({shiftEnd}).</p>
              {!isCheckedOut && (
                <p className="text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                  ⚠️ Absen reguler Anda akan otomatis dicatat pulang tepat di jam <strong>{shiftEnd} WIB</strong>.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAlert}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl"
            >
              Ya, Lanjutkan Lembur
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal POPUP 1: MULAI LEMBUR (UPLOAD SPL & FOTO AWAL) */}
      <Dialog open={isStartModalOpen} onOpenChange={setIsStartModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" /> Form Mulai Lembur
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Unggah Surat Perintah Lembur (SPL) & Foto bukti sebelum memulai timer lembur.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmStartOvertime} className="space-y-4 py-2">
            {/* Upload SPL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                1. Upload Surat Perintah Lembur (SPL) <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-orange-50/50 transition-colors text-center cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleFileChange(e, setSplFile, setSplPreview)}
                />
                {splFile ? (
                  <div className="text-xs font-medium text-blue-600 flex items-center justify-center gap-1.5">
                    <FileText className="w-4 h-4" /> {splFile.name}
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <Upload className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-xs">Klik / Pilih file SPL dari Galeri HP/PDF</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Foto Awal Lembur */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                2. Foto Bukti Awal Lembur <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-orange-50/50 transition-colors text-center cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleFileChange(e, setInitialProofFile, setInitialProofPreview)}
                />
                {initialProofPreview ? (
                  <img src={initialProofPreview} alt="Bukti Awal" className="h-24 mx-auto object-cover rounded-lg" />
                ) : (
                  <div className="space-y-1 text-slate-400">
                    <Camera className="w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-xs">Ambil Foto / Upload Bukti Awal</p>
                  </div>
                )}
              </div>
            </div>

            {/* Deskripsi Lembur */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                3. Deskripsi Pekerjaan Lembur <span className="text-red-500">*</span>
              </label>
              <Textarea 
                placeholder="Contoh: Overtime repair 3 mesin press bersama Pak Dede..."
                value={startDescription}
                onChange={(e) => setStartDescription(e.target.value)}
                className="text-xs h-20 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsStartModalOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-xl font-bold h-10 px-5">
                Mulai Lembur Sekarang
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal POPUP 2: SELESAI LEMBUR */}
      <Dialog open={isEndModalOpen} onOpenChange={setIsEndModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" /> Dokumentasi Hasil Lembur
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ambil foto hasil pekerjaan lembur dan berikan keterangan singkat.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmEndOvertime} className="space-y-4 py-2">
            {/* Foto Hasil Lembur */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                1. Foto Dokumentasi Hasil Pekerjaan Lembur <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-emerald-200 rounded-xl p-4 bg-emerald-50/50 hover:bg-emerald-50 transition-colors text-center cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => handleFileChange(e, setFinalProofFile, setFinalProofPreview)}
                />
                {finalProofPreview ? (
                  <img src={finalProofPreview} alt="Hasil Lembur" className="h-32 mx-auto object-cover rounded-lg shadow-sm" />
                ) : (
                  <div className="space-y-1.5 text-emerald-700">
                    <Camera className="w-8 h-8 mx-auto text-emerald-600" />
                    <p className="text-xs font-medium">Ambil Kamera / Pilih Foto Hasil Kerja</p>
                  </div>
                )}
              </div>
            </div>

            {/* Keterangan Hasil */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                2. Keterangan / Catatan Hasil Lembur <span className="text-red-500">*</span>
              </label>
              <Textarea 
                placeholder="Contoh: Perbaikan 3 unit mesin selesai 100%, siap beroperasi besok pagi."
                value={finalDescription}
                onChange={(e) => setFinalDescription(e.target.value)}
                className="text-xs h-20 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEndModalOpen(false)}>Batal</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold h-10 px-5">
                Simpan & Selesai Lembur
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
