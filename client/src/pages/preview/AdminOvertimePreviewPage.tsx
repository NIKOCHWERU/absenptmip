import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileText, FileDown, Eye, ShieldAlert, ArrowLeft, Download, FolderCheck, Search, Image as ImageIcon, Printer, CheckCircle2
} from "lucide-react";
import { Link } from "wouter";

export default function AdminOvertimePreviewPage() {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [searchName, setSearchName] = useState("");
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Mock data rekap absensi persis dari Screenshot 1
  const mockAttendanceData = [
    {
      id: 1,
      date: "SABTU, 25 JULI 2026",
      employeeName: "ANDRI",
      shift: "TIM STAMPING ( SHIFT 2 )",
      nik: "3215190705910002",
      masuk: "12:45",
      istirahat: "18:19",
      selesai: "19:06",
      pulang: "22:06",
      jamKerja: "8J 33M",
      totalIstirahat: "0J 47M",
      status: "HADIR",
      keterangan: "-",
      isOvertime: false,
      isContinuation: false,
    },
    {
      id: 2,
      date: "SABTU, 25 JULI 2026",
      employeeName: "DENI",
      shift: "TIM STAMPING SHIFT 1",
      nik: "3215180601940004",
      masuk: "07:44",
      istirahat: "12:11",
      selesai: "13:00",
      pulang: "17:00",
      jamKerja: "8J 27M",
      totalIstirahat: "0J 49M",
      status: "HADIR",
      keterangan: "-",
      isOvertime: false,
      isContinuation: false,
    },
    // BARIS TAMBAHAN KHUSUS LEMBUR DENI
    {
      id: 202,
      date: "SABTU, 25 JULI 2026",
      employeeName: "DENI",
      shift: "LEMBUR TIM STAMPING",
      nik: "3215180601940004",
      masuk: "17:00",
      istirahat: "-",
      selesai: "-",
      pulang: "20:30",
      jamKerja: "3J 30M",
      totalIstirahat: "-",
      status: "LEMBUR SELESAI",
      keterangan: "[DOKUMEN LEMBUR & SPL COMPLETE]",
      isOvertime: true,
      isContinuation: true,
      splUrl: "https://drive.google.com/file/d/demo-spl-deni",
      splName: "SPL_DENI_25JUL.PDF",
      initialPhoto: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Overtime repair 3 mesin press bersama Pak Dede",
      finalDesc: "Perbaikan 3 mesin selesai 100%, sudah diuji coba siap pakai besok.",
      driveFolder: "Google Drive/Lembur/Deni_2026-07-25_Lembur.jpg"
    },
    {
      id: 3,
      date: "SABTU, 25 JULI 2026",
      employeeName: "DIAN KURDIANSYAH",
      shift: "TIM STAMPING SHIFT 1",
      nik: "3215140312880006",
      masuk: "08:08",
      istirahat: "12:25",
      selesai: "13:00",
      pulang: "17:19",
      jamKerja: "8J 37M",
      totalIstirahat: "0J 35M",
      status: "TELAT",
      keterangan: "[TELAT: BAN BOCOR]",
      isOvertime: false,
      isContinuation: false,
    },
    {
      id: 4,
      date: "SABTU, 25 JULI 2026",
      employeeName: "EKA PERMANA",
      shift: "TIM STAMPING ( SHIFT 2 )",
      nik: "3215070607950001",
      masuk: "12:30",
      istirahat: "18:19",
      selesai: "-",
      pulang: "23:00",
      jamKerja: "10J 29M",
      totalIstirahat: "-",
      status: "HADIR",
      keterangan: "(OTOMATIS ABSEN PULANG OLEH SISTEM)",
      isOvertime: false,
      isContinuation: false,
    },
    {
      id: 5,
      date: "SABTU, 25 JULI 2026",
      employeeName: "EMUL MULYANA",
      shift: "SECURITY 2",
      nik: "3215052804790002",
      masuk: "18:43",
      istirahat: "00:29",
      selesai: "00:52",
      pulang: "07:37",
      jamKerja: "12J 30M",
      totalIstirahat: "0J 23M",
      status: "HADIR",
      keterangan: "-",
      isOvertime: false,
      isContinuation: false,
    },
    {
      id: 6,
      date: "SABTU, 25 JULI 2026",
      employeeName: "HENDRIK SETIAWAN",
      shift: "TIM STAMPING SHIFT 1",
      nik: "3215190810960003",
      masuk: "07:23",
      istirahat: "17:00",
      selesai: "17:00",
      pulang: "17:01",
      jamKerja: "9J 37M",
      totalIstirahat: "-",
      status: "HADIR",
      keterangan: "-",
      isOvertime: false,
      isContinuation: false,
    },
    {
      id: 7,
      date: "SABTU, 25 JULI 2026",
      employeeName: "HERMAN",
      shift: "TIM STAMPING SHIFT 1",
      nik: "3215182007870002",
      masuk: "07:06",
      istirahat: "12:05",
      selesai: "12:19",
      pulang: "12:20",
      jamKerja: "5J 0M",
      totalIstirahat: "0J 14M",
      status: "IZIN",
      keterangan: "[IZIN (SAAT BEKERJA)] PULANG CEPAT ADA URUSAN KELUARGA",
      isOvertime: false,
      isContinuation: false,
    }
  ];

  const filteredData = mockAttendanceData.filter(r => 
    r.employeeName.toLowerCase().includes(searchName.toLowerCase()) || 
    r.nik.toLowerCase().includes(searchName.toLowerCase())
  );

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-4 font-sans">
      {/* Banner Preview Notice */}
      <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-sm text-xs flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">MODE SIMULASI PREVIEW: LAPORAN REKAPITULASI ABSENSI & LEMBUR</p>
            <p className="text-[11px] opacity-90">Klik tombol "Preview & Export PDF" untuk melihat cetakan PDF lengkap dengan Kop Surat & Lampiran Foto Lembur.</p>
          </div>
        </div>
        <Link href="/preview/overtime-employee">
          <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[11px] font-bold h-7">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Ke Preview Karyawan
          </Button>
        </Link>
      </div>

      {/* Control Bar: Filters & Search */}
      <Card className="border-slate-200 shadow-sm print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tipe Periode</label>
              <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan (26 - 25)</SelectItem>
                  <SelectItem value="custom">Rentang Kustom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Periode Aktif</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center text-xs font-mono font-bold text-slate-700">
                JUMAT, 26 JUNI 2026 - SABTU, 25 JULI 2026
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Cari Karyawan / NIK</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input 
                    placeholder="Cari DENI, EKA, HERMAN..." 
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="h-9 pl-9 text-xs rounded-xl"
                  />
                </div>
                <Button 
                  size="sm" 
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold h-9 rounded-xl shadow-sm"
                  onClick={() => setIsPdfModalOpen(true)}
                >
                  <FileText className="w-4 h-4 mr-1.5" /> Preview & Export PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PAPER CONTAINER (DISAMAKAN 100% DENGAN SCREENSHOT 1) */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-slate-200 overflow-x-auto print:shadow-none print:border-none print:p-0">
        {/* KOP SURAT PERUSAHAAN */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0b1d8a] text-white font-black text-xs flex items-center justify-center rounded-xl">
              MEKANO
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0b1d8a] tracking-tight">MEKANO</h1>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">PT MEKANO INDUSTRIAL PRESISI</h2>
            <p className="text-[10px] text-slate-600 font-medium">JL. RAYA DUKUH, INDUSTRI AGGADITA, KARAWANG TIMUR</p>
          </div>
        </div>

        {/* JUDUL LAPORAN */}
        <div className="text-center py-5 space-y-1">
          <h3 className="text-lg font-black text-slate-900 tracking-wide uppercase">LAPORAN REKAPITULASI ABSENSI</h3>
          <p className="text-xs font-bold text-slate-600">TIPE: BULANAN</p>
          <p className="text-xs font-bold text-slate-600">PERIODE: JUMAT, 26 JUNI 2026 - SABTU, 25 JULI 2026</p>
        </div>

        {/* TABEL REKAPITULASI ABSENSI DISAMAKAN PERSIS DENGAN SCREENSHOT 1 */}
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-y-2 border-slate-900 bg-slate-50 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider">
              <th className="p-2.5 text-center w-10">NO</th>
              <th className="p-2.5 w-36">HARI & TANGGAL</th>
              <th className="p-2.5 w-52">NAMA TENAGA KERJA</th>
              <th className="p-2.5 text-center font-bold">MASUK</th>
              <th className="p-2.5 text-center font-bold">ISTIRAHAT</th>
              <th className="p-2.5 text-center font-bold">SELESAI</th>
              <th className="p-2.5 text-center font-bold">PULANG</th>
              <th className="p-2.5 text-center font-bold">JAM KERJA</th>
              <th className="p-2.5 text-center font-bold">TOTAL ISTIRAHAT</th>
              <th className="p-2.5 text-center font-bold">STATUS</th>
              <th className="p-2.5">KETERANGAN</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredData.map((row) => {
              const isOvertime = row.isOvertime;
              return (
                <tr 
                  key={row.id}
                  className={isOvertime ? "bg-orange-50/90 hover:bg-orange-100/80 font-medium" : "hover:bg-slate-50/80"}
                >
                  {/* NO */}
                  <td className="p-2.5 text-center font-bold text-slate-600">
                    {row.isContinuation ? (
                      <span className="text-orange-600 font-black text-sm">↳</span>
                    ) : (
                      row.id
                    )}
                  </td>

                  {/* HARI & TANGGAL */}
                  <td className="p-2.5 font-bold text-slate-800 text-[11px]">
                    {row.isContinuation ? <span className="text-slate-300 italic text-[10px]">Sama</span> : row.date}
                  </td>

                  {/* NAMA TENAGA KERJA + SHIFT + NIK */}
                  <td className="p-2.5">
                    {row.isContinuation ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-orange-700 font-black">{row.employeeName}</span>
                        <Badge className="bg-orange-500 text-white text-[9px] font-bold">LEMBUR</Badge>
                      </div>
                    ) : (
                      <div>
                        <div className="font-extrabold text-blue-900 text-sm">{row.employeeName}</div>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">{row.shift}</div>
                        <div className="text-[9px] font-mono text-slate-500">NIK: {row.nik}</div>
                      </div>
                    )}
                  </td>

                  {/* WAKTU */}
                  <td className={`p-2.5 text-center font-mono font-bold ${row.masuk !== '-' ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {row.masuk}
                  </td>
                  <td className={`p-2.5 text-center font-mono font-bold ${row.istirahat !== '-' ? 'text-orange-600' : 'text-slate-400'}`}>
                    {row.istirahat}
                  </td>
                  <td className={`p-2.5 text-center font-mono font-bold ${row.selesai !== '-' ? 'text-orange-600' : 'text-slate-400'}`}>
                    {row.selesai}
                  </td>
                  <td className={`p-2.5 text-center font-mono font-bold ${row.pulang !== '-' ? 'text-red-600' : 'text-slate-400'}`}>
                    {row.pulang}
                  </td>

                  {/* DURASI */}
                  <td className="p-2.5 text-center font-bold text-slate-900">{row.jamKerja}</td>
                  <td className="p-2.5 text-center font-bold text-orange-600">{row.totalIstirahat}</td>

                  {/* STATUS */}
                  <td className="p-2.5 text-center">
                    {row.status === "HADIR" && <span className="font-extrabold text-emerald-600">HADIR</span>}
                    {row.status === "TELAT" && <span className="font-extrabold text-red-600">TELAT</span>}
                    {row.status === "IZIN" && <span className="font-extrabold text-purple-600">IZIN</span>}
                    {row.status === "LEMBUR SELESAI" && <span className="font-black text-orange-600">LEMBUR</span>}
                  </td>

                  {/* KETERANGAN & BERKAS */}
                  <td className="p-2.5 text-[10px]">
                    {isOvertime ? (
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] h-6 px-2 rounded-lg print:hidden"
                          onClick={() => setSelectedOvertime(row)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Lihat SPL & Foto
                        </Button>
                        <span className="text-slate-400 text-[9px]">{row.keterangan}</span>
                      </div>
                    ) : (
                      <span className={row.keterangan.includes('TELAT') ? 'text-red-600 font-bold' : 'text-slate-600'}>
                        {row.keterangan}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL POPUP PREVIEW HASIL CETAK EXPORT PDF DENGAN KOP SURAT & LAMPIRAN BUKTI FOTO LEMBUR */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-100 p-4 md:p-6 rounded-2xl">
          <DialogHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3 bg-white p-4 rounded-xl shadow-sm">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" /> Preview Dokumen Cetak PDF (Kop Surat & Lampiran Lembur)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Berikut tampilan cetak PDF resmi lengkap dengan Kop Surat Perusahaan dan Lampiran Foto Bukti Lembur.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePrintPdf} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 rounded-xl shadow">
                <Printer className="w-4 h-4 mr-1.5" /> Cetak / Download PDF
              </Button>
            </div>
          </DialogHeader>

          {/* DOKUMEN HASIL CETAK PDF PREVIEW */}
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-300 space-y-6 text-slate-900 font-sans my-2">
            
            {/* 1. KOP SURAT PERUSAHAAN */}
            <div className="flex justify-between items-center pb-3 border-b-2 border-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#0b1d8a] text-white font-black text-sm flex items-center justify-center rounded-xl">
                  MEKANO
                </div>
                <div>
                  <h1 className="text-2xl font-black text-[#0b1d8a] tracking-tight">PT MEKANO INDUSTRIAL PRESISI</h1>
                  <p className="text-xs text-slate-600 font-medium">JL. RAYA DUKUH, INDUSTRI AGGADITA, KARAWANG TIMUR</p>
                </div>
              </div>
            </div>

            {/* 2. JUDUL LAPORAN */}
            <div className="text-center py-2 space-y-1">
              <h2 className="text-base font-black text-slate-900 tracking-wider uppercase">LAPORAN REKAPITULASI ABSENSI & DOKUMEN LEMBUR</h2>
              <p className="text-xs font-bold text-slate-600">PERIODE: JUMAT, 26 JUNI 2026 - SABTU, 25 JULI 2026</p>
            </div>

            {/* 3. TABEL REKAPITULASI ABSENSI */}
            <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase">
                  <th className="p-2 border-r border-slate-300 text-center w-8">NO</th>
                  <th className="p-2 border-r border-slate-300">HARI & TANGGAL</th>
                  <th className="p-2 border-r border-slate-300">NAMA TENAGA KERJA</th>
                  <th className="p-2 border-r border-slate-300 text-center">MASUK</th>
                  <th className="p-2 border-r border-slate-300 text-center">PULANG</th>
                  <th className="p-2 border-r border-slate-300 text-center">JAM KERJA</th>
                  <th className="p-2 border-r border-slate-300 text-center">STATUS</th>
                  <th className="p-2">KETERANGAN</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={row.id} className={row.isOvertime ? "bg-orange-50 font-semibold" : ""}>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-bold">
                      {row.isContinuation ? <span className="text-orange-600 font-black">↳</span> : row.id}
                    </td>
                    <td className="p-2 border-t border-r border-slate-300">{row.isContinuation ? "Sama" : row.date}</td>
                    <td className="p-2 border-t border-r border-slate-300 font-bold">
                      {row.isContinuation ? `${row.employeeName} (LEMBUR)` : row.employeeName}
                    </td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-mono">{row.masuk}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-mono">{row.pulang}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-bold">{row.jamKerja}</td>
                    <td className="p-2 border-t border-r border-slate-300 text-center font-bold">
                      {row.status}
                    </td>
                    <td className="p-2 border-t border-slate-300">{row.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 4. HUKUM / LAMPIRAN DOKUMEN & BUKTI FOTO LEMBUR (KHUSUS UNTUK LEMBUR) */}
            <div className="pt-4 border-t-2 border-slate-900 space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" /> LAMPIRAN DOKUMEN & BUKTI FOTO LEMBUR TENAGA KERJA
              </h3>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <span className="font-black text-sm text-slate-900">1. KARYAWAN: DENI (NIK: 3215180601940004)</span>
                    <p className="text-xs text-slate-600 font-medium">Tanggal Lembur: Sabtu, 25 Juli 2026 | Durasi: 3 Jam 30 Menit (17:00 - 20:30 WIB)</p>
                  </div>
                  <Badge className="bg-orange-600 text-white font-bold text-xs">BERKAS LEMBUR LENGKAP</Badge>
                </div>

                {/* Grid 3 Foto Bukti (SPL, Foto Awal, Foto Hasil Kerja) */}
                <div className="grid grid-cols-3 gap-4 pt-1">
                  {/* Foto 1: SPL */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">A. SURAT PERINTAH LEMBUR (SPL)</span>
                    <div className="h-32 bg-slate-100 rounded flex flex-col items-center justify-center p-2 border border-dashed border-slate-300">
                      <FileText className="w-8 h-8 text-orange-500 mb-1" />
                      <span className="text-[10px] font-bold text-blue-600">SPL_DENI_25JUL.PDF</span>
                      <span className="text-[9px] text-slate-400">Terverifikasi Koordinator</span>
                    </div>
                  </div>

                  {/* Foto 2: Bukti Awal */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">B. FOTO BUKTI AWAL KERJA</span>
                    <img 
                      src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80" 
                      alt="Foto Awal" 
                      className="h-32 w-full object-cover rounded border"
                    />
                    <p className="text-[10px] text-slate-600 italic">"Overtime repair 3 mesin press bersama Pak Dede"</p>
                  </div>

                  {/* Foto 3: Dokumentasi Hasil */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">C. DOKUMENTASI HASIL KERJA</span>
                    <img 
                      src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80" 
                      alt="Foto Hasil" 
                      className="h-32 w-full object-cover rounded border"
                    />
                    <p className="text-[10px] text-emerald-800 font-bold italic">"Perbaikan 3 mesin selesai 100%"</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TANDA TANGAN KOP LAPORAN */}
            <div className="pt-6 flex justify-between items-end text-xs font-semibold text-slate-800">
              <div>
                <p>Diperiksa Oleh,</p>
                <div className="h-16"></div>
                <p className="font-bold underline">Mbak Intan (HRD/Payroll)</p>
              </div>
              <div className="text-right">
                <p>Karawang, 25 Juli 2026</p>
                <p>Disetujui Oleh,</p>
                <div className="h-16"></div>
                <p className="font-bold underline">Pimpinan PT Mekano Industrial Presisi</p>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detail Lembur untuk Admin */}
      <Dialog open={!!selectedOvertime} onOpenChange={() => setSelectedOvertime(null)}>
        {selectedOvertime && (
          <DialogContent className="sm:max-w-lg bg-white rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                <span>Detail Berkas Lembur: {selectedOvertime.employeeName}</span>
                <Badge className="bg-orange-500 text-white text-[10px]">{selectedOvertime.date}</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Shift: <strong>{selectedOvertime.shift}</strong> | Jam: <strong>{selectedOvertime.masuk} - {selectedOvertime.pulang}</strong> ({selectedOvertime.jamKerja})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Info Google Drive Folder */}
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex items-center justify-between text-blue-900 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <FolderCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Auto Sync ke Google Drive: <strong>{selectedOvertime.driveFolder}</strong></span>
                </div>
                <Badge className="bg-blue-600 text-white text-[9px] shrink-0">Drive Ready</Badge>
              </div>

              {/* Surat Perintah Lembur (SPL) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" /> 1. Surat Perintah Lembur (SPL)
                </div>
                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-mono text-[11px] truncate max-w-[200px]">{selectedOvertime.splName}</span>
                  <a href={selectedOvertime.splUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 font-bold">
                      <Download className="w-3 h-3 mr-1" /> Unduh SPL
                    </Button>
                  </a>
                </div>
              </div>

              {/* Deskripsi Awal & Bukti Foto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> 2. Foto Bukti Awal
                  </div>
                  <img src={selectedOvertime.initialPhoto} alt="Foto Awal" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                  <p className="text-[11px] text-slate-600 italic font-medium">"{selectedOvertime.startDesc}"</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> 3. Dokumentasi Hasil
                  </div>
                  <img src={selectedOvertime.finalPhoto} alt="Foto Hasil" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                  <p className="text-[11px] text-slate-600 italic font-bold text-emerald-800">"{selectedOvertime.finalDesc}"</p>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
