import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { 
  Plus, Calendar, Clock, User as UserIcon, Eye, Printer, Trash2, Check, X, FileText, Send, Upload, ArrowLeft, Image as ImageIcon, CheckCircle, ShieldCheck, AlertCircle, Zap
} from "lucide-react";
import { User } from "@shared/schema";
import { TimePicker24h } from "@/components/TimePicker24h";

// Helper: Calculate dynamic overtime range & duration (handles over-midnight e.g. 23:00 to 02:00 = 3 hours)
function calculateOvertimeEstimatedDuration(dateStr: string, startTimeStr: string, endTimeStr: string) {
  if (!dateStr || !startTimeStr || !endTimeStr) return { mins: 0, text: "-", displayRange: "-", isNextDay: false };
  try {
    const start = new Date(`${dateStr}T${startTimeStr}:00`);
    let end = new Date(`${dateStr}T${endTimeStr}:00`);
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    let durationText = "";
    if (hours > 0 && mins > 0) durationText = `${hours} Jam ${mins} Menit`;
    else if (hours > 0) durationText = `${hours} Jam`;
    else durationText = `${mins} Menit`;

    const formattedStart = format(start, "d MMMM yyyy HH:mm", { locale: id });
    const formattedEnd = format(end, "d MMMM yyyy HH:mm", { locale: id });

    return {
      mins: diffMins,
      text: durationText,
      formattedStart,
      formattedEnd,
      displayRange: `${formattedStart} - ${formattedEnd}`,
      isNextDay: end.getDate() !== start.getDate()
    };
  } catch (e) {
    return { mins: 0, text: "-", displayRange: "-", isNextDay: false };
  }
}

function formatOvertimeRange(startTime: Date | string | null, endTime: Date | string | null) {
  if (!startTime) return { rangeStr: "-", durationStr: "-" };
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  let rangeStr = "";
  let durationStr = "-";

  if (end) {
    const isDifferentDay = format(start, "yyyy-MM-dd") !== format(end, "yyyy-MM-dd");
    if (isDifferentDay) {
      rangeStr = `${format(start, "d MMMM yyyy HH:mm", { locale: id })} - ${format(end, "d MMMM yyyy HH:mm", { locale: id })}`;
    } else {
      rangeStr = `${format(start, "d MMMM yyyy", { locale: id })} (${format(start, "HH:mm")} - ${format(end, "HH:mm")} WIB)`;
    }

    const otMins = Math.round((end.getTime() - start.getTime()) / 60000);
    const hrs = Math.floor(otMins / 60);
    const mins = otMins % 60;
    if (hrs > 0 && mins > 0) durationStr = `${hrs} Jam ${mins} Menit`;
    else if (hrs > 0) durationStr = `${hrs} Jam`;
    else if (mins > 0) durationStr = `${mins} Menit`;
  } else {
    rangeStr = `${format(start, "d MMMM yyyy HH:mm", { locale: id })} WIB`;
    durationStr = "Berlangsung";
  }

  return { rangeStr, durationStr };
}

export default function AdminOvertimePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config } = useQuery<any>({ queryKey: ["/api/config"] });
  const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
  const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";

  // Data Real Employees & Real Overtimes
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const { data: overtimesList, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/overtimes"] });

  // Filter Employees
  const employeeUsers = users?.filter(u => u.role === "employee") || [];

  // Modal State for Penugasan Lembur
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<any | null>(null);

  // Form Fields — multi-select karyawan
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignDate, setAssignDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [assignStartTime, setAssignStartTime] = useState<string>("17:00");
  const [assignEndTime, setAssignEndTime] = useState<string>("20:30");
  const [assignTask, setAssignTask] = useState<string>("");
  const [assignSplFile, setAssignSplFile] = useState<File | null>(null);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  const toggleAssignUser = (uid: string) => {
    setAssignUserIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const toggleSelectAllEmployees = () => {
    if (assignUserIds.length === employeeUsers.length) {
      setAssignUserIds([]);
    } else {
      setAssignUserIds(employeeUsers.map(u => String(u.id)));
    }
  };

  // Sorting State
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Open modal — reset selection
  const handleOpenAssignModal = () => {
    setAssignUserIds([]);
    setIsAssignModalOpen(true);
  };

  // Mutation Penugasan Lembur ke beberapa karyawan sekaligus
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (assignUserIds.length === 0) throw new Error("Pilih minimal 1 karyawan");

      const results = await Promise.allSettled(
        assignUserIds.map(async (uid) => {
          const formData = new FormData();
          formData.append("userId", uid);
          formData.append("date", assignDate);
          formData.append("startTime", assignStartTime);
          formData.append("endTime", assignEndTime);
          formData.append("description", assignTask);
          if (assignSplFile) {
            formData.append("splFile", assignSplFile);
          }
          const res = await fetch("/api/admin/overtimes/assign", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || "Gagal");
          }
          return res.json();
        })
      );

      const failed = results.filter(r => r.status === "rejected");
      if (failed.length > 0 && failed.length === results.length) {
        throw new Error("Semua pengiriman penugasan gagal");
      }
      return results;
    },
    onSuccess: (results: any[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      setIsAssignModalOpen(false);
      setAssignUserIds([]);
      setAssignTask("");
      setAssignSplFile(null);
      const successCount = results.filter((r: any) => r.status === "fulfilled").length;
      const totalCount = results.length;
      toast({
        title: "Penugasan Lembur Dikirim!",
        description: successCount === totalCount
          ? `SPL berhasil dikirim ke ${successCount} karyawan. Mereka akan menerima notifikasi pop-up untuk menyetujui.`
          : `SPL dikirim ke ${successCount} dari ${totalCount} karyawan.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Gagal Mengirim SPL",
        description: err.message,
        variant: "destructive",
      });
    }
  });

  // Mutation Verify / Delete
  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/overtimes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (!res.ok) throw new Error("Gagal verifikasi lembur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      setViewDetail(null);
      toast({ title: "Laporan Lembur Diverifikasi!", description: "Status lembur telah ditandai selesai & diverifikasi." });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/overtimes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus lembur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      toast({ title: "Dihapus", description: "Data penugasan lembur telah berhasil dihapus." });
    }
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedRequests = [...(overtimesList || [])].sort((a, b) => {
    let valA: any = a[sortField] || "";
    let valB: any = b[sortField] || "";
    if (sortField === "name") {
      valA = (a.fullName || "").toLowerCase();
      valB = (b.fullName || "").toLowerCase();
    }
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handlePrintSpl = (item: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const empName = item.fullName || "Karyawan";
    const empNik = item.nik || "-";
    const empPos = item.position || "Operator / Staf";
    const { rangeStr, durationStr } = formatOvertimeRange(item.startTime, item.endTime);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SURAT PERINTAH LEMBUR - ${empName}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; line-height: 1.5; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .company-name { font-size: 20px; font-weight: bold; text-transform: uppercase; }
          .title { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px; text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          td { padding: 6px 0; vertical-align: top; }
          .label { width: 180px; font-weight: bold; }
          .colon { width: 20px; font-weight: bold; text-align: center; }
          .sig-container { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; }
          .sig-box { width: 200px; }
          .sig-line { margin-top: 60px; border-top: 1px solid #000; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${namaPt}</div>
            <div style="font-size: 11px; color: #555;">Sistem Manajemen Kehadiran & Lembur Terintegrasi</div>
          </div>
        </div>
        <div class="title">SURAT PERINTAH LEMBUR (SPL)</div>
        <div style="font-size: 12px; font-weight: bold; text-align: right; margin-bottom: 15px;">No: ${item.splNumber || `SPL/MIP/${format(new Date(), 'yyyyMMdd')}/001`}</div>
        <p>Berdasarkan kebutuhan operasional perusahaan, dengan ini Manajer HRD memberikan instruksi lembur kepada:</p>
        <table>
          <tr><td class="label">Nama Karyawan</td><td class="colon">:</td><td><strong>${empName}</strong></td></tr>
          <tr><td class="label">NIK Karyawan</td><td class="colon">:</td><td>${empNik}</td></tr>
          <tr><td class="label">Jabatan / Bagian</td><td class="colon">:</td><td>${empPos}</td></tr>
          <tr><td class="label">Periode Lembur</td><td class="colon">:</td><td><strong>${rangeStr}</strong></td></tr>
          <tr><td class="label">Estimasi Durasi</td><td class="colon">:</td><td><strong>${durationStr}</strong></td></tr>
          <tr><td class="label">Uraian Pekerjaan</td><td class="colon">:</td><td>${item.description || 'Pekerjaan Lembur'}</td></tr>
          <tr><td class="label">Status Persetujuan</td><td class="colon">:</td><td><strong>${item.employeeApproval === 'approved' ? 'DISETUJUI KARYAWAN' : item.employeeApproval === 'rejected' ? 'DITOLAK / IZIN TIDAK LEMBUR' : 'MENUNGGU KONFIRMASI'}</strong></td></tr>
        </table>
        <p>Demikian Surat Perintah Lembur ini diterbitkan untuk dilaksanakan sebagaimana mestinya dengan penuh tanggung jawab.</p>
        <div class="sig-container">
          <div class="sig-box"><p>Pemberi Tugas,</p><div class="sig-line">SUPER ADMIN HRD</div></div>
          <div class="sig-box"><p>Penerima Tugas,</p><div class="sig-line">${empName}</div></div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Permohonan & Penugasan Lembur</h1>
          <p class="text-sm text-gray-500">
            Penugasan lembur (SPL) ke seluruh karyawan. Karyawan akan langsung menerima notifikasi pop-up modal di HP untuk menyetujui atau mengajukan izin tidak lembur.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Modal Penugasan Lembur */}
          <Button
            className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 cursor-pointer shadow-sm font-bold"
            onClick={handleOpenAssignModal}
          >
            <Plus className="w-4 h-4" />
            + Penugasan Lembur Baru (SPL)
          </Button>

          {/* Tombol Lihat Rekap Absensi */}
          <Button
            variant="outline"
            className="rounded-lg gap-2 cursor-pointer bg-white"
            onClick={() => setLocation("/admin/recap")}
          >
            <Calendar className="w-4 h-4" />
            Rekapitulasi Absensi & Lembur
          </Button>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Daftar Penugasan & Riwayat Lembur</h2>
            <p className="text-sm text-gray-500">Daftar lengkap lembur aktif, status persetujuan karyawan, dan bukti foto hasil lembur.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={sortField === "createdAt" ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSort("createdAt")}
              className="text-xs rounded-full h-8 px-3"
            >
              Terbaru {sortField === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
            </Button>
            <Button
              variant={sortField === "name" ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSort("name")}
              className="text-xs rounded-full h-8 px-3"
            >
              Nama {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </Button>
          </div>
        </div>

        {/* Card Table Container */}
        <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden mt-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4">Tenaga Kerja</th>
                    <th className="px-6 py-4">Tanggal & SPL</th>
                    <th className="px-6 py-4">Jam & Durasi</th>
                    <th className="px-6 py-4">Respon Karyawan</th>
                    <th className="px-6 py-4">Status Lembur</th>
                    <th className="px-6 py-4 max-w-[200px]">Uraian Pekerjaan</th>
                    <th className="px-6 py-4 text-center">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400 italic text-xs">
                        Belum ada data penugasan lembur. Klik tombol "+ Penugasan Lembur Baru (SPL)" untuk menambah.
                      </td>
                    </tr>
                  ) : sortedRequests.map((req) => {
                    const empName = req.fullName || "Karyawan";
                    const empNik = req.nik || "-";
                    const { rangeStr, durationStr } = formatOvertimeRange(req.startTime, req.endTime);

                    return (
                      <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Column 1: Tenaga Kerja */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center uppercase shrink-0">
                              {empName.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 block">{empName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">NIK: {empNik}</span>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Periode & SPL */}
                        <td className="px-6 py-4 text-gray-700 font-medium">
                          <div className="font-bold text-xs max-w-[200px] leading-snug">{rangeStr}</div>
                          <div className="text-[10px] text-orange-600 font-mono font-semibold mt-0.5">📄 {req.splNumber || "SPL Resmi"}</div>
                        </td>

                        {/* Column 3: Durasi Lembur */}
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-md inline-block">{durationStr}</span>
                        </td>

                        {/* Column 4: Respon Karyawan */}
                        <td className="px-6 py-4">
                          {req.employeeApproval === "approved" ? (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Disetujui Karyawan
                            </span>
                          ) : req.employeeApproval === "rejected" ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-red-50 text-red-700 border-red-200 inline-flex items-center gap-1">
                                <X className="w-3 h-3 text-red-600" /> Izin Tidak Lembur
                              </span>
                              {req.rejectionReason && (
                                <p className="text-[10px] text-red-600 italic">"{req.rejectionReason}"</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 inline-flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-600" /> Menunggu Konfirmasi
                            </span>
                          )}
                        </td>

                        {/* Column 5: Status Lembur */}
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border whitespace-nowrap flex items-center gap-1 w-fit ${
                              req.status === "completed"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : req.status === "cancelled"
                                ? "text-gray-500 bg-gray-50 border-gray-200"
                                : "text-orange-700 bg-orange-50 border-orange-200"
                            }`}
                          >
                            {req.status === "completed" ? (
                              <><ShieldCheck className="w-3 h-3 text-emerald-600" /> Selesai & Verified</>
                            ) : req.status === "cancelled" ? (
                              <><X className="w-3 h-3 text-gray-500" /> Dibatalkan</>
                            ) : (
                              <><Clock className="w-3 h-3 text-orange-600" /> Sedang Berlangsung</>
                            )}
                          </span>
                        </td>

                        {/* Column 6: Uraian Pekerjaan */}
                        <td className="px-6 py-4 max-w-[200px]">
                          <p className="text-gray-600 line-clamp-2 italic text-xs leading-relaxed">"{req.description || '-'}"</p>
                        </td>

                        {/* Column 7: Aksi Admin */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Eye Detail */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 px-2.5 gap-1 text-xs font-bold text-blue-600 border-blue-100 hover:bg-blue-50"
                              onClick={() => setViewDetail(req)}
                              title="Periksa Laporan & Bukti Foto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </Button>

                            {/* Print SPL */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg text-emerald-600 border-emerald-100 hover:bg-emerald-50 h-8 w-8 p-0"
                              onClick={() => handlePrintSpl(req)}
                              title="Cetak Surat SPL"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>

                            {/* Delete */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-8 w-8 p-0"
                              onClick={() => {
                                if (confirm("Apakah Anda yakin ingin menghapus data penugasan lembur ini?")) {
                                  deleteMutation.mutate(req.id);
                                }
                              }}
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* MODAL POPUP 1: FORM PENUGASAN LEMBUR (SPL)                                 */}
      {/* ========================================================================= */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-2xl p-6 bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Form Penugasan Lembur (Buat SPL)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Isi instruksi penugasan lembur. Surat Perintah Lembur (SPL) akan terkirim langsung ke aplikasi HP karyawan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate(); }} className="space-y-4 py-2">
            {/* Field 1: Pilih Beberapa Karyawan (Custom Dropdown Multi-select) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700">Tenaga Kerja / Karyawan *</label>
                <button
                  type="button"
                  onClick={toggleSelectAllEmployees}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  {assignUserIds.length === employeeUsers.length ? "✗ Batal Semua" : "✓ Pilih Semua"}
                </button>
              </div>

              {/* Dropdown trigger button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsEmployeeDropdownOpen(prev => !prev)}
                  className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl h-10 px-3 text-xs font-semibold bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-1 text-left truncate text-gray-700">
                    {assignUserIds.length === 0
                      ? "Pilih karyawan..."
                      : assignUserIds.length === employeeUsers.length
                      ? `Semua karyawan dipilih (${assignUserIds.length} orang)`
                      : assignUserIds.length === 1
                      ? employeeUsers.find(u => String(u.id) === assignUserIds[0])?.fullName || "1 karyawan"
                      : `${assignUserIds.length} karyawan dipilih`
                    }
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isEmployeeDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* Dropdown panel */}
                {isEmployeeDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                      {employeeUsers.map(u => (
                        <label
                          key={u.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                            assignUserIds.includes(String(u.id)) ? "bg-primary/5" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary rounded shrink-0"
                            checked={assignUserIds.includes(String(u.id))}
                            onChange={() => toggleAssignUser(String(u.id))}
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-black text-[10px] flex items-center justify-center shrink-0 uppercase">
                              {u.fullName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-gray-800">{u.fullName}</span>
                              <span className="text-[10px] text-gray-400 font-mono">NIK: {u.nik || u.username}</span>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setIsEmployeeDropdownOpen(false)}
                        className="w-full text-xs font-bold text-primary text-center hover:underline"
                      >
                        Selesai Pilih ({assignUserIds.length} dipilih)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {assignUserIds.length === 0 && (
                <p className="text-[10px] text-red-500 font-semibold">* Pilih minimal 1 karyawan</p>
              )}
            </div>

            {/* Field 2 & 3: Tanggal & Waktu 24 Jam */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Tanggal Lembur</label>
                  {assignDate && (
                    <span className="text-[11px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      Format DD/MM/YYYY: {format(new Date(assignDate), "dd/MM/yyyy", { locale: id })}
                    </span>
                  )}
                </div>
                <Input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Jam Mulai 24 Jam */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">Jam Mulai (24 Jam)</label>
                  <TimePicker24h
                    value={assignStartTime}
                    onChange={(val) => setAssignStartTime(val)}
                    placeholder="17:00"
                  />
                </div>

                {/* Estimasi Selesai 24 Jam */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">Estimasi Selesai (24 Jam)</label>
                  <TimePicker24h
                    value={assignEndTime}
                    onChange={(val) => setAssignEndTime(val)}
                    placeholder="20:30"
                  />
                </div>
              </div>

              {/* Dynamic Overtime Estimate Banner */}
              {assignDate && assignStartTime && assignEndTime && (() => {
                const calc = calculateOvertimeEstimatedDuration(assignDate, assignStartTime, assignEndTime);
                return (
                  <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-2xl space-y-1 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-orange-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-orange-500 fill-orange-500" /> Estimasi Durasi Lembur
                      </span>
                      <span className="font-black text-xs text-orange-700 bg-orange-200/80 px-2.5 py-0.5 rounded-full">
                        ⚡ {calc.text}
                      </span>
                    </div>
                    <p className="text-xs text-orange-900 font-bold pt-1">
                      Periode: <span className="font-mono text-xs">{calc.displayRange}</span>
                    </p>
                    {calc.isNextDay && (
                      <p className="text-[11px] text-orange-600 font-semibold italic">
                        * Lembur melewati tengah malam dan berakhir pada hari berikutnya ({calc.formattedEnd}).
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Field 4: Uraian Tugas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Uraian Pekerjaan Lembur *</label>
              <Textarea
                placeholder="Contoh: Perbaikan Mesin Production Line & Maintenance Listrik..."
                value={assignTask}
                onChange={(e) => setAssignTask(e.target.value)}
                className="rounded-xl border-gray-200 min-h-[90px] text-xs leading-relaxed"
              />
            </div>

            {/* Field 5: Upload Dokumen SPL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Upload Lampiran Berkas SPL (Opsional PDF/Gambar)</label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setAssignSplFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="spl-upload-modal"
                />
                <label htmlFor="spl-upload-modal" className="cursor-pointer block">
                  <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                  <span className="text-xs font-semibold text-gray-600 block">
                    {assignSplFile ? assignSplFile.name : "Klik untuk upload lampiran SPL"}
                  </span>
                  <span className="text-[10px] text-gray-400">PDF, JPG, PNG (Maks 5MB)</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-xl text-xs font-semibold">
                Batal
              </Button>
              <Button type="submit" disabled={assignMutation.isPending} className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2">
                <Send className="w-4 h-4" /> {assignMutation.isPending ? "Mengirim..." : "Kirim Penugasan ke HP Karyawan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL POPUP 2: PERIKSA SURAT & LAPORAN BUKTI FOTO                       */}
      {/* ========================================================================= */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-6 bg-white">
          {viewDetail && (
            <div>
              <DialogHeader className="border-b pb-3 mb-4">
                <DialogTitle className="text-lg font-black text-gray-900 flex items-center justify-between">
                  <span>Pemeriksaan Berkas & Bukti Foto Lembur</span>
                  <span className={`text-[10px] px-2.5 py-1 rounded-lg border uppercase ${
                    viewDetail.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}>
                    {viewDetail.status === 'completed' ? 'Telah Diperiksa & Verified' : 'Sedang Berlangsung'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {viewDetail.fullName} — NIK: {viewDetail.nik} ({viewDetail.date})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs text-gray-700">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 block font-bold text-[10px] uppercase">Waktu Lembur</span>
                    <span className="font-extrabold text-gray-900 text-sm">
                      {viewDetail.startTime ? format(new Date(viewDetail.startTime), "HH:mm") : "-"} - {viewDetail.endTime ? format(new Date(viewDetail.endTime), "HH:mm") : "Berlangsung"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold text-[10px] uppercase">Persetujuan Karyawan</span>
                    <span className="font-extrabold text-primary text-sm uppercase">
                      {viewDetail.employeeApproval === 'approved' ? 'Disetujui Karyawan' : viewDetail.employeeApproval === 'rejected' ? 'Ditolak Karyawan' : 'Menunggu Konfirmasi'}
                    </span>
                  </div>
                </div>

                {viewDetail.rejectionReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                    <span className="font-bold block text-xs mb-1">Alasan Izin Tidak Lembur Dari Karyawan:</span>
                    <p className="italic">"{viewDetail.rejectionReason}"</p>
                  </div>
                )}

                <div>
                  <span className="text-gray-400 font-bold block mb-1">Instruksi / Uraian Tugas Awal:</span>
                  <p className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-medium italic text-gray-800">
                    "{viewDetail.description || '-'}"
                  </p>
                </div>

                {viewDetail.finalDescription && (
                  <div>
                    <span className="text-emerald-700 font-bold block mb-1">Laporan Hasil Pekerjaan (Oleh Karyawan):</span>
                    <p className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 font-medium text-emerald-900">
                      "{viewDetail.finalDescription}"
                    </p>
                  </div>
                )}

                {/* Bukti Foto Modal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="font-bold block mb-1 text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> Foto Awal Mulai Lembur
                    </span>
                    {viewDetail.initialProofUrl ? (
                      <div className="border rounded-xl overflow-hidden h-36 bg-gray-100">
                        <img src={viewDetail.initialProofUrl} alt="Awal Lembur" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-xl h-36 flex items-center justify-center text-gray-400 italic">
                        Belum diupload
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-bold block mb-1 text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Foto Hasil Selesai Lembur
                    </span>
                    {viewDetail.finalProofUrl ? (
                      <div className="border rounded-xl overflow-hidden h-36 bg-gray-100">
                        <img src={viewDetail.finalProofUrl} alt="Hasil Selesai Lembur" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-xl h-36 flex items-center justify-center text-gray-400 italic">
                        Belum diupload / Berlangsung
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 pt-3 border-t flex flex-row items-center justify-between gap-2">
                <Button onClick={() => handlePrintSpl(viewDetail)} variant="outline" className="rounded-xl text-xs font-bold gap-2">
                  <Printer className="w-4 h-4" /> Cetak Surat SPL
                </Button>
                
                <div className="flex items-center gap-2">
                  {viewDetail.status !== "completed" && (
                    <Button 
                      onClick={() => verifyMutation.mutate(viewDetail.id)} 
                      disabled={verifyMutation.isPending}
                      className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Tandai Berkas Verified
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setViewDetail(null)} className="rounded-xl text-xs font-semibold">
                    Tutup
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
