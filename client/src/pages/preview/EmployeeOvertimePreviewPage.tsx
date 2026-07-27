import React, { useState, useEffect } from "react";
import { CompanyHeader } from "@/components/CompanyHeader";
import { DigitalClock } from "@/components/DigitalClock";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Upload, FileText, Camera, CheckCircle2, Play, AlertCircle, ShieldAlert, ArrowLeft, LogOut, Coffee } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function EmployeeOvertimePreviewPage() {
  const { toast } = useToast();

  // State Absensi Reguler
  const shiftEnd = "17:00";
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [regularCheckoutTime, setRegularCheckoutTime] = useState<string | null>(null);

  // State Lembur
  const [isOvertimeActive, setIsOvertimeActive] = useState(false);
  const [isOvertimeCompleted, setIsOvertimeCompleted] = useState(false);
  const [overtimeStartTime, setOvertimeStartTime] = useState<string | null>(null);
  const [overtimeEndTime, setOvertimeEndTime] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

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

  // Timer Effect
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

  const handleStartOvertimeClick = () => {
    setIsStartModalOpen(true);
  };

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

    setIsCheckedOut(true);
    setRegularCheckoutTime(shiftEnd);

    const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    setOvertimeStartTime(nowStr);
    setIsOvertimeActive(true);
    setIsStartModalOpen(false);

    toast({
      title: "Lembur Dimulai",
      description: `Absen reguler otomatis dikunci jam ${shiftEnd}. Timer lembur berjalan!`,
    });
  };

  const handleEndOvertimeClick = () => {
    setIsEndModalOpen(true);
  };

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
    toast({ title: "Demo Direset", description: "Silakan mencoba alur kembali." });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between pb-24">
      {/* Top Banner Notice */}
      <div className="bg-amber-500 text-white px-4 py-2 text-xs flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span><strong>MODE SIMULASI PREVIEW:</strong> Tampilan persis Halaman Absensi Karyawan yang sudah ada.</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/preview/overtime-admin" className="underline font-bold text-white text-[11px]">
            Ke Preview Admin
          </Link>
          <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[10px] h-6 px-2 font-bold" onClick={resetDemo}>
            Reset
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-md w-full mx-auto p-4 space-y-4">
        {/* Header Perusahaan Samakan dengan Komponen Asli */}
        <CompanyHeader />

        {/* Card Waktu & Jam Digital */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center space-y-3">
          <DigitalClock />
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            <span>Shift 1 (Pagi): 08:00 - {shiftEnd} WIB</span>
          </div>
        </div>

        {/* Kartu Status Absen Reguler */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Absensi Reguler</span>
            <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[11px]">Hadir Shift 1</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Absen Masuk</span>
              <strong className="text-slate-800 text-sm font-mono">07:55 WIB</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Absen Pulang</span>
              <strong className="text-slate-800 text-sm font-mono">
                {isCheckedOut ? `${regularCheckoutTime} WIB` : "Belum Pulang"}
              </strong>
            </div>
          </div>

          {/* 1. Tombol Absen Utama Reguler */}
          {!isCheckedOut ? (
            <Button 
              className="w-full h-13 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm"
              onClick={() => {
                setIsCheckedOut(true);
                setRegularCheckoutTime(shiftEnd);
                toast({ title: "Absen Pulang Berhasil", description: `Jam pulang otomatis dicatat ${shiftEnd}` });
              }}
            >
              <LogOut className="w-4 h-4" /> ABSEN PULANG SHIFT REGULER
            </Button>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800 font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Absen Pulang Terkunci ({regularCheckoutTime} WIB)
            </div>
          )}

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
              <span className="bg-white px-3 text-orange-600">Fitur Lembur Perusahaan</span>
            </div>
          </div>

          {/* 2. Tombol Lembur Statis Tepat di Bawah Absen Utama */}
          {!isOvertimeActive && !isOvertimeCompleted && (
            <Button 
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 text-base tracking-wide"
              onClick={handleStartOvertimeClick}
            >
              <Play className="w-5 h-5 fill-current" /> LEMBUR (OVERTIME)
            </Button>
          )}

          {/* State Sedang Lembur */}
          {isOvertimeActive && !isOvertimeCompleted && (
            <div className="bg-gradient-to-b from-orange-50 to-orange-100/50 border-2 border-orange-300 p-4 rounded-2xl space-y-3 text-center shadow-sm">
              <div className="inline-flex items-center gap-1.5 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-black animate-pulse">
                <Clock className="w-3.5 h-3.5" /> LEMBUR SEDANG BERJALAN
              </div>
              <div className="text-3xl font-black font-mono text-orange-700 tracking-wider">
                {formatTimer(timerSeconds)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Jam Mulai Lembur: {overtimeStartTime} WIB</p>
              
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
              <p className="text-[10px] text-emerald-600">Dokumen SPL & Foto Hasil Kerja sudah tersimpan di Google Drive <strong>Folder Lembur</strong>.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal POPUP 1: MULAI LEMBUR */}
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

      {/* Bottom Navigation Component Asli */}
      <BottomNav />
    </div>
  );
}
