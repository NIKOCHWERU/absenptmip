import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Upload, FileText, Camera, CheckCircle2, Play, AlertCircle, ShieldAlert, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function EmployeeOvertimePreviewPage() {
  const { toast } = useToast();

  // State Absensi Reguler
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [isCheckedIn, setIsCheckedIn] = useState(true);
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

    // 1. Kunci Absen Reguler tepat sesuai jam pulang shift (contoh: 17:00)
    setIsCheckedOut(true);
    setRegularCheckoutTime(shiftEnd);

    // 2. Mulai Lembur
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
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-center">
      <div className="max-w-md w-full space-y-4">
        {/* Banner Preview Notification */}
        <div className="bg-amber-500 text-white p-3.5 rounded-2xl shadow-sm text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">MODE SIMULASI / PREVIEW DUMMY</p>
              <p className="text-[11px] opacity-90">Halaman ini aman dan tidak mengganggu data asli.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[11px] h-7 px-2.5 font-semibold" onClick={resetDemo}>
            Reset Demo
          </Button>
        </div>

        {/* Back Link */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <Link href="/preview/overtime-admin" className="text-primary font-medium flex items-center gap-1 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Lihat Preview Admin Rekap
          </Link>
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium text-[10px]">Tampilan HP Karyawan</span>
        </div>

        {/* Card Simulasi Absen Karyawan */}
        <Card className="shadow-lg border-slate-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-bold">PT Mekano Industrial Presisi</CardTitle>
                <CardDescription className="text-blue-100 text-xs">Simulasi Dashboard Absen Karyawan</CardDescription>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 text-[10px]">
                Shift Normal: 08:00 - {shiftEnd}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Status Absen Reguler */}
            <div className="bg-slate-100 p-4 rounded-xl space-y-2 border border-slate-200">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Jam Masuk: <strong className="text-slate-800 font-semibold">08:02 WIB</strong></span>
                <span>Jam Pulang: <strong className="text-slate-800 font-semibold">{isCheckedOut ? `${regularCheckoutTime} WIB (Terkunci)` : "Belum Pulang"}</strong></span>
              </div>
              {isCheckedOut && (
                <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Absen reguler otomatis dikunci tepat di jam pulang shift ({regularCheckoutTime}) saat tombol Lembur ditekan.</span>
                </div>
              )}
            </div>

            {/* Tombol Absen Utama Reguler */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">1. Absen Reguler</label>
              {!isCheckedOut ? (
                <Button 
                  className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl shadow"
                  onClick={() => {
                    setIsCheckedOut(true);
                    setRegularCheckoutTime(shiftEnd);
                    toast({ title: "Absen Pulang Berhasil", description: `Jam pulang tercatat ${shiftEnd}` });
                  }}
                >
                  <Clock className="mr-2 h-4 h-4" /> Absen Pulang Shift Reguler
                </Button>
              ) : (
                <Button disabled className="w-full h-12 bg-slate-200 text-slate-500 font-medium rounded-xl">
                  <CheckCircle2 className="mr-2 h-4 h-4 text-emerald-600" /> Sudah Absen Pulang ({regularCheckoutTime})
                </Button>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Tombol Lembur Statis (Selalu Tampil di Bawah Tombol Utama) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-orange-600 uppercase tracking-wider block">2. Fitur Lembur (Overtime)</label>
                <span className="text-[10px] text-slate-400 font-normal">Selalu Tampak di Bawah</span>
              </div>

              {!isOvertimeActive && !isOvertimeCompleted && (
                <Button 
                  className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-md transition-all text-base"
                  onClick={handleStartOvertimeClick}
                >
                  <Play className="mr-2 h-5 w-5 fill-current" /> LEMBUR (OVERTIME)
                </Button>
              )}

              {isOvertimeActive && !isOvertimeCompleted && (
                <div className="bg-orange-50 border-2 border-orange-300 p-4 rounded-2xl space-y-3 text-center">
                  <div className="inline-flex items-center gap-1.5 bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> LEMBUR SEDANG BERJALAN
                  </div>
                  <div className="text-3xl font-black font-mono text-orange-700 tracking-wider">
                    {formatTimer(timerSeconds)}
                  </div>
                  <p className="text-[11px] text-slate-500">Mulai jam: {overtimeStartTime} WIB</p>
                  
                  <Button 
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow text-sm"
                    onClick={handleEndOvertimeClick}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> SELESAI LEMBUR
                  </Button>
                </div>
              )}

              {isOvertimeCompleted && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2 text-xs text-emerald-800">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Lembur Hari Ini Selesai
                  </div>
                  <p>Durasi Lembur: <strong>{formatTimer(timerSeconds)}</strong> ({overtimeStartTime} - {overtimeEndTime})</p>
                  <p className="text-[11px] text-emerald-600">Dokumen SPL, Foto Awal, & Dokumentasi Hasil telah tersimpan di Google Drive folder <strong>Lembur</strong>.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

      </div>
    </div>
  );
}
