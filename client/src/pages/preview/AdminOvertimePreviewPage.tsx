import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, FileText, Download, ShieldAlert, ArrowLeft, FolderCheck, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminOvertimePreviewPage() {
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);

  // Mock data rekap absensi & lembur untuk simulasi
  const mockAttendanceData = [
    {
      id: 101,
      date: "25 Juli 2026",
      employeeName: "Renaldi",
      nik: "EMP-042",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "07:55 WIB",
      checkOut: "17:00 WIB (Sistem Lock)",
      duration: "9 Jam (Normal)",
      status: "Hadir",
    },
    {
      id: 102,
      date: "25 Juli 2026",
      employeeName: "Renaldi",
      nik: "EMP-042",
      type: "overtime",
      shift: "Lembur / Overtime",
      checkIn: "17:00 WIB",
      checkOut: "20:30 WIB",
      duration: "3 Jam 30 Menit",
      status: "Lembur Selesai",
      splUrl: "https://drive.google.com/file/d/demo-spl-renaldi",
      splName: "SPL_Renaldi_25Jul.pdf",
      initialPhoto: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Overtime repair 3 mesin press bersama Pak Dede",
      finalDesc: "Perbaikan 3 mesin selesai 100%, sudah diuji coba siap pakai besok.",
      driveFolder: "Google Drive/Lembur/Renaldi_2026-07-25_Lembur.jpg"
    },
    {
      id: 201,
      date: "25 Juli 2026",
      employeeName: "Komarudin",
      nik: "EMP-015",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "08:02 WIB",
      checkOut: "17:00 WIB (Auto Close 10 min)",
      duration: "8 Jam 58 Menit",
      status: "Hadir",
    },
    {
      id: 202,
      date: "25 Juli 2026",
      employeeName: "Komarudin",
      nik: "EMP-015",
      type: "overtime",
      shift: "Lembur / Overtime",
      checkIn: "17:00 WIB",
      checkOut: "21:00 WIB",
      duration: "4 Jam 00 Menit",
      status: "Lembur Selesai",
      splUrl: "https://drive.google.com/file/d/demo-spl-komarudin",
      splName: "SPL_Komarudin_25Jul.pdf",
      initialPhoto: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
      startDesc: "Pengelasan rangka besi conveyor utama",
      finalDesc: "Pengelasan selesai 4 unit conveyor utama.",
      driveFolder: "Google Drive/Lembur/Komarudin_2026-07-25_Lembur.jpg"
    },
    {
      id: 301,
      date: "25 Juli 2026",
      employeeName: "Dian",
      nik: "EMP-088",
      type: "regular",
      shift: "Shift Pagi (08:00 - 17:00)",
      checkIn: "07:50 WIB",
      checkOut: "17:00 WIB",
      duration: "9 Jam 10 Menit",
      status: "Hadir",
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start">
      <div className="max-w-5xl w-full space-y-4">
        {/* Banner Preview Notification */}
        <div className="bg-amber-500 text-white p-3.5 rounded-2xl shadow-sm text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">MODE SIMULASI / PREVIEW DUMMY ADMIN REKAP</p>
              <p className="text-[11px] opacity-90">Menampilkan alur Rekap Absen Admin dengan Baris Lembur terpisah di bawah absen reguler.</p>
            </div>
          </div>
          <Link href="/preview/overtime-employee">
            <Button size="sm" variant="outline" className="text-amber-900 bg-white border-none text-[11px] h-7 px-2.5 font-semibold">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Uji Tampilan Karyawan
            </Button>
          </Link>
        </div>

        {/* Card Main Admin Preview */}
        <Card className="shadow-md border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <CardTitle className="text-lg font-bold">Preview Rekap Absen & Lembur (Admin Dashboard)</CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  Baris Lembur disisipkan tepat di bawah baris absensi reguler pada tanggal yang sama.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <FolderCheck className="w-4 h-4 text-emerald-400" />
                <span>Penyimpanan Auto: <strong>Google Drive / Lembur</strong></span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Tanggal</TableHead>
                    <TableHead className="text-xs font-bold">Karyawan</TableHead>
                    <TableHead className="text-xs font-bold">Kategori / Shift</TableHead>
                    <TableHead className="text-xs font-bold">Jam Masuk / Mulai</TableHead>
                    <TableHead className="text-xs font-bold">Jam Pulang / Selesai</TableHead>
                    <TableHead className="text-xs font-bold">Total Durasi</TableHead>
                    <TableHead className="text-xs font-bold text-center">Dokumen & Bukti</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {mockAttendanceData.map((row) => {
                    const isOvertime = row.type === "overtime";
                    return (
                      <TableRow 
                        key={row.id}
                        className={isOvertime ? "bg-orange-50/70 border-b-2 border-orange-200 hover:bg-orange-100/60" : "hover:bg-slate-50"}
                      >
                        <TableCell className="text-xs font-medium text-slate-700">{row.date}</TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-slate-900">{row.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{row.nik}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {isOvertime ? (
                            <Badge className="bg-orange-500 text-white font-bold text-[10px] px-2 py-0.5">
                              ⚡ LEMBUR (OVERTIME)
                            </Badge>
                          ) : (
                            <span className="text-slate-600 font-medium">{row.shift}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium">{row.checkIn}</TableCell>
                        <TableCell className="text-xs font-mono font-medium">{row.checkOut}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-800">{row.duration}</TableCell>
                        <TableCell className="text-xs text-center">
                          {isOvertime ? (
                            <Button 
                              size="sm" 
                              className="bg-orange-600 hover:bg-orange-700 text-white text-[11px] h-7 px-2.5 rounded-lg shadow-sm"
                              onClick={() => setSelectedOvertime(row)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Detail & Dokumentasi
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Absen Normal</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Modal Detail Lembur untuk Admin */}
        <Dialog open={!!selectedOvertime} onOpenChange={() => setSelectedOvertime(null)}>
          {selectedOvertime && (
            <DialogContent className="sm:max-w-lg bg-white rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                  <span>Detail Lembur: {selectedOvertime.employeeName}</span>
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
                    <FolderCheck className="w-4 h-4 text-blue-600" />
                    <span>Tersimpan di: <strong>{selectedOvertime.driveFolder}</strong></span>
                  </div>
                  <Badge className="bg-blue-600 text-white text-[9px]">G-Drive Sync</Badge>
                </div>

                {/* Surat Perintah Lembur (SPL) */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-orange-600" /> 1. Surat Perintah Lembur (SPL)
                  </div>
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-600 font-mono text-[11px] truncate max-w-[200px]">{selectedOvertime.splName}</span>
                    <a href={selectedOvertime.splUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50">
                        <Download className="w-3 h-3 mr-1" /> Unduh SPL
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Deskripsi Awal & Bukti Foto */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-semibold text-slate-700">2. Foto Bukti Awal</div>
                    <img src={selectedOvertime.initialPhoto} alt="Foto Awal" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                    <p className="text-[11px] text-slate-600 italic">"{selectedOvertime.startDesc}"</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="font-semibold text-slate-700">3. Dokumentasi Hasil Kerja</div>
                    <img src={selectedOvertime.finalPhoto} alt="Foto Hasil" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                    <p className="text-[11px] text-slate-600 italic font-medium text-emerald-800">"{selectedOvertime.finalDesc}"</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}
