import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Users, Clock, CalendarDays, FileText, FileDown, Eye, ShieldAlert, ArrowLeft, Download, FolderCheck, Search, Image as ImageIcon
} from "lucide-react";
import { Link } from "wouter";

export default function AdminOvertimePreviewPage() {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [searchName, setSearchName] = useState("");
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);

  // Mock data rekap absensi & lembur persis seperti format ekspor asli
  const mockAttendanceData = [
    {
      id: 101,
      date: "Sabtu, 25 Juli 2026",
      employeeName: "RENALDI",
      nik: "EMP-042",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "07:55",
      breakStart: "12:00",
      breakEnd: "13:00",
      checkOut: "17:00 (Lock Shift)",
      duration: "9 Jam",
      status: "HADIR",
      isContinuation: false,
    },
    {
      id: 102,
      date: "Sabtu, 25 Juli 2026",
      employeeName: "RENALDI",
      nik: "EMP-042",
      type: "overtime",
      shift: "LEMBUR / OVERTIME",
      checkIn: "17:00",
      breakStart: "-",
      breakEnd: "-",
      checkOut: "20:30",
      duration: "3 Jam 30 Mnt",
      status: "LEMBUR SELESAI",
      isContinuation: true, // Baris kedua (Lembur) di bawah tanggal & karyawan yang sama
      splUrl: "https://drive.google.com/file/d/demo-spl-renaldi",
      splName: "SPL_RENALDI_25JUL.PDF",
      initialPhoto: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Overtime repair 3 mesin press bersama Pak Dede",
      finalDesc: "Perbaikan 3 mesin selesai 100%, sudah diuji coba siap pakai besok.",
      driveFolder: "Google Drive/Lembur/Renaldi_2026-07-25_Lembur.jpg"
    },
    {
      id: 201,
      date: "Sabtu, 25 Juli 2026",
      employeeName: "KOMARUDIN",
      nik: "EMP-015",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "08:02",
      breakStart: "12:05",
      breakEnd: "13:00",
      checkOut: "17:00 (Auto Close 10 min)",
      duration: "8 Jam 58 Mnt",
      status: "HADIR",
      isContinuation: false,
    },
    {
      id: 202,
      date: "Sabtu, 25 Juli 2026",
      employeeName: "KOMARUDIN",
      nik: "EMP-015",
      type: "overtime",
      shift: "LEMBUR / OVERTIME",
      checkIn: "17:00",
      breakStart: "-",
      breakEnd: "-",
      checkOut: "21:00",
      duration: "4 Jam 00 Mnt",
      status: "LEMBUR SELESAI",
      isContinuation: true,
      splUrl: "https://drive.google.com/file/d/demo-spl-komarudin",
      splName: "SPL_KOMARUDIN_25JUL.PDF",
      initialPhoto: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Pengelasan rangka besi conveyor utama",
      finalDesc: "Pengelasan selesai 4 unit conveyor utama.",
      driveFolder: "Google Drive/Lembur/Komarudin_2026-07-25_Lembur.jpg"
    },
    {
      id: 301,
      date: "Sabtu, 25 Juli 2026",
      employeeName: "DIAN",
      nik: "EMP-088",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "07:50",
      breakStart: "12:00",
      breakEnd: "13:00",
      checkOut: "17:00",
      duration: "9 Jam 10 Mnt",
      status: "HADIR",
      isContinuation: false,
    }
  ];

  const filteredData = mockAttendanceData.filter(r => 
    r.employeeName.toLowerCase().includes(searchName.toLowerCase()) || 
    r.nik.toLowerCase().includes(searchName.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      {/* Banner Preview Notice */}
      <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-sm text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">MODE SIMULASI PREVIEW: Halaman Rekap & Riwayat Absen Admin</p>
            <p className="text-[11px] opacity-90">Tampilan disesuaikan 100% dengan komponen dan format ekspor absensi asli yang ada di aplikasi.</p>
          </div>
        </div>
        <Link href="/preview/overtime-employee">
          <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[11px] font-bold h-7">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Ke Preview Karyawan
          </Button>
        </Link>
      </div>

      {/* Header Halaman Admin */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat & Rekap Absensi Tenaga Kerja</h1>
          <p className="text-xs text-slate-500 mt-1">
            Data kehadiran dan baris lembur otomatis tersusun di bawah tanggal dan nama karyawan yang sama.
          </p>
        </div>

        {/* Action Controls & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold h-9">
            <FileDown className="w-4 h-4 mr-1.5" /> Export Excel Rekap
          </Button>
          <Button size="sm" variant="outline" className="text-slate-700 border-slate-300 text-xs rounded-xl font-semibold h-9">
            <FileText className="w-4 h-4 mr-1.5 text-red-500" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filters Bar (Samakan Persis dengan AttendanceHistoryPage Asli) */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Filter Tipe Laporan */}
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

            {/* Range Info */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Periode Aktif</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center text-xs font-mono text-slate-700">
                26 Juni 2026 - 25 Juli 2026
              </div>
            </div>

            {/* Search Input */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Cari Karyawan / NIK</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  placeholder="Ketik Nama Tenaga Kerja / NIK..." 
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-9 pl-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Rekap Absensi & Lembur (Samakan Persis dengan Format PDF/Excel Asli) */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-4">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Tabel Laporan Kehadiran & Lembur</span>
            <span className="text-xs font-normal text-slate-300">Total Records: {filteredData.length}</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <th className="p-3 text-center w-10">No</th>
                <th className="p-3">Hari & Tanggal</th>
                <th className="p-3">Nama Tenaga Kerja</th>
                <th className="p-3">Shift / Kategori</th>
                <th className="p-3 font-mono">Masuk</th>
                <th className="p-3 font-mono">Pulang</th>
                <th className="p-3">Durasi</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Tindakan / Berkas</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredData.map((row, index) => {
                const isOvertime = row.type === "overtime";
                return (
                  <tr 
                    key={row.id}
                    className={isOvertime ? "bg-orange-50/80 hover:bg-orange-100/70 border-l-4 border-l-orange-500" : "hover:bg-slate-50/80"}
                  >
                    {/* No / Continuation Indicator */}
                    <td className="p-3 text-center font-bold text-slate-400">
                      {row.isContinuation ? (
                        <span className="text-orange-600 text-sm font-black">↳</span>
                      ) : (
                        index + 1
                      )}
                    </td>

                    {/* Tanggal */}
                    <td className="p-3 font-medium text-slate-700">
                      {row.isContinuation ? (
                        <span className="text-slate-300 text-[10px] italic">Sama</span>
                      ) : (
                        row.date
                      )}
                    </td>

                    {/* Nama Karyawan */}
                    <td className="p-3 font-bold text-slate-900">
                      {row.isContinuation ? (
                        <span className="text-slate-300 text-[10px] italic">Sama</span>
                      ) : (
                        <div>
                          <div>{row.employeeName}</div>
                          <div className="text-[10px] font-normal text-slate-400">{row.nik}</div>
                        </div>
                      )}
                    </td>

                    {/* Shift */}
                    <td className="p-3">
                      {isOvertime ? (
                        <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] tracking-wider px-2 py-0.5">
                          ⚡ {row.shift}
                        </Badge>
                      ) : (
                        <span className="text-slate-600 font-medium">{row.shift}</span>
                      )}
                    </td>

                    {/* Masuk & Pulang */}
                    <td className="p-3 font-mono font-semibold text-slate-800">{row.checkIn}</td>
                    <td className="p-3 font-mono font-semibold text-slate-800">{row.checkOut}</td>

                    {/* Durasi */}
                    <td className="p-3 font-bold text-slate-900">{row.duration}</td>

                    {/* Status Badge */}
                    <td className="p-3">
                      {isOvertime ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-orange-200 text-orange-800">
                          {row.status}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          {row.status}
                        </span>
                      )}
                    </td>

                    {/* Actions / Documents */}
                    <td className="p-3 text-center">
                      {isOvertime ? (
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] h-7 px-2.5 rounded-lg shadow-sm font-bold"
                          onClick={() => setSelectedOvertime(row)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Lihat SPL & Dokumen
                        </Button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Absen Reguler</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
                Durasi Lembur: <strong>{selectedOvertime.duration}</strong> ({selectedOvertime.checkIn} - {selectedOvertime.checkOut})
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
