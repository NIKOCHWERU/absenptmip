import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, FileDown, Eye, ShieldAlert, ArrowLeft, Download, FolderCheck, Search, Image as ImageIcon, Printer, CheckCircle2, PlusCircle, Clock, Calendar, Users, Send
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AdminOvertimePage() {
  const { toast } = useToast();
  const { data: config } = useQuery<any>({ queryKey: ["/api/config"] });
  const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
  const rawLogo = config?.logoUrl || import.meta.env.VITE_LOGO_FILE || "";
  const logoUrl = (rawLogo && rawLogo !== "/logo_elok_buah.jpg") ? rawLogo : null;
  const logoInisial = config?.logoInisial || import.meta.env.VITE_LOGO_INISIAL || namaPt.charAt(0);

  const [activeTab, setActiveTab] = useState("list");
  const [searchName, setSearchName] = useState("");
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPdfItem, setSelectedPdfItem] = useState<any | null>(null);

  // Form Give Overtime Task State
  const [assignEmployee, setAssignEmployee] = useState("KARYAWAN B");
  const [assignDate, setAssignDate] = useState("2026-07-25");
  const [assignStartTime, setAssignStartTime] = useState("17:00");
  const [assignEndTime, setAssignEndTime] = useState("20:30");
  const [assignTask, setAssignTask] = useState("");
  const [assignSplFile, setAssignSplFile] = useState<File | null>(null);

  // Dummy List Lembur Khusus
  const [overtimeList, setOvertimeList] = useState([
    {
      id: 1,
      date: "SABTU, 25 JULI 2026",
      employeeName: "KARYAWAN B",
      nik: "3215000000000002",
      shift: "LEMBUR TIM PRODUCTION",
      masuk: "17:00",
      pulang: "20:30",
      jamKerja: "3J 30M",
      status: "SELESAI",
      keterangan: "[DOKUMEN LEMBUR & SPL COMPLETE]",
      splName: "SPL_KARYAWAN_B.PDF",
      splUrl: "https://drive.google.com/file/d/demo-spl-karyawan-b",
      initialPhoto: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Perbaikan Mesin Production Line 3 bersama Tim Maintenance",
      finalDesc: "Perbaikan Mesin Selesai 100%, Siap Beroperasi Besok Pagi",
      driveFolder: "Google Drive/Lembur/Karyawan_B_2026-07-25_Lembur.jpg"
    },
    {
      id: 2,
      date: "SABTU, 25 JULI 2026",
      employeeName: "KARYAWAN A",
      nik: "3215000000000001",
      shift: "LEMBUR TIM MAINTENANCE",
      masuk: "17:00",
      pulang: "-",
      jamKerja: "1J 45M (BERJALAN)",
      status: "BERLANGSUNG",
      keterangan: "[TIMER LEMBUR BERJALAN DI HP KARYAWAN]",
      splName: "SPL_KARYAWAN_A.PDF",
      splUrl: "https://drive.google.com/file/d/demo-spl-karyawan-a",
      initialPhoto: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80",
      finalPhoto: null,
      startDesc: "Overtime maintenance rutin panel listrik gedung B",
      finalDesc: "-",
      driveFolder: "Google Drive/Lembur/Karyawan_A_2026-07-25_Lembur.jpg"
    },
    {
      id: 3,
      date: "SABTU, 25 JULI 2026",
      employeeName: "KARYAWAN C",
      nik: "3215000000000003",
      shift: "LEMBUR SECURITY OVERTIME",
      masuk: "19:00",
      pulang: "22:00",
      jamKerja: "3J 0M",
      status: "SELESAI",
      keterangan: "[DOKUMEN LEMBUR & SPL COMPLETE]",
      splName: "SPL_KARYAWAN_C.PDF",
      splUrl: "https://drive.google.com/file/d/demo-spl-karyawan-c",
      initialPhoto: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Patroli pengawasan ekstra pengiriman barang malam",
      finalDesc: "Pengawasan selesai, area aman kondusif 100%",
      driveFolder: "Google Drive/Lembur/Karyawan_C_2026-07-25_Lembur.jpg"
    }
  ]);

  const filteredList = overtimeList.filter(
    item => item.employeeName.toLowerCase().includes(searchName.toLowerCase()) ||
            item.nik.toLowerCase().includes(searchName.toLowerCase())
  );

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTask.trim()) {
      toast({
        title: "Tugas Lembur Belum Diisi",
        description: "Mohon isi uraian tugas lembur yang diberikan kepada karyawan.",
        variant: "destructive"
      });
      return;
    }

    const newItem = {
      id: overtimeList.length + 1,
      date: "SABTU, 25 JULI 2026",
      employeeName: assignEmployee,
      nik: assignEmployee === "KARYAWAN A" ? "3215000000000001" : assignEmployee === "KARYAWAN B" ? "3215000000000002" : "3215000000000003",
      shift: "LEMBUR TUGAS BARU",
      masuk: assignStartTime,
      pulang: assignEndTime,
      jamKerja: "3J 30M",
      status: "MENUNGGU_KONFIRMASI",
      keterangan: "[SURAT SPL TERKIRIM KE HP KARYAWAN]",
      splName: assignSplFile ? assignSplFile.name : `SPL_${assignEmployee.replace(" ", "_")}.PDF`,
      splUrl: "https://drive.google.com/file/d/demo-spl-new",
      initialPhoto: null,
      finalPhoto: null,
      startDesc: assignTask,
      finalDesc: "-",
      driveFolder: `Google Drive/Lembur/${assignEmployee.replace(" ", "_")}_2026-07-25_Lembur.jpg`
    };

    setOvertimeList([newItem, ...overtimeList]);
    setAssignTask("");
    setAssignSplFile(null);
    setActiveTab("list");

    toast({
      title: "Penugasan Lembur Terkirim!",
      description: `Surat Perintah Lembur (SPL) telah dikirim ke HP ${assignEmployee}.`,
    });
  };

  const handleOpenPdfModal = (item: any) => {
    setSelectedPdfItem(item);
    setIsPdfModalOpen(true);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0b1d8a] to-blue-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-orange-400" /> KELOLA & REKAP LEMBUR TENAGA KERJA
          </h1>
          <p className="text-xs text-blue-200 mt-1">
            Menu khusus admin untuk memberikan tugas lembur (SPL) dan mengecek rekapitulasi foto bukti lembur karyawan.
          </p>
        </div>
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl">
          {namaPt}
        </Badge>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-200 p-1 rounded-xl">
          <TabsTrigger value="list" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#0b1d8a]">
            <FileText className="w-4 h-4 mr-2" /> List & Rekap Berkas Lembur
          </TabsTrigger>
          <TabsTrigger value="assign" className="rounded-lg text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-orange-600">
            <PlusCircle className="w-4 h-4 mr-2" /> Memberi Tugas Lembur (Buat SPL)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: LIST & REKAP BERKAS LEMBUR */}
        <TabsContent value="list" className="space-y-4 mt-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900">Daftar Penugasan & Berkas Lembur</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Menampilkan seluruh data lembur karyawan beserta Surat SPL dan lampiran foto hasil kerja.
                  </CardDescription>
                </div>
                <div className="w-full md:w-64">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Cari Karyawan A, B, C..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="h-9 pl-9 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-200 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="p-3 text-center w-10">NO</th>
                    <th className="p-3 w-32">TANGGAL</th>
                    <th className="p-3 w-48">NAMA KARYAWAN</th>
                    <th className="p-3 text-center">WAKTU LEMBUR</th>
                    <th className="p-3 text-center">DURASI</th>
                    <th className="p-3 text-center">BERKAS SPL</th>
                    <th className="p-3 text-center">STATUS</th>
                    <th className="p-3 text-center">AKSI & LAPORAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredList.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="p-3 text-center font-bold text-slate-600">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 text-[11px]">{row.date}</td>
                      <td className="p-3">
                        <div className="font-extrabold text-blue-900 text-sm">{row.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">NIK: {row.nik}</div>
                        <div className="text-[9px] text-orange-600 font-bold uppercase">{row.shift}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-700">
                        {row.masuk} - {row.pulang}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900">{row.jamKerja}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200 inline-block">
                          📄 {row.splName}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {row.status === "SELESAI" && (
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px]">SELESAI</Badge>
                        )}
                        {row.status === "BERLANGSUNG" && (
                          <Badge className="bg-orange-500 text-white font-bold text-[10px] animate-pulse">BERLANGSUNG</Badge>
                        )}
                        {row.status === "MENUNGGU_KONFIRMASI" && (
                          <Badge className="bg-amber-500 text-white font-bold text-[10px]">MENUNGGU</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] h-7 px-2.5 rounded-lg"
                            onClick={() => setSelectedOvertime(row)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Berkas
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] h-7 px-2.5 rounded-lg"
                            onClick={() => handleOpenPdfModal(row)}
                          >
                            <FileText className="w-3.5 h-3.5 mr-1" /> Cetak PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FORM MEMBERI TUGAS LEMBUR (BUAT SPL) */}
        <TabsContent value="assign" className="mt-4">
          <Card className="border-slate-200 shadow-sm max-w-2xl mx-auto">
            <CardHeader className="bg-orange-50 border-b border-orange-100 rounded-t-xl">
              <CardTitle className="text-base font-black text-orange-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-orange-600" /> Form Buat & Kirim Penugasan Lembur (SPL)
              </CardTitle>
              <CardDescription className="text-xs text-orange-700">
                Instruksi lembur resmi akan terkirim langsung ke HP karyawan bersangkutan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAssignSubmit} className="space-y-4">
                {/* 1. Pilih Karyawan */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">1. Pilih Karyawan Penerima Tugas Lembur</label>
                  <Select value={assignEmployee} onValueChange={setAssignEmployee}>
                    <SelectTrigger className="w-full text-xs font-bold h-10 rounded-xl">
                      <SelectValue placeholder="Pilih Karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KARYAWAN A">KARYAWAN A (NIK: 3215000000000001)</SelectItem>
                      <SelectItem value="KARYAWAN B">KARYAWAN B (NIK: 3215000000000002)</SelectItem>
                      <SelectItem value="KARYAWAN C">KARYAWAN C (NIK: 3215000000000003)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Tanggal & Jam Lembur */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Tanggal Lembur</label>
                    <Input
                      type="date"
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                      className="h-10 text-xs rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Jam Mulai Lembur</label>
                    <Input
                      type="time"
                      value={assignStartTime}
                      onChange={(e) => setAssignStartTime(e.target.value)}
                      className="h-10 text-xs rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700">Estimasi Selesai</label>
                    <Input
                      type="time"
                      value={assignEndTime}
                      onChange={(e) => setAssignEndTime(e.target.value)}
                      className="h-10 text-xs rounded-xl font-bold"
                    />
                  </div>
                </div>

                {/* 3. Uraian Pekerjaan Lembur */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">3. Uraian Pekerjaan & Instruksi Lembur</label>
                  <Textarea
                    placeholder="Contoh: Overtime perbaikan 3 unit mesin stamping line B bersama Koordinator..."
                    value={assignTask}
                    onChange={(e) => setAssignTask(e.target.value)}
                    className="h-24 text-xs rounded-xl"
                  />
                </div>

                {/* 4. Upload Berkas SPL PDF (Opsional) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">4. Upload Lampiran Surat SPL (PDF / Foto Opsional)</label>
                  <Input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setAssignSplFile(e.target.files?.[0] || null)}
                    className="text-xs h-10 rounded-xl"
                  />
                </div>

                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11 rounded-xl shadow">
                  <Send className="w-4 h-4 mr-2" /> Kirim Penugasan Lembur Ke HP Karyawan
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: DETAIL INSPEKSI BERKAS LEMBUR */}
      <Dialog open={!!selectedOvertime} onOpenChange={() => setSelectedOvertime(null)}>
        {selectedOvertime && (
          <DialogContent className="sm:max-w-lg bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>Detail Berkas Lembur: {selectedOvertime.employeeName}</span>
                <Badge className="bg-orange-500 text-white text-[10px]">{selectedOvertime.date}</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                NIK: <strong>{selectedOvertime.nik}</strong> | Shift: <strong>{selectedOvertime.shift}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex items-center justify-between text-blue-900 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <FolderCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Google Drive Folder: <strong>{selectedOvertime.driveFolder}</strong></span>
                </div>
                <Badge className="bg-blue-600 text-white text-[9px] shrink-0">Drive Ready</Badge>
              </div>

              {/* Berkas SPL */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" /> 1. Surat Perintah Lembur (SPL)
                </div>
                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-mono text-[11px]">{selectedOvertime.splName}</span>
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 border-blue-200 font-bold">
                    <Download className="w-3 h-3 mr-1" /> Unduh SPL
                  </Button>
                </div>
              </div>

              {/* Grid Foto Awal & Foto Hasil */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> 2. Foto Awal Lembur
                  </div>
                  {selectedOvertime.initialPhoto ? (
                    <img src={selectedOvertime.initialPhoto} alt="Awal" className="h-28 w-full object-cover rounded-lg border" />
                  ) : (
                    <div className="h-28 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">Belum Diunggah</div>
                  )}
                  <p className="text-[11px] text-slate-600 italic font-medium">"{selectedOvertime.startDesc}"</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> 3. Foto Hasil Pekerjaan
                  </div>
                  {selectedOvertime.finalPhoto ? (
                    <img src={selectedOvertime.finalPhoto} alt="Hasil" className="h-28 w-full object-cover rounded-lg border" />
                  ) : (
                    <div className="h-28 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-[10px]">Lembur Berlangsung</div>
                  )}
                  <p className="text-[11px] text-slate-600 italic font-bold text-emerald-800">"{selectedOvertime.finalDesc}"</p>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* MODAL 2: PREVIEW CETAK PDF RESMI BERKAS LEMBUR DENGAN LOGO PERUSAHAAN & media print */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        {selectedPdfItem && (
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-100 p-4 md:p-6 rounded-2xl">
            <DialogHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3 bg-white p-4 rounded-xl shadow-sm">
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-600" /> Preview Dokumen Cetak PDF Berkas Lembur
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Dokumen resmi siap cetak dengan Kop Surat Perusahaan (Logo App) dan 3 Lampiran Foto Lembur.
                </DialogDescription>
              </div>
              <Button size="sm" onClick={handleTriggerPrint} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 rounded-xl shadow">
                <Printer className="w-4 h-4 mr-1.5" /> Cetak / Download PDF
              </Button>
            </DialogHeader>

            {/* DOKUMEN CETAK PREVIEW PRINTABLE */}
            <div id="overtime-pdf-printable" className="bg-white p-8 rounded-xl shadow-lg border border-slate-300 space-y-6 text-slate-900 font-sans my-2 printable-area">
              
              {/* KOP SURAT PERUSAHAAN DENGAN LOGO APP */}
              <div className="flex justify-between items-center pb-4 border-b-2 border-slate-900">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-xl border border-slate-300 flex items-center justify-center p-1 overflow-hidden shadow-sm">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo Perusahaan" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full bg-[#0b1d8a] text-white font-black text-xs flex items-center justify-center rounded-lg">
                        {logoInisial}
                      </div>
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-[#0b1d8a] tracking-tight uppercase">{namaPt}</h1>
                    <p className="text-xs text-slate-600 font-bold">JL. RAYA DUKUH, INDUSTRI AGGADITA, KARAWANG TIMUR</p>
                    <p className="text-[10px] text-slate-500 font-medium">Sistem Kehadiran & Berkas Dokumentasi Lembur Tenaga Kerja</p>
                  </div>
                </div>
              </div>

              {/* JUDUL LAPORAN */}
              <div className="text-center py-2 space-y-1">
                <h2 className="text-base font-black text-slate-900 tracking-wider uppercase underline underline-offset-4">
                  LAPORAN BERKAS & DOKUMENTASI LEMBUR
                </h2>
                <p className="text-xs font-bold text-slate-700">TANGGAL: {selectedPdfItem.date}</p>
              </div>

              {/* DETAIL TENAGA KERJA */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs font-medium">
                <div>
                  <p className="text-slate-500 text-[10px]">NAMA TENAGA KERJA:</p>
                  <p className="font-black text-blue-900 text-sm">{selectedPdfItem.employeeName}</p>
                  <p className="text-slate-500 font-mono text-[11px]">NIK: {selectedPdfItem.nik}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-[10px]">WAKTU & DURASI LEMBUR:</p>
                  <p className="font-black text-orange-600 text-sm">{selectedPdfItem.masuk} - {selectedPdfItem.pulang} WIB</p>
                  <p className="font-bold text-slate-800 text-xs">Total Durasi: {selectedPdfItem.jamKerja}</p>
                </div>
              </div>

              {/* LAMPIRAN 3 FOTO BUKTI LEMBUR */}
              <div className="pt-2 space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 border-b pb-1">
                  <FileText className="w-4 h-4 text-orange-600" /> LAMPIRAN DOKUMEN & BUKTI FOTO FISIK
                </h3>

                <div className="grid grid-cols-3 gap-4">
                  {/* SPL */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-800 block">A. SURAT PERINTAH LEMBUR</span>
                    <div className="h-36 bg-white rounded-lg flex flex-col items-center justify-center p-2 border border-dashed border-slate-300 shadow-inner">
                      <FileText className="w-10 h-10 text-orange-500 mb-1" />
                      <span className="text-[11px] font-bold text-blue-600">{selectedPdfItem.splName}</span>
                      <span className="text-[9px] text-slate-400">Terverifikasi Koordinator</span>
                    </div>
                  </div>

                  {/* Foto Awal */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-800 block">B. FOTO BUKTI AWAL KERJA</span>
                    {selectedPdfItem.initialPhoto ? (
                      <img src={selectedPdfItem.initialPhoto} alt="Awal" className="h-36 w-full object-cover rounded-lg border shadow-sm" />
                    ) : (
                      <div className="h-36 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">No Photo</div>
                    )}
                    <p className="text-[10px] text-slate-600 italic">"{selectedPdfItem.startDesc}"</p>
                  </div>

                  {/* Foto Hasil */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-2">
                    <span className="text-[11px] font-bold text-slate-800 block">C. DOKUMENTASI HASIL KERJA</span>
                    {selectedPdfItem.finalPhoto ? (
                      <img src={selectedPdfItem.finalPhoto} alt="Hasil" className="h-36 w-full object-cover rounded-lg border shadow-sm" />
                    ) : (
                      <div className="h-36 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">Sedang Berlangsung</div>
                    )}
                    <p className="text-[10px] text-emerald-800 font-bold italic">"{selectedPdfItem.finalDesc}"</p>
                  </div>
                </div>
              </div>

              {/* TANDA TANGAN PENGESAHAN */}
              <div className="pt-8 flex justify-between items-end text-xs font-semibold text-slate-800">
                <div>
                  <p>Diperiksa Oleh,</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">Mbak Intan (HRD/Payroll)</p>
                </div>
                <div className="text-right">
                  <p>Karawang, {selectedPdfItem.date.replace("SABTU, ", "")}</p>
                  <p>Disetujui Oleh,</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">Pimpinan PT Mekano Industrial Presisi</p>
                </div>
              </div>

            </div>

            {/* STYLES MEDIA PRINT KHUSUS */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page { size: A4 landscape; margin: 1cm; }
                body * { visibility: hidden; }
                .printable-area, .printable-area * { visibility: visible; }
                .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
              }
            `}} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
