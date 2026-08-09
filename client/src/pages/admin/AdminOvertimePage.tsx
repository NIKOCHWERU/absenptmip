import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { 
  Plus, Calendar, Clock, User as UserIcon, Eye, Printer, Trash2, Check, X, FileText, Send, Upload, ArrowLeft, Image as ImageIcon, CheckCircle, ShieldCheck, AlertCircle, Zap, Search, Filter, Pencil, RefreshCw
} from "lucide-react";
import { User } from "@shared/schema";
import { TimePicker24h } from "@/components/TimePicker24h";
import { formatLongDate } from "@/lib/utils";

// Helper: Calculate dynamic overtime range & duration
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
  const { data: overtimesList, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/overtimes"],
    refetchInterval: 3000,
  });

  // Filter Employees
  const employeeUsers = users?.filter(u => u.role === "employee") || [];

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [viewDetail, setViewDetail] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);

  // Form Fields — Multi-select Karyawan (SPL Baru)
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignDate, setAssignDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [assignStartTime, setAssignStartTime] = useState<string>("17:00");
  const [assignEndTime, setAssignEndTime] = useState<string>("20:30");
  const [assignTask, setAssignTask] = useState<string>("");
  const [assignRefRows, setAssignRefRows] = useState<{ id: string; file: File | null; caption: string }[]>([
    { id: "1", file: null, caption: "" }
  ]);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  // Form Fields — Input Lembur Manual Admin
  const [manualUserId, setManualUserId] = useState<string>("");
  const [manualDate, setManualDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [manualStartTime, setManualStartTime] = useState<string>("17:00");
  const [manualEndTime, setManualEndTime] = useState<string>("20:00");
  const [manualTask, setManualTask] = useState<string>("");
  const [manualStatus, setManualStatus] = useState<string>("completed");

  // Form Fields — Edit Lembur Admin
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("");
  const [editTask, setEditTask] = useState<string>("");
  const [editFinalTask, setEditFinalTask] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("completed");
  const [editApproval, setEditApproval] = useState<string>("approved");

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

  // Open modal SPL — reset selection
  const handleOpenAssignModal = () => {
    setAssignUserIds([]);
    setAssignRefRows([{ id: "1", file: null, caption: "" }]);
    setIsAssignModalOpen(true);
  };

  // Mutation Penugasan Lembur Baru (SPL)
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (assignUserIds.length === 0) throw new Error("Pilih minimal 1 karyawan");

      const validRows = assignRefRows.filter(r => r.file !== null);
      const referenceCaptions = validRows.map(r => r.caption || "Gambar Referensi");

      const results = await Promise.allSettled(
        assignUserIds.map(async (uid) => {
          const formData = new FormData();
          formData.append("userId", uid);
          formData.append("date", assignDate);
          formData.append("startTime", assignStartTime);
          formData.append("endTime", assignEndTime);
          formData.append("description", assignTask);
          if (validRows.length > 0) {
            formData.append("referenceCaptions", JSON.stringify(referenceCaptions));
            validRows.forEach((r) => {
              if (r.file) formData.append("splFiles", r.file);
            });
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
      setAssignRefRows([{ id: "1", file: null, caption: "" }]);
      const successCount = results.filter((r: any) => r.status === "fulfilled").length;
      const totalCount = results.length;
      toast({
        title: "Penugasan Lembur Dikirim!",
        description: successCount === totalCount
          ? `SPL berhasil dikirim ke ${successCount} karyawan.`
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

  // Mutation Input Lembur Manual Admin
  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!manualUserId) throw new Error("Pilih Karyawan terlebih dahulu");
      if (!manualDate || !manualStartTime) throw new Error("Tanggal dan Jam Mulai Wajib Diisi");

      const startIso = `${manualDate}T${manualStartTime}:00+07:00`;
      let endIso: string | null = null;
      if (manualEndTime) {
        let tempEnd = new Date(`${manualDate}T${manualEndTime}:00+07:00`);
        let tempStart = new Date(startIso);
        if (tempEnd < tempStart) {
          tempEnd.setDate(tempEnd.getDate() + 1);
        }
        endIso = tempEnd.toISOString();
      }

      const res = await fetch("/api/admin/overtimes/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: Number(manualUserId),
          date: manualDate,
          startTime: new Date(startIso).toISOString(),
          endTime: endIso,
          description: manualTask || "Lembur Manual Admin",
          status: manualStatus
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Gagal menambah lembur manual");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      setIsManualModalOpen(false);
      setManualUserId("");
      setManualTask("");
      toast({ title: "Berhasil!", description: "Data lembur manual telah ditambahkan." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  // Mutation Edit Lembur Admin
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const res = await fetch(`/api/admin/overtimes/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: editStartTime ? new Date(editStartTime).toISOString() : editItem.startTime,
          endTime: editEndTime ? new Date(editEndTime).toISOString() : null,
          description: editTask,
          finalDescription: editFinalTask,
          status: editStatus,
          employeeApproval: editApproval
        })
      });
      if (!res.ok) throw new Error("Gagal memperbarui data lembur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
      setEditItem(null);
      toast({ title: "Tersimpan", description: "Perubahan data lembur berhasil disimpan." });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
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

  const handleOpenEdit = (item: any) => {
    setEditItem(item);
    setEditStartTime(item.startTime ? format(new Date(item.startTime), "yyyy-MM-dd'T'HH:mm") : "");
    setEditEndTime(item.endTime ? format(new Date(item.endTime), "yyyy-MM-dd'T'HH:mm") : "");
    setEditTask(item.description || "");
    setEditFinalTask(item.finalDescription || "");
    setEditStatus(item.status || "completed");
    setEditApproval(item.employeeApproval || "approved");
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Filtering & Sorting
  const filteredRequests = (overtimesList || []).filter(req => {
    const nameMatch = (req.fullName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const nikMatch = (req.nik || "").toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = (req.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const searchPass = nameMatch || nikMatch || descMatch;

    let statusPass = true;
    if (statusFilter === "pending") statusPass = req.employeeApproval === "pending";
    else if (statusFilter === "ongoing") statusPass = req.status === "ongoing";
    else if (statusFilter === "completed") statusPass = req.status === "completed";
    else if (statusFilter === "rejected") statusPass = req.employeeApproval === "rejected" || req.status === "cancelled";

    return searchPass && statusPass;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
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

  // Calculate Stats
  const totalCount = overtimesList?.length || 0;
  const ongoingCount = overtimesList?.filter(o => o.status === 'ongoing').length || 0;
  const pendingCount = overtimesList?.filter(o => o.employeeApproval === 'pending').length || 0;
  const completedCount = overtimesList?.filter(o => o.status === 'completed').length || 0;

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
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kelola Lembur Tenaga Kerja</h1>
          <p className="text-sm text-gray-500">
            Pusat manajemen penugasan lembur (SPL), input lembur manual, dan verifikasi berkas hasil lembur karyawan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Input Lembur Manual Admin */}
          <Button
            variant="outline"
            className="rounded-lg gap-2 cursor-pointer bg-white border-orange-200 text-orange-700 hover:bg-orange-50 font-bold"
            onClick={() => setIsManualModalOpen(true)}
          >
            <Plus className="w-4 h-4 text-orange-600" />
            + Input Lembur Manual
          </Button>

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
            Rekapitulasi
          </Button>
        </div>
      </div>

      {/* Stats Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-none shadow-xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Penugasan</p>
              <h3 className="text-xl font-black text-gray-900 mt-0.5">{totalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Sedang Berlangsung</p>
              <h3 className="text-xl font-black text-orange-600 mt-0.5">{ongoingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Menunggu Konfirmasi</p>
              <h3 className="text-xl font-black text-amber-600 mt-0.5">{pendingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Selesai & Verified</p>
              <h3 className="text-xl font-black text-emerald-600 mt-0.5">{completedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Section & Filter */}
      <div className="space-y-4">
        <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cari nama karyawan, NIK, atau instruksi pekerjaan..."
                className="pl-9 rounded-lg border-gray-100 bg-gray-50 focus:bg-white transition-all h-10 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-10 rounded-lg text-xs bg-gray-50 border-gray-100">
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu Persetujuan</SelectItem>
                  <SelectItem value="ongoing">Sedang Berlangsung</SelectItem>
                  <SelectItem value="completed">Selesai & Verified</SelectItem>
                  <SelectItem value="rejected">Ditolak / Dibatalkan</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 border border-gray-100 rounded-lg p-1 bg-gray-50">
                <Button
                  variant={sortField === "createdAt" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => toggleSort("createdAt")}
                  className="text-[10px] rounded-md h-7 px-2 font-bold"
                >
                  Terbaru {sortField === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant={sortField === "name" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => toggleSort("name")}
                  className="text-[10px] rounded-md h-7 px-2 font-bold"
                >
                  Nama {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </div>
            </div>
          </CardHeader>

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
                    <th className="px-6 py-4 max-w-[180px]">Uraian Pekerjaan</th>
                    <th className="px-6 py-4 text-center">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary" />
                        <span className="text-xs block mt-2">Memuat data lembur...</span>
                      </td>
                    </tr>
                  ) : sortedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400 italic text-xs">
                        Tidak ada data penugasan lembur yang sesuai filter.
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
                                <p className="text-[10px] text-red-600 italic max-w-[150px] truncate">"{req.rejectionReason}"</p>
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
                                : req.status === "ongoing"
                                ? "text-orange-700 bg-orange-50 border-orange-200"
                                : "text-amber-700 bg-amber-50 border-amber-200"
                            }`}
                          >
                            {req.status === "completed" ? (
                              <><ShieldCheck className="w-3 h-3 text-emerald-600" /> Selesai & Verified</>
                            ) : req.status === "cancelled" ? (
                              <><X className="w-3 h-3 text-gray-500" /> Dibatalkan</>
                            ) : req.status === "ongoing" ? (
                              <><Zap className="w-3 h-3 text-orange-600" /> Sedang Berlangsung</>
                            ) : (
                              <><Clock className="w-3 h-3 text-amber-600" /> Belum Dimulai</>
                            )}
                          </span>
                        </td>

                        {/* Column 6: Uraian Pekerjaan */}
                        <td className="px-6 py-4 max-w-[180px]">
                          <p className="text-gray-600 line-clamp-2 italic text-xs leading-relaxed">"{req.description || '-'}"</p>
                        </td>

                        {/* Column 7: Aksi Admin */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {/* Eye Detail */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-8 px-2 text-xs font-bold text-blue-600 border-blue-100 hover:bg-blue-50"
                              onClick={() => setViewDetail(req)}
                              title="Periksa Laporan & Bukti Foto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Detail</span>
                            </Button>

                            {/* Edit Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg text-amber-600 border-amber-100 hover:bg-amber-50 h-8 w-8 p-0"
                              onClick={() => handleOpenEdit(req)}
                              title="Edit Data Lembur"
                            >
                              <Pencil className="w-3.5 h-3.5" />
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
      <Dialog 
        open={isAssignModalOpen} 
        onOpenChange={(open) => {
          // If preview modal is currently open, DO NOT close assign modal
          if (!open && isPreviewModalOpen) return;
          setIsAssignModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col rounded-2xl p-0 bg-white overflow-hidden shadow-2xl">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 shrink-0 bg-white">
            <DialogTitle className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Form Penugasan Lembur (Buat SPL)
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Isi instruksi penugasan lembur. Surat Perintah Lembur (SPL) akan terkirim langsung ke aplikasi HP karyawan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate(); }} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Field 1: Pilih Beberapa Karyawan */}
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 block">Jam Mulai (24 Jam)</label>
                    <TimePicker24h
                      value={assignStartTime}
                      onChange={(val) => setAssignStartTime(val)}
                      placeholder="17:00"
                    />
                  </div>

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

              {/* Field 5: Tabel Dynamic Upload Gambar Referensi */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800">
                    Upload Gambar Referensi / Panduan Kerja (Opsional)
                  </label>
                  <span className="text-[10px] text-gray-400">Multi Upload + Keterangan</span>
                </div>

                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-orange-50/80 border-b border-orange-100 text-orange-950 font-bold">
                      <tr>
                        <th className="p-2.5 w-1/2">Upload Gambar</th>
                        <th className="p-2.5 w-1/2">Keterangan</th>
                        <th className="p-2.5 w-10 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {assignRefRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-gray-50/50">
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                id={`ref-file-${row.id}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setAssignRefRows(prev => prev.map(r => r.id === row.id ? { ...r, file } : r));
                                }}
                              />
                              <label
                                htmlFor={`ref-file-${row.id}`}
                                className="cursor-pointer px-3 py-1.5 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-100/50 text-[11px] font-bold text-orange-800 flex items-center gap-1.5 shrink-0"
                              >
                                <Upload className="w-3.5 h-3.5 text-orange-600" />
                                {row.file ? "Ganti File" : "Pilih File"}
                              </label>
                              {row.file && (
                                <span className="text-[10px] font-medium text-gray-600 truncate max-w-[120px]" title={row.file.name}>
                                  {row.file.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <Input
                              type="text"
                              placeholder={`Contoh: Panduan Pekerjaan #${idx + 1}...`}
                              value={row.caption}
                              onChange={(e) => {
                                const caption = e.target.value;
                                setAssignRefRows(prev => prev.map(r => r.id === row.id ? { ...r, caption } : r));
                              }}
                              className="h-8 rounded-lg text-xs border-gray-200"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            {assignRefRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setAssignRefRows(prev => prev.filter(r => r.id !== row.id))}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Hapus Baris"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="p-2.5 bg-gray-50 border-t border-gray-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignRefRows(prev => [...prev, { id: Date.now().toString(), file: null, caption: "" }])}
                      className="w-full h-8 rounded-xl text-xs font-bold border-orange-200 text-orange-700 hover:bg-orange-100/60 gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Tambah Gambar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50/80 shrink-0 flex flex-row items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPreviewModalOpen(true)}
                className="rounded-xl text-xs font-bold border-orange-200 text-orange-700 hover:bg-orange-50 gap-1.5"
              >
                <Eye className="w-4 h-4" /> Preview Surat SPL
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-xl text-xs font-semibold">
                  Batal
                </Button>
                <Button type="submit" disabled={assignMutation.isPending} className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2">
                  <Send className="w-4 h-4" /> {assignMutation.isPending ? "Mengirim..." : "Kirim Penugasan"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL LIVE PREVIEW SURAT LEMBUR (SPL) ADMIN                               */}
      {/* ========================================================================= */}
      <Dialog 
        open={isPreviewModalOpen} 
        onOpenChange={(open) => setIsPreviewModalOpen(open)}
      >
        <DialogContent 
          className="max-w-3xl rounded-3xl p-6 bg-white shadow-2xl max-h-[90vh] overflow-y-auto z-50"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setIsPreviewModalOpen(false);
          }}
        >
          <DialogHeader className="border-b pb-3 mb-3">
            <DialogTitle className="text-base font-black text-gray-900 flex items-center justify-between">
              <span>Preview Live Surat Perintah Lembur (SPL)</span>
              <span className="text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                1 Halaman A4 Formal
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm text-xs text-gray-800">
            {/* Kop Surat Resmi */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-gray-900">
              <div className="flex items-center gap-3">
                <img src={(config?.logoUrl && config.logoUrl !== "/logo_elok_buah.jpg") ? config.logoUrl : "/icon-192.png"} alt="Logo Perusahaan" className="h-12 w-auto object-contain" onError={(e) => (e.currentTarget.src = '/icon-192.png')} />
                <div>
                  <h1 className="text-base font-black text-gray-900 uppercase tracking-wider">{config?.namaPt || "PT MEKANO INDUSTRIAL PRESISI"}</h1>
                  {config?.alamatPt && <p className="text-[10px] text-gray-600">{config.alamatPt}</p>}
                </div>
              </div>
            </div>

            {/* Judul Dokumen */}
            <div className="text-center space-y-0.5 py-1">
              <h2 className="text-sm font-black text-blue-900 uppercase underline tracking-wider">SURAT PERINTAH LEMBUR (SPL)</h2>
            </div>

            {/* Section 1: Identitas */}
            <div className="space-y-1">
              <h3 className="bg-blue-50 text-blue-900 font-bold px-3 py-1 rounded-md text-[11px] uppercase border-l-4 border-blue-600">
                I. IDENTITAS TENAGA KERJA / PENERIMA PERINTAH
              </h3>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr className="border">
                    <th className="border p-2 bg-gray-50 text-left w-1/3 font-bold text-gray-700">Nama Karyawan</th>
                    <td className="border p-2 font-bold uppercase text-gray-900">
                      {assignUserIds.length > 0 ? (
                        <div className="space-y-1">
                          {assignUserIds.map((id, idx) => {
                            const u = employeeUsers.find(emp => String(emp.id) === String(id));
                            return (
                              <div key={id} className="text-xs">
                                {assignUserIds.length > 1 ? `${idx + 1}. ` : ""}{u?.fullName || `KARYAWAN #${id}`} {u?.nik ? `(NIK: ${u.nik})` : ""}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        'KARYAWAN DEMO'
                      )}
                    </td>
                  </tr>
                  <tr className="border"><th className="border p-2 bg-gray-50 text-left font-bold text-gray-700">Unit Kerja / Cabang</th><td className="border p-2 font-medium">{config?.namaPt || "PT MEKANO INDUSTRIAL PRESISI"}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Detail Penugasan */}
            <div className="space-y-1">
              <h3 className="bg-blue-50 text-blue-900 font-bold px-3 py-1 rounded-md text-[11px] uppercase border-l-4 border-blue-600">
                II. RINCIAN INSTRUKSI PENUGASAN LEMBUR
              </h3>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr className="border"><th className="border p-2 bg-gray-50 text-left w-1/3 font-bold text-gray-700">Tanggal Lembur</th><td className="border p-2 font-bold">{formatLongDate(assignDate)}</td></tr>
                  <tr className="border"><th className="border p-2 bg-gray-50 text-left font-bold text-gray-700">Waktu Lembur</th><td className="border p-2 font-black text-orange-700">{assignStartTime} - {assignEndTime} WIB</td></tr>
                  <tr className="border"><th className="border p-2 bg-gray-50 text-left font-bold text-gray-700">Uraian Tugas / Instruksi</th><td className="border p-2 italic">"{assignTask || 'Pelaksanaan Pekerjaan Lembur Operasional'}"</td></tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Gambar Referensi */}
            {assignRefRows.some(r => r.file !== null) && (
              <div className="space-y-2">
                <h3 className="bg-blue-50 text-blue-900 font-bold px-3 py-1 rounded-md text-[11px] uppercase border-l-4 border-blue-600">
                  III. GAMBAR REFERENSI & PANDUAN KERJA ADMIN ({assignRefRows.filter(r => r.file !== null).length} GAMBAR)
                </h3>
                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
                  {assignRefRows.filter(r => r.file !== null).map((r, i) => (
                    <div key={i} className="text-center bg-white p-2 border border-amber-200 rounded-lg">
                      <p className="text-[10px] font-bold text-orange-800 mb-1">📷 {r.caption || `Panduan #${i + 1}`}</p>
                      <img src={URL.createObjectURL(r.file!)} alt={`Preview ${i}`} className="max-h-32 mx-auto object-contain rounded border" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center text-[10px] text-gray-400 pt-3 border-t">
              Dokumen Surat Perintah Lembur ini secara otomatis dibuat resmi dan sah melalui Sistem Informasi Absensi {config?.namaPt || "PT MEKANO INDUSTRIAL PRESISI"}.
            </div>
          </div>

          <DialogFooter className="pt-3 flex justify-end">
            <Button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPreviewModalOpen(false);
              }} 
              className="w-full sm:w-auto px-6 h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs cursor-pointer"
            >
              Tutup Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL POPUP 2: INPUT LEMBUR MANUAL ADMIN                                  */}
      {/* ========================================================================= */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-600" /> Input Lembur Manual Admin
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Catat data lembur karyawan secara langsung tanpa melalui alur persetujuan SPL di HP.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); manualMutation.mutate(); }} className="space-y-4 pt-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-gray-700">Pilih Karyawan *</label>
              <Select value={manualUserId} onValueChange={setManualUserId}>
                <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
                  <SelectValue placeholder="Pilih Karyawan..." />
                </SelectTrigger>
                <SelectContent>
                  {employeeUsers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.fullName} (NIK: {u.nik || u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-gray-700">Tanggal Lembur *</label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="h-10 rounded-xl border-gray-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Jam Mulai</label>
                <TimePicker24h
                  value={manualStartTime}
                  onChange={(val) => setManualStartTime(val)}
                  placeholder="17:00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700 block">Jam Selesai</label>
                <TimePicker24h
                  value={manualEndTime}
                  onChange={(val) => setManualEndTime(val)}
                  placeholder="20:00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-gray-700">Uraian Pekerjaan</label>
              <Textarea
                placeholder="Instruksi / Catatan pekerjaan lembur..."
                value={manualTask}
                onChange={(e) => setManualTask(e.target.value)}
                className="rounded-xl border-gray-200 text-xs min-h-[70px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-gray-700">Status Lembur</label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Selesai (Completed)</SelectItem>
                  <SelectItem value="ongoing">Sedang Berlangsung (Ongoing)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 border-t gap-2">
              <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)} className="rounded-xl text-xs">
                Batal
              </Button>
              <Button type="submit" disabled={manualMutation.isPending} className="rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white">
                {manualMutation.isPending ? "Simpan..." : "Simpan Lembur Manual"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL POPUP 3: EDIT DATA LEMBUR ADMIN                                     */}
      {/* ========================================================================= */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white shadow-2xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" /> Edit Data Penugasan Lembur
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Perbarui rincian jam, uraian pekerjaan, atau status lembur karyawan.
            </DialogDescription>
          </DialogHeader>

          {editItem && (
            <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(); }} className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-900 block">{editItem.fullName}</span>
                <span className="text-[10px] text-gray-400 font-mono">NIK: {editItem.nik} | {editItem.splNumber || "SPL Resmi"}</span>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Waktu Mulai</label>
                <Input
                  type="datetime-local"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="h-10 rounded-xl border-gray-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Waktu Selesai</label>
                <Input
                  type="datetime-local"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="h-10 rounded-xl border-gray-200 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Uraian Instruksi Awal</label>
                <Textarea
                  value={editTask}
                  onChange={(e) => setEditTask(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs min-h-[60px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-gray-700">Laporan Hasil Pekerjaan</label>
                <Textarea
                  value={editFinalTask}
                  onChange={(e) => setEditFinalTask(e.target.value)}
                  className="rounded-xl border-gray-200 text-xs min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Status Lembur</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Belum Dimulai</SelectItem>
                      <SelectItem value="ongoing">Sedang Berlangsung</SelectItem>
                      <SelectItem value="completed">Selesai & Verified</SelectItem>
                      <SelectItem value="cancelled">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-700">Respon Karyawan</label>
                  <Select value={editApproval} onValueChange={setEditApproval}>
                    <SelectTrigger className="h-10 rounded-xl border-gray-200 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Disetujui</SelectItem>
                      <SelectItem value="pending">Menunggu</SelectItem>
                      <SelectItem value="rejected">Ditolak / Izin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-3 border-t gap-2">
                <Button type="button" variant="outline" onClick={() => setEditItem(null)} className="rounded-xl text-xs">
                  Batal
                </Button>
                <Button type="submit" disabled={editMutation.isPending} className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white">
                  {editMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL POPUP 4: PERIKSA SURAT & LAPORAN BUKTI FOTO                       */}
      {/* ========================================================================= */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white shadow-2xl">
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
                      <div className="border rounded-xl overflow-hidden h-40 bg-slate-900/5 flex items-center justify-center">
                        <img src={viewDetail.initialProofUrl} alt="Awal Lembur" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-xl h-40 flex items-center justify-center text-gray-400 italic">
                        Belum diupload
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-bold block mb-1 text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Foto Hasil Selesai Lembur
                    </span>
                    {viewDetail.finalProofUrl ? (
                      <div className="border rounded-xl overflow-hidden h-40 bg-slate-900/5 flex items-center justify-center">
                        <img src={viewDetail.finalProofUrl} alt="Hasil Selesai Lembur" className="w-full h-full object-contain" />
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
