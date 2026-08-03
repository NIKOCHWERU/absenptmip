import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import {
  FileText, Eye, ArrowLeft, Download, FolderCheck, Search, Image as ImageIcon, Printer, CheckCircle2, ShieldCheck, Clock, Trash2, Loader2, Calendar
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { User, Attendance } from "@shared/schema";
import { resolveFileUrl } from "@/lib/utils";

export default function AdminOvertimeHistoryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<any>({ queryKey: ["/api/config"] });
  const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
  const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
  const alamatPt = config?.alamatPt || import.meta.env.VITE_ALAMAT_PT || "JL. RAYA DUKUH, INDUSTRI AGGADITA, KARAWANG TIMUR";

  // State Filters
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [searchName, setSearchName] = useState("");
  const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Fetch Real Data from Server
  const { data: overtimesList, isLoading: isLoadingOvertimes } = useQuery<any[]>({
    queryKey: ["/api/admin/overtimes"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: attendanceList } = useQuery<Attendance[]>({
    queryKey: ["/api/admin/attendance"],
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/overtimes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus data lembur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      toast({ title: "Berhasil", description: "Data riwayat lembur berhasil dihapus." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus data lembur ini dari riwayat?")) {
      deleteMutation.mutate(id);
    }
  };

  // Filter Data Lembur berdasarkan pencarian
  const filteredOvertimes = (overtimesList || []).filter((ot) => {
    const nameMatch = (ot.fullName || "").toLowerCase().includes(searchName.toLowerCase());
    const nikMatch = (ot.nik || "").toLowerCase().includes(searchName.toLowerCase());
    const descMatch = (ot.description || "").toLowerCase().includes(searchName.toLowerCase());
    return nameMatch || nikMatch || descMatch;
  });

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-4 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Kelola Riwayat Lembur & Laporan Rekapitulasi</h1>
          <p className="text-xs text-slate-500">
            Daftar lengkap arsip penugasan lembur, respon persetujuan karyawan, serta bukti foto pekerjaan lembur real dari database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setLocation("/admin/overtime-management")}
            className="text-xs font-bold rounded-xl gap-1.5 border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" /> Form Penugasan (SPL)
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl gap-1.5 shadow-sm"
            onClick={() => setIsPdfModalOpen(true)}
          >
            <FileText className="w-4 h-4" /> Preview & Export PDF
          </Button>
        </div>
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
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Periode Laporan</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center text-xs font-mono font-bold text-slate-700">
                {format(new Date(), "MMMM yyyy", { locale: id }).toUpperCase()}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Cari Karyawan / NIK / Uraian Tugas</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input 
                    placeholder="Ketik nama karyawan atau NIK..." 
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="h-9 pl-9 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PAPER CONTAINER: TABLE LAPORAN REKAPITULASI ABSENSI & LEMBUR REAL DATA */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-slate-200 overflow-x-auto print:shadow-none print:border-none print:p-0">
        {/* KOP SURAT PERUSAHAAN */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-white font-black text-xs flex items-center justify-center rounded-xl uppercase">
              {singkatanPt.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-primary tracking-tight">{singkatanPt}</h1>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-base font-black text-slate-900 tracking-wide uppercase">{namaPt}</h2>
            <p className="text-[10px] text-slate-600 font-medium uppercase">{alamatPt}</p>
          </div>
        </div>

        {/* JUDUL LAPORAN */}
        <div className="text-center py-5 space-y-1">
          <h3 className="text-lg font-black text-slate-900 tracking-wide uppercase">LAPORAN RIWAYAT LEMBUR DIGITAL & SPL</h3>
          <p className="text-xs font-bold text-slate-600 uppercase">TIPE: {reportType.toUpperCase()}</p>
          <p className="text-xs font-bold text-slate-600">DATABASE REAL SYNC &mdash; {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</p>
        </div>

        {/* TABEL REKAPITULASI ABSENSI & LEMBUR REAL DATA */}
        {isLoadingOvertimes ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-xs text-slate-400">Memuat data riwayat lembur dari server...</p>
          </div>
        ) : filteredOvertimes.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50">
            <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">Belum ada riwayat lembur recorded</p>
            <p className="text-xs text-slate-400">Silakan buat penugasan lembur (SPL) baru atau lakukan pencarian lain.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-y-2 border-slate-900 bg-slate-50 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="p-2.5 text-center w-10">NO</th>
                <th className="p-2.5 w-36">HARI & TANGGAL</th>
                <th className="p-2.5 w-52">NAMA TENAGA KERJA</th>
                <th className="p-2.5 text-center font-bold">JAM MULAI</th>
                <th className="p-2.5 text-center font-bold">JAM SELESAI</th>
                <th className="p-2.5 text-center font-bold">DURASI</th>
                <th className="p-2.5 text-center font-bold">RESPON KARYAWAN</th>
                <th className="p-2.5 text-center font-bold">STATUS PEKERJAAN</th>
                <th className="p-2.5 text-center">AKSI / BERKAS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredOvertimes.map((row, idx) => {
                const startTimeStr = row.startTime ? format(new Date(row.startTime), "HH:mm") : "-";
                const endTimeStr = row.endTime ? format(new Date(row.endTime), "HH:mm") : (row.status === "ongoing" ? "Berlangsung" : "-");
                const otMins = (row.startTime && row.endTime) ? Math.round((new Date(row.endTime).getTime() - new Date(row.startTime).getTime()) / 60000) : 0;
                const durationStr = otMins > 0 ? `${Math.floor(otMins / 60)}J ${otMins % 60}M` : (row.status === "ongoing" ? "Berlangsung" : "-");
                const dateStr = row.date ? format(new Date(row.date), "EEEE, d MMM yyyy", { locale: id }) : "-";

                return (
                  <tr 
                    key={row.id}
                    className="bg-orange-50/70 hover:bg-orange-100/70 transition-colors font-medium"
                  >
                    {/* NO */}
                    <td className="p-2.5 text-center font-bold text-orange-700">
                      {idx + 1}
                    </td>

                    {/* HARI & TANGGAL */}
                    <td className="p-2.5 font-bold text-slate-800 text-[11px]">
                      {dateStr}
                    </td>

                    {/* NAMA TENAGA KERJA + NIK */}
                    <td className="p-2.5">
                      <div>
                        <div className="font-extrabold text-blue-900 text-sm flex items-center gap-1.5">
                          {row.fullName || "Karyawan"}
                          <Badge className="bg-orange-500 text-white text-[9px] font-bold">LEMBUR</Badge>
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{row.position || "Operator"}</div>
                        <div className="text-[9px] font-mono text-slate-400">NIK: {row.nik || "-"}</div>
                      </div>
                    </td>

                    {/* WAKTU */}
                    <td className="p-2.5 text-center font-mono font-bold text-orange-700">
                      {startTimeStr}
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-orange-700">
                      {endTimeStr}
                    </td>

                    {/* DURASI */}
                    <td className="p-2.5 text-center font-extrabold text-slate-900">{durationStr}</td>

                    {/* RESPON KARYAWAN */}
                    <td className="p-2.5 text-center">
                      {row.employeeApproval === "approved" ? (
                        <span className="font-bold text-emerald-700 text-[10px] bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ DISETUJUI KARYAWAN
                        </span>
                      ) : row.employeeApproval === "rejected" ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-red-700 text-[10px] bg-red-100 px-2 py-0.5 rounded-md border border-red-200">
                            ✕ IZIN TIDAK LEMBUR
                          </span>
                          {row.rejectionReason && (
                            <p className="text-[9px] text-red-600 italic">"{row.rejectionReason}"</p>
                          )}
                        </div>
                      ) : (
                        <span className="font-bold text-amber-700 text-[10px] bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse">
                          ⌛ MENUNGGU RESPON
                        </span>
                      )}
                    </td>

                    {/* STATUS PEKERJAAN */}
                    <td className="p-2.5 text-center font-bold">
                      {row.status === "completed" && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">VERIFIED / SELESAI</span>}
                      {row.status === "ongoing" && <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 animate-pulse">SEDANG BERLANGSUNG</span>}
                      {row.status === "cancelled" && <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">DIBATALKAN</span>}
                    </td>

                    {/* KETERANGAN & AKSI */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 print:hidden">
                        <Button 
                          size="sm" 
                          className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] h-7 px-2.5 rounded-lg shadow-sm gap-1"
                          onClick={() => setSelectedOvertime(row)}
                        >
                          <Eye className="w-3.5 h-3.5" /> Lihat SPL & Foto
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 h-7 w-7 p-0 rounded-lg"
                          onClick={() => handleDelete(row.id)}
                          title="Hapus Data"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL POPUP PREVIEW HASIL CETAK EXPORT PDF DENGAN KOP SURAT & LAMPIRAN BUKTI FOTO LEMBUR */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-100 p-4 md:p-6 rounded-2xl">
          <DialogHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-3 bg-white p-4 rounded-xl shadow-sm">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" /> Preview Dokumen Cetak PDF (Kop Surat & Lampiran Lembur Real)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Berikut tampilan cetak PDF resmi lengkap dengan Kop Surat Perusahaan dan Lampiran Foto Bukti Lembur dari database real.
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
                <div className="w-12 h-12 bg-primary text-white font-black text-sm flex items-center justify-center rounded-xl uppercase">
                  {singkatanPt.charAt(0)}
                </div>
                <div>
                  <h1 className="text-2xl font-black text-primary tracking-tight">{namaPt}</h1>
                  <p className="text-xs text-slate-600 font-medium uppercase">{alamatPt}</p>
                </div>
              </div>
            </div>

            {/* 2. JUDUL LAPORAN */}
            <div className="text-center py-2 space-y-1">
              <h2 className="text-base font-black text-slate-900 tracking-wider uppercase">LAPORAN REKAPITULASI ABSENSI & DOKUMEN LEMBUR REAL</h2>
              <p className="text-xs font-bold text-slate-600">PERIODE: {format(new Date(), "EEEE, d MMMM yyyy", { locale: id }).toUpperCase()}</p>
            </div>

            {/* 3. TABEL REKAPITULASI ABSENSI REAL */}
            <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase">
                  <th className="p-2 border-r border-slate-300 text-center w-8">NO</th>
                  <th className="p-2 border-r border-slate-300">HARI & TANGGAL</th>
                  <th className="p-2 border-r border-slate-300">NAMA TENAGA KERJA</th>
                  <th className="p-2 border-r border-slate-300 text-center">JAM MULAI</th>
                  <th className="p-2 border-r border-slate-300 text-center">JAM SELESAI</th>
                  <th className="p-2 border-r border-slate-300 text-center">DURASI</th>
                  <th className="p-2 border-r border-slate-300 text-center">STATUS</th>
                  <th className="p-2">DESKRIPSI TUGAS LEMBUR</th>
                </tr>
              </thead>
              <tbody>
                {filteredOvertimes.map((row, idx) => (
                  <tr key={row.id} className="bg-orange-50 font-semibold border-b border-slate-200">
                    <td className="p-2 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300">{row.date ? format(new Date(row.date), "dd MMM yyyy", { locale: id }) : "-"}</td>
                    <td className="p-2 border-r border-slate-300 font-bold">{row.fullName || "Karyawan"}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-mono">{row.startTime ? format(new Date(row.startTime), "HH:mm") : "-"}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-mono">{row.endTime ? format(new Date(row.endTime), "HH:mm") : "-"}</td>
                    <td className="p-2 border-r border-slate-300 text-center font-bold">
                      {row.startTime && row.endTime ? `${Math.round((new Date(row.endTime).getTime() - new Date(row.startTime).getTime()) / 3600000)} Jam` : "-"}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-center font-bold">{row.status}</td>
                    <td className="p-2 border-slate-300 italic">{row.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 4. LAMPIRAN DOKUMEN & BUKTI FOTO LEMBUR (REAL DATA) */}
            <div className="pt-4 border-t-2 border-slate-900 space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" /> LAMPIRAN DOKUMEN & BUKTI FOTO LEMBUR TENAGA KERJA (REAL DATABASE)
              </h3>

              {filteredOvertimes.map((otItem, idx) => (
                <div key={otItem.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <span className="font-black text-sm text-slate-900">{idx + 1}. KARYAWAN: {otItem.fullName} (NIK: {otItem.nik || "-"})</span>
                      <p className="text-xs text-slate-600 font-medium">Tanggal Lembur: {otItem.date ? format(new Date(otItem.date), "dd MMMM yyyy", { locale: id }) : "-"}</p>
                    </div>
                    <Badge className="bg-orange-600 text-white font-bold text-xs">SPL: {otItem.splNumber || "Resmi"}</Badge>
                  </div>

                  {/* Grid 3 Foto Bukti (SPL, Foto Awal, Foto Hasil Kerja) */}
                  <div className="grid grid-cols-3 gap-4 pt-1">
                    {/* Foto 1: SPL */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block">A. BERKAS DOKUMEN SPL</span>
                      {otItem.splDocumentUrl ? (
                        <a href={resolveFileUrl(otItem.splDocumentUrl)} target="_blank" rel="noreferrer" className="h-32 bg-slate-100 rounded flex flex-col items-center justify-center p-2 border border-dashed border-slate-300">
                          <FileText className="w-8 h-8 text-orange-500 mb-1" />
                          <span className="text-[10px] font-bold text-blue-600 truncate max-w-[120px]">Dokumen SPL</span>
                        </a>
                      ) : (
                        <div className="h-32 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400 italic border border-dashed">
                          SPL Digital System
                        </div>
                      )}
                    </div>

                    {/* Foto 2: Bukti Awal */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block">B. FOTO BUKTI AWAL KERJA</span>
                      {otItem.initialProofUrl ? (
                        <img src={resolveFileUrl(otItem.initialProofUrl)} alt="Foto Awal" className="h-32 w-full object-cover rounded border" />
                      ) : (
                        <div className="h-32 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400 italic border border-dashed">
                          Foto Awal Belum Tersedia
                        </div>
                      )}
                      <p className="text-[10px] text-slate-600 italic">"{otItem.description || '-'}"</p>
                    </div>

                    {/* Foto 3: Dokumentasi Hasil */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block">C. DOKUMENTASI HASIL KERJA</span>
                      {otItem.finalProofUrl ? (
                        <img src={resolveFileUrl(otItem.finalProofUrl)} alt="Foto Hasil" className="h-32 w-full object-cover rounded border" />
                      ) : (
                        <div className="h-32 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400 italic border border-dashed">
                          Foto Hasil Belum Tersedia / Ongoing
                        </div>
                      )}
                      <p className="text-[10px] text-emerald-800 font-bold italic">"{otItem.finalDescription || '-'}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* TANDA TANGAN KOP LAPORAN */}
            <div className="pt-6 flex justify-between items-end text-xs font-semibold text-slate-800">
              <div>
                <p>Diperiksa Oleh,</p>
                <div className="h-16"></div>
                <p className="font-bold underline">SUPER ADMIN HRD</p>
              </div>
              <div className="text-right">
                <p>{format(new Date(), "dd MMMM yyyy", { locale: id })}</p>
                <p>Disetujui Oleh,</p>
                <div className="h-16"></div>
                <p className="font-bold underline">Pimpinan {namaPt}</p>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detail Lembur Real untuk Admin */}
      <Dialog open={!!selectedOvertime} onOpenChange={() => setSelectedOvertime(null)}>
        {selectedOvertime && (
          <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between border-b pb-2">
                <span>Detail Berkas Lembur: {selectedOvertime.fullName}</span>
                <Badge className="bg-orange-500 text-white text-[10px]">{selectedOvertime.date ? format(new Date(selectedOvertime.date), "dd MMM yyyy") : "-"}</Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                NIK: <strong>{selectedOvertime.nik || "-"}</strong> | Jam: <strong>{selectedOvertime.startTime ? format(new Date(selectedOvertime.startTime), "HH:mm") : "-"} - {selectedOvertime.endTime ? format(new Date(selectedOvertime.endTime), "HH:mm") : "Berlangsung"}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Info Database Sync */}
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-emerald-900 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Status Persetujuan Karyawan: <strong className="uppercase">{selectedOvertime.employeeApproval === 'approved' ? 'Disetujui' : selectedOvertime.employeeApproval === 'rejected' ? 'Ditolak' : 'Menunggu'}</strong></span>
                </div>
                <Badge className="bg-emerald-600 text-white text-[9px] shrink-0">Real Sync</Badge>
              </div>

              {/* Surat Perintah Lembur (SPL) */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" /> 1. Surat Perintah Lembur (SPL: {selectedOvertime.splNumber || "Resmi"})
                </div>
                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-600 font-mono text-[11px] truncate max-w-[200px]">{selectedOvertime.splDocumentUrl || "SPL Digital Sistem"}</span>
                  {selectedOvertime.splDocumentUrl && (
                    <a href={resolveFileUrl(selectedOvertime.splDocumentUrl)} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 font-bold">
                        <Download className="w-3 h-3 mr-1" /> Unduh SPL
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* Deskripsi Awal & Bukti Foto */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> 2. Foto Bukti Awal
                  </div>
                  {selectedOvertime.initialProofUrl ? (
                    <img src={resolveFileUrl(selectedOvertime.initialProofUrl)} alt="Foto Awal" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs italic border border-dashed">
                      Belum diupload
                    </div>
                  )}
                  <p className="text-[11px] text-slate-600 italic font-medium">"{selectedOvertime.description || '-'}"</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="font-semibold text-slate-700 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> 3. Dokumentasi Hasil
                  </div>
                  {selectedOvertime.finalProofUrl ? (
                    <img src={resolveFileUrl(selectedOvertime.finalProofUrl)} alt="Foto Hasil" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs italic border border-dashed">
                      Belum diupload / Ongoing
                    </div>
                  )}
                  <p className="text-[11px] text-slate-600 italic font-bold text-emerald-800">"{selectedOvertime.finalDescription || '-'}"</p>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
