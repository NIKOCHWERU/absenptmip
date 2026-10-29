import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, ArrowLeft, Search, Filter, Printer, Trash2, Eye, FileText, Image as ImageIcon, CheckCircle, Pencil, Calendar, Clock, User as UserIcon, X } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toTitleCase, resolveFileUrl } from "@/lib/utils";
import { TimePicker24h } from "@/components/TimePicker24h";

export default function AdminOvertimeHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const p = new URLSearchParams(window.location.search);
            return p.get("userId") || "all";
        }
        return "all";
    });
    const [filterStartDate, setFilterStartDate] = useState<string>("");
    const [filterEndDate, setFilterEndDate] = useState<string>("");

    const [viewDetail, setViewDetail] = useState<any | null>(null);
    const [editItem, setEditItem] = useState<any | null>(null);
    const [editUserId, setEditUserId] = useState<string>("");
    const [editDate, setEditDate] = useState<string>("");
    const [editStartTime, setEditStartTime] = useState<string>("17:00");
    const [editEndTime, setEditEndTime] = useState<string>("20:30");
    const [editTask, setEditTask] = useState<string>("");
    const [editFinalTask, setEditFinalTask] = useState<string>("");
    const [editStatus, setEditStatus] = useState<string>("completed");
    const [editApproval, setEditApproval] = useState<string>("approved");

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    const formatOvertimeRange = (startTime: Date | string | null, endTime: Date | string | null) => {
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
            durationStr = `${hrs} Jam`;
        } else {
            rangeStr = `${format(start, "d MMMM yyyy HH:mm", { locale: id })} WIB`;
            durationStr = "Berlangsung";
        }

        return { rangeStr, durationStr };
    };

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: requests, isLoading } = useQuery<any[]>({
        queryKey: ["/api/admin/overtimes"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/overtimes/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Gagal menghapus data lembur");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
            toast({
                title: "Berhasil",
                description: "Data penugasan lembur telah dihapus.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        }
    });

    const handleDeleteOvertime = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus permohonan/penugasan lembur ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const editMutation = useMutation({
        mutationFn: async () => {
            if (!editItem) return;
            const startIso = `${editDate}T${editStartTime}:00+07:00`;
            let endIso: string | null = null;
            if (editEndTime) {
                let tempEnd = new Date(`${editDate}T${editEndTime}:00+07:00`);
                let tempStart = new Date(startIso);
                if (tempEnd < tempStart) {
                    tempEnd.setDate(tempEnd.getDate() + 1);
                }
                endIso = tempEnd.toISOString();
            }

            const res = await fetch(`/api/admin/overtimes/${editItem.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startTime: new Date(startIso).toISOString(),
                    endTime: endIso,
                    description: editTask,
                    finalDescription: editFinalTask,
                    status: editStatus,
                    employeeApproval: editApproval,
                    userId: editUserId ? Number(editUserId) : undefined,
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

    const handleOpenEdit = (item: any) => {
        setEditItem(item);
        const itemUserId = item.userId || (item.attendance ? item.attendance.userId : "");
        setEditUserId(itemUserId ? String(itemUserId) : "");

        let dateStr = format(new Date(), "yyyy-MM-dd");
        if (item.date) {
            dateStr = format(new Date(item.date), "yyyy-MM-dd");
        } else if (item.startTime) {
            dateStr = format(new Date(item.startTime), "yyyy-MM-dd");
        }
        setEditDate(dateStr);

        const startHhMm = item.startTime ? format(new Date(item.startTime), "HH:mm") : "17:00";
        setEditStartTime(startHhMm);

        const endHhMm = item.endTime ? format(new Date(item.endTime), "HH:mm") : "20:30";
        setEditEndTime(endHhMm);

        setEditTask(item.description || "");
        setEditFinalTask(item.finalDescription || "");
        setEditStatus(item.status || "completed");
        setEditApproval(item.employeeApproval || "approved");
    };

    const setQuickRangeThisMonth = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        setFilterStartDate(`${y}-${m}-01`);
        setFilterEndDate(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    };

    const setQuickRangeLastMonth = () => {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = prev.getFullYear();
        const m = String(prev.getMonth() + 1).padStart(2, "0");
        const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();
        setFilterStartDate(`${y}-${m}-01`);
        setFilterEndDate(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    };

    const resetFilters = () => {
        setSelectedEmployeeId("all");
        setFilterStartDate("");
        setFilterEndDate("");
        setSearchTerm("");
        setStatusFilter("all");
    };

    const calculateOtHours = (startTime: any, endTime: any) => {
        if (!startTime || !endTime) return 0;
        const s = new Date(startTime);
        const e = new Date(endTime);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
        const diffMins = Math.round((e.getTime() - s.getTime()) / 60000);
        if (diffMins <= 0) return 0;
        const day = s.getDay();
        const isWeekend = day === 0 || day === 6;
        const grossHours = Math.floor(diffMins / 60);
        return isWeekend ? Math.max(0, grossHours - 1) : grossHours;
    };

    const getUserName = (userIdOrName: any) => {
        if (typeof userIdOrName === 'string' && isNaN(Number(userIdOrName))) {
            return toTitleCase(userIdOrName);
        }
        const userObj = users?.find(u => u.id === Number(userIdOrName));
        const name = userObj?.fullName || `User #${userIdOrName}`;
        return toTitleCase(name);
    };

    const getUserObj = (req: any) => {
        if (req.userId) {
            const u = users?.find(user => user.id === req.userId);
            if (u) return u;
        }
        return {
            fullName: req.fullName || "Karyawan",
            nik: req.nik || "-",
            position: req.position || "Operator / Staf",
            branch: req.branch || "Pabrik Utama",
        };
    };

    const handlePrintOvertime = async (req: any) => {
        const userObj = getUserObj(req);
        const name = userObj.fullName || `Karyawan`;
        const nameTitle = toTitleCase(name);
        const nik = userObj.nik || req.nik || '-';
        const position = userObj.position || req.position || '-';
        const branch = userObj.branch || req.branch || '-';
        
        const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
        const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
        const alamatPt = config?.alamatPt || "JL. RAYA DUKUH, INDUSTRI AGGADITA, KARAWANG TIMUR";
        const logoUrl = config?.logoUrl || "/icon-192.png";

        const otDateStr = req.date ? format(new Date(req.date), "d MMMM yyyy", { locale: id }) : (req.createdAt ? format(new Date(req.createdAt), "d MMMM yyyy", { locale: id }) : "-");
        const startTimeStr = req.startTime ? format(new Date(req.startTime), "HH:mm") : "-";
        const endTimeStr = req.endTime ? format(new Date(req.endTime), "HH:mm") : (req.status === 'ongoing' ? 'Berlangsung' : '-');
        const otMins = (req.startTime && req.endTime) ? Math.round((new Date(req.endTime).getTime() - new Date(req.startTime).getTime()) / 60000) : 0;
        const durationStr = otMins > 0 ? `${Math.floor(otMins / 60)} jam ${otMins % 60} menit` : (req.status === 'ongoing' ? 'Sedang Berlangsung' : '-');

        const docYear = new Date(req.createdAt || new Date()).getFullYear();
        const splNo = req.splNumber || `Nomor: ${singkatanPt.replace(/[^a-zA-Z0-9]/g, "")}/HRD/SPL/${req.id.toString().padStart(4, '0')}/${docYear}`;
        const fileName = `SURAT_PERINTAH_LEMBUR_${name.replace(/\s+/g, '_').toUpperCase()}_${format(new Date(req.createdAt || new Date()), "yyyyMMdd")}.html`;
        
        let logoDataUrl = '';
        try {
            const logoRes = await fetch(logoUrl);
            const logoBlob = await logoRes.blob();
            logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(logoBlob);
            });
        } catch (_) {}

        let statusLabel = 'PENDING';
        let statusDesc = 'Penugasan lembur telah diterbitkan dan sedang menunggu respon persetujuan dari karyawan.';
        let statusColor = '#b45309';

        if (req.employeeApproval === 'approved') {
            statusLabel = 'DISETUJUI KARYAWAN';
            statusDesc = 'Instruksi lembur telah disetujui dan dikonfirmasi oleh karyawan yang bersangkutan.';
            statusColor = '#15803d';
        } else if (req.employeeApproval === 'rejected') {
            statusLabel = 'IZIN TIDAK LEMBUR';
            statusDesc = `Karyawan mengajukan izin tidak dapat melaksanakan lembur dikarenakan: "${req.rejectionReason || 'Ada Keperluan'}"`;
            statusColor = '#b91c1c';
        }

        const formattedCreatedAt = format(new Date(req.createdAt || new Date()), "eeee, d MMMM yyyy, 'pukul' HH.mm 'WIB'", { locale: id });

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #000; background: white; padding: 25px 45px; line-height: 1.4; }
    
    .letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; min-height: 50px; }
    .logo-container { flex-shrink: 0; }
    .logo-img { height: 50px; max-width: 140px; object-fit: contain; }
    .company-info { text-align: right; flex-grow: 1; margin-left: 20px; }
    .company-name { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-tagline { font-size: 12px; font-weight: normal; margin-bottom: 2px; }
    .company-address { font-size: 12px; font-weight: normal; color: #334155; line-height: 1.4; }
    
    .divider { border-top: 2px solid #000; margin: 10px 0 15px 0; width: 100%; }
    
    .title-block { text-align: center; margin-bottom: 15px; }
    .title-block h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .title-block .doc-no { font-size: 12px; font-weight: bold; }
    
    .opening-text { margin-bottom: 12px; text-align: justify; }
    
    .formal-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .formal-table th, .formal-table td { border: none; padding: 4px 0; text-align: left; vertical-align: top; }
    .formal-table td.label-col { width: 180px; font-weight: bold; }
    .formal-table td.colon-col { width: 20px; font-weight: bold; text-align: center; }
    
    .status-section { margin: 15px 0; text-align: center; page-break-inside: avoid; }
    .status-title { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
    .status-badge { display: inline-block; border: 2px solid ${statusColor}; color: ${statusColor}; padding: 6px 20px; font-size: 14px; font-weight: bold; border-radius: 4px; background-color: ${statusColor}08; margin-bottom: 6px; }
    .status-desc { font-size: 11px; font-style: italic; color: #4b5563; max-width: 500px; margin: 0 auto; line-height: 1.3; }
    
    .closing-text { margin-bottom: 20px; text-align: justify; }
    
    .signature-section { display: flex; justify-content: center; gap: 100px; margin-top: 35px; page-break-inside: avoid; }
    .sig-box { text-align: center; width: 220px; }
    .sig-label { font-size: 13px; margin-bottom: 70px; }
    .sig-name { font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; display: inline-block; min-width: 150px; }
    .sig-desc { font-size: 12px; margin-top: 4px; }
    
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; text-decoration: none; }
    
    @page {
      size: A4;
      margin: 10mm 15mm;
    }
    @media print {
      body { padding: 0; }
      .btn-wrap { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="logo-container">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">${namaPt}</div>
      ${alamatPt ? `<div class="company-address">${alamatPt}</div>` : `<div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital</div>`}
    </div>
  </div>

  <div class="divider"></div>

  <div class="title-block">
    <h1>SURAT PERINTAH LEMBUR (SPL)</h1>
    <div class="doc-no">${splNo}</div>
  </div>

  <p class="opening-text">
    Berdasarkan kebutuhan operasional dan pertimbangan beban kerja perusahaan, Manajemen Human Resources Department (HRD) dengan ini menerbitkan Surat Perintah Lembur (SPL) kepada tenaga kerja berikut:
  </p>

  <table class="formal-table">
    <tr>
      <td class="label-col">Nama Karyawan</td>
      <td class="colon-col">:</td>
      <td>${nameTitle}</td>
    </tr>
    <tr>
      <td class="label-col">NIK</td>
      <td class="colon-col">:</td>
      <td>${nik}</td>
    </tr>
    <tr>
      <td class="label-col">Jabatan/Posisi</td>
      <td class="colon-col">:</td>
      <td>${position}</td>
    </tr>
    <tr>
      <td class="label-col">Unit Kerja/Cabang</td>
      <td class="colon-col">:</td>
      <td>${branch}</td>
    </tr>
  </table>

  <p class="opening-text" style="margin-top: 15px;">
    Adapun rincian penugasan lembur yang diberikan adalah sebagai berikut:
  </p>

  <table class="formal-table">
    <tr>
      <td class="label-col">Tanggal Diterbitkan</td>
      <td class="colon-col">:</td>
      <td>${formattedCreatedAt}</td>
    </tr>
    <tr>
      <td class="label-col">Tanggal Lembur</td>
      <td class="colon-col">:</td>
      <td>${otDateStr}</td>
    </tr>
    <tr>
      <td class="label-col">Waktu Lembur</td>
      <td class="colon-col">:</td>
      <td>${startTimeStr} s.d. ${endTimeStr} WIB</td>
    </tr>
    <tr>
      <td class="label-col">Estimasi Durasi</td>
      <td class="colon-col">:</td>
      <td>${durationStr}</td>
    </tr>
    <tr>
      <td class="label-col">Uraian Tugas Pekerjaan</td>
      <td class="colon-col">:</td>
      <td>${req.description || 'Pekerjaan Lembur Operasional'}</td>
    </tr>
  </table>

  <div class="status-section">
    <p class="status-title">Status Persetujuan Karyawan</p>
    <div class="status-badge">${statusLabel}</div>
    <p class="status-desc">(${statusDesc})</p>
  </div>

  <p class="closing-text">
    Demikian Surat Perintah Lembur (SPL) ini diterbitkan melalui Sistem Manajemen Kehadiran & Tenaga Kerja Digital ${namaPt} untuk dilaksanakan sebagaimana mestinya dengan penuh tanggung jawab.
  </p>

  <div class="signature-section">
    <div class="sig-box">
      <p class="sig-label">Pemberi Tugas,</p>
      <div class="sig-name">HRM</div>
      <p class="sig-desc">Manajemen HRD</p>
    </div>
    <div class="sig-box">
      <p class="sig-label">Penerima Tugas,</p>
      <div class="sig-name">${nameTitle.toUpperCase()}</div>
      <p class="sig-desc">Karyawan</p>
    </div>
  </div>

  <div class="btn-wrap">
    <a id="dl-btn" class="download-btn" href="#">Cetak / Simpan PDF</a>
  </div>

  <script>
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) {
        btn.onclick = function(e) {
          e.preventDefault();
          window.print();
        };
      }
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };

    const getStatusColor = (approvalStatus: string) => {
        switch (approvalStatus) {
            case 'approved': return 'text-primary bg-primary/5 border-primary/10';
            case 'rejected': return 'text-red-600 bg-red-50 border-red-100';
            default: return 'text-orange-600 bg-orange-50 border-orange-100';
        }
    };

    const employeeUsers = (users || []).filter(u => u.role === "employee" || u.role === "karyawan");
    const displayEmployeeUsers = employeeUsers.length > 0 ? employeeUsers : (users || []);

    const filteredRequests = (requests || []).filter(req => {
        // 1. Filter Karyawan
        if (selectedEmployeeId !== "all") {
            const targetUid = req.userId || (req.attendance ? req.attendance.userId : undefined);
            if (String(targetUid) !== String(selectedEmployeeId)) return false;
        }

        // 2. Filter Rentang Tanggal
        const otDate = req.date ? format(new Date(req.date), "yyyy-MM-dd") : (req.startTime ? format(new Date(req.startTime), "yyyy-MM-dd") : "");
        if (filterStartDate && otDate && otDate < filterStartDate) return false;
        if (filterEndDate && otDate && otDate > filterEndDate) return false;

        // 3. Search text
        const userName = getUserName(req.userId || req.fullName).toLowerCase();
        const nik = (req.nik || "").toLowerCase();
        const desc = (req.description || "").toLowerCase();
        const spl = (req.splNumber || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        const searchPass = !searchTerm || userName.includes(search) || nik.includes(search) || desc.includes(search) || spl.includes(search);

        // 4. Status filter
        let statusPass = true;
        if (statusFilter === "pending") statusPass = req.employeeApproval === "pending";
        else if (statusFilter === "ongoing") statusPass = req.status === "ongoing";
        else if (statusFilter === "completed") statusPass = req.status === "completed";
        else if (statusFilter === "rejected") statusPass = req.employeeApproval === "rejected" || req.status === "cancelled";

        return searchPass && statusPass;
    });

    // Perhitungan total jam lembur pada data terfilter
    const totalFilteredOvertimeHours = filteredRequests.reduce((sum, req) => {
        if (req.status === 'cancelled' || req.employeeApproval === 'rejected') return sum;
        const hours = calculateOtHours(req.startTime, req.endTime);
        return sum + hours;
    }, 0);

    const completedFilteredCount = filteredRequests.filter(req => req.status === 'completed').length;
    const ongoingFilteredCount = filteredRequests.filter(req => req.status === 'ongoing').length;
    const pendingFilteredCount = filteredRequests.filter(req => req.employeeApproval === 'pending').length;

    const selectedEmployeeObj = selectedEmployeeId !== "all" 
        ? users?.find(u => String(u.id) === String(selectedEmployeeId)) 
        : null;

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Penugasan & Lembur</h1>
                        <p className="text-sm text-gray-500">Daftar arsip dan riwayat persetujuan lembur seluruh tenaga kerja.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            className="rounded-lg gap-2 cursor-pointer bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 font-bold"
                            onClick={() => setLocation(`/admin/recap${selectedEmployeeId !== 'all' ? `?userId=${selectedEmployeeId}` : ''}`)}
                        >
                            <Clock className="w-4 h-4 text-amber-600" />
                            Cetak Rekap Lembur (PDF)
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-lg gap-2 cursor-pointer bg-white"
                            onClick={() => setLocation("/admin/overtime-management")}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Kembali
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                        <CardHeader className="bg-white border-b border-gray-100 flex flex-col gap-3 p-4">
                            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                                {/* Search text */}
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Cari nama tenaga kerja, NIK, atau instruksi pekerjaan..."
                                        className="pl-9 rounded-lg border-gray-200 bg-gray-50/60 focus:bg-white transition-all h-10 text-xs"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                {/* Filter Pilih Karyawan */}
                                <div className="w-full sm:w-[260px]">
                                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                        <SelectTrigger className="w-full h-10 rounded-lg text-xs bg-gray-50/60 border-gray-200 font-semibold text-gray-700">
                                            <UserIcon className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
                                            <SelectValue placeholder="Pilih Tenaga Kerja..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectItem value="all" className="font-bold">👥 Semua Tenaga Kerja ({displayEmployeeUsers.length})</SelectItem>
                                            {displayEmployeeUsers.map(u => (
                                                <SelectItem key={u.id} value={String(u.id)}>
                                                    {u.fullName} ({u.nik || "-"})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Filter Status */}
                                <div className="w-full sm:w-[170px]">
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full h-10 rounded-lg text-xs bg-gray-50/60 border-gray-200 font-semibold text-gray-700">
                                            <SelectValue placeholder="Filter Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Status</SelectItem>
                                            <SelectItem value="completed">Selesai & Verified</SelectItem>
                                            <SelectItem value="ongoing">Sedang Berlangsung</SelectItem>
                                            <SelectItem value="pending">Menunggu Konfirmasi</SelectItem>
                                            <SelectItem value="rejected">Ditolak / Dibatalkan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Row 2: Filter Rentang Tanggal & Tombol Preset */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold flex items-center gap-1 text-gray-700">
                                        <Calendar className="w-3.5 h-3.5 text-primary" /> Rentang:
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-semibold text-gray-400">Dari</span>
                                        <Input
                                            type="date"
                                            value={filterStartDate}
                                            onChange={(e) => setFilterStartDate(e.target.value)}
                                            className="w-[135px] h-8 text-xs rounded-lg border-gray-200"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] font-semibold text-gray-400">Sampai</span>
                                        <Input
                                            type="date"
                                            value={filterEndDate}
                                            onChange={(e) => setFilterEndDate(e.target.value)}
                                            className="w-[135px] h-8 text-xs rounded-lg border-gray-200"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={setQuickRangeThisMonth}
                                        className="h-7 text-[10px] rounded-md font-bold text-gray-600 hover:text-gray-900 border-gray-200"
                                    >
                                        Bulan Ini
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={setQuickRangeLastMonth}
                                        className="h-7 text-[10px] rounded-md font-bold text-gray-600 hover:text-gray-900 border-gray-200"
                                    >
                                        Bulan Lalu
                                    </Button>
                                    {(selectedEmployeeId !== "all" || filterStartDate || filterEndDate || statusFilter !== "all" || searchTerm) && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={resetFilters}
                                            className="h-7 text-[10px] rounded-md font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2"
                                        >
                                            <X className="w-3 h-3" /> Reset Filter
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {/* Banner Rekapitulasi Jumlah Lembur Rentang Terpilih */}
                        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-200/80 p-4 sm:p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex flex-col items-center justify-center shadow-sm shrink-0">
                                        <Clock className="w-6 h-6 mb-0.5" />
                                        <span className="text-[8px] font-black uppercase tracking-wider">Lembur</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                                {totalFilteredOvertimeHours} <span className="text-base font-bold text-orange-600">Jam Lembur</span>
                                            </h2>
                                            <span className="text-xs font-black text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
                                                {filteredRequests.length} Penugasan
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span>Tenaga Kerja: <strong className="text-gray-900">{selectedEmployeeObj ? `${selectedEmployeeObj.fullName} (${selectedEmployeeObj.nik || "-"})` : "Semua Tenaga Kerja"}</strong></span>
                                            <span>•</span>
                                            <span>Periode: <strong className="text-gray-900">{filterStartDate ? format(new Date(filterStartDate), "d MMM yyyy", { locale: id }) : "Semua Tanggal"} {filterEndDate ? `s/d ${format(new Date(filterEndDate), "d MMM yyyy", { locale: id })}` : ""}</strong></span>
                                        </div>
                                    </div>
                                </div>

                                {/* Rincian Status Badge */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                                        <div className="text-[10px] font-bold text-emerald-700">Selesai</div>
                                        <div className="text-sm font-black text-gray-900">{completedFilteredCount} Sesi</div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                                        <div className="text-[10px] font-bold text-orange-700">Berlangsung</div>
                                        <div className="text-sm font-black text-gray-900">{ongoingFilteredCount} Sesi</div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                                        <div className="text-[10px] font-bold text-amber-700">Pending</div>
                                        <div className="text-sm font-black text-gray-900">{pendingFilteredCount} Sesi</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                                        <tr>
                                            <th className="px-6 py-4">Tenaga Kerja</th>
                                            <th className="px-6 py-4">Tanggal Lembur</th>
                                            <th className="px-6 py-4">Waktu & Durasi</th>
                                            <th className="px-6 py-4">Status Respon</th>
                                            <th className="px-6 py-4">Uraian Pekerjaan</th>
                                            <th className="px-6 py-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-200" />
                                                </td>
                                            </tr>
                                        ) : filteredRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                    Tidak ditemukan data penugasan lembur.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRequests.map((req) => {
                                                const userName = getUserName(req.userId || req.fullName);
                                                const userObj = getUserObj(req);
                                                const { rangeStr, durationStr } = formatOvertimeRange(req.startTime, req.endTime);

                                                return (
                                                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                                        {/* Column 1: Tenaga Kerja */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs uppercase">
                                                                    {userName.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-gray-900 block">{userName}</span>
                                                                    <span className="text-[10px] text-gray-400 font-mono">NIK: {userObj.nik || req.nik || '-'}</span>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Column 2: Periode Lembur */}
                                                        <td className="px-6 py-4 text-gray-500 font-medium">
                                                            <div className="font-bold text-gray-900 max-w-[200px] leading-snug">{rangeStr}</div>
                                                            <div className="text-[10px] text-orange-600 font-mono font-semibold mt-0.5">📄 {req.splNumber || "SPL Resmi"}</div>
                                                        </td>

                                                        {/* Column 3: Durasi */}
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-md inline-block">{durationStr}</span>
                                                        </td>

                                                        {/* Column 4: Status Respon */}
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(req.employeeApproval)}`}>
                                                                {req.employeeApproval === 'approved' ? 'Disetujui' :
                                                                    req.employeeApproval === 'rejected' ? 'Izin Tidak Lembur' : 'Pending'}
                                                            </span>
                                                        </td>

                                                        {/* Column 5: Uraian Pekerjaan */}
                                                        <td className="px-6 py-4">
                                                            <p className="text-gray-600 line-clamp-2 min-w-[200px] italic">"{req.description || '-'}"</p>
                                                        </td>

                                                        {/* Column 6: Aksi */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50 h-8 w-8 p-0"
                                                                    onClick={() => handleOpenEdit(req)}
                                                                    title="Edit Jam Lembur & Penugasan"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 w-8 p-0"
                                                                    onClick={() => setViewDetail(req)}
                                                                    title="Lihat Detail & Foto Bukti"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-lg text-emerald-600 border-emerald-100 hover:bg-emerald-50 h-8 w-8 p-0"
                                                                    onClick={() => handlePrintOvertime(req)}
                                                                    title="Cetak Surat SPL"
                                                                >
                                                                    <Printer className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-8 w-8 p-0"
                                                                    onClick={() => handleDeleteOvertime(req.id)}
                                                                    disabled={deleteMutation.isPending}
                                                                    title="Hapus Penugasan Lembur"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modal Detail Berkas & Bukti Foto Lembur */}
            <Dialog open={!!viewDetail} onOpenChange={() => setViewDetail(null)}>
                {viewDetail && (
                    <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900 flex items-center justify-between border-b pb-2">
                                <span>Detail Berkas Lembur: {getUserName(viewDetail.userId || viewDetail.fullName)}</span>
                                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {viewDetail.date ? format(new Date(viewDetail.date), "dd MMM yyyy") : "-"}
                                </span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-gray-500">
                                NIK: <strong>{getUserObj(viewDetail).nik || viewDetail.nik || "-"}</strong> | Waktu: <strong>{viewDetail.startTime ? format(new Date(viewDetail.startTime), "HH:mm") : "-"} - {viewDetail.endTime ? format(new Date(viewDetail.endTime), "HH:mm") : "Berlangsung"}</strong>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2 text-xs">
                            {/* Info Status Persetujuan */}
                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-emerald-900 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Status Respon Karyawan: <strong className="uppercase">{viewDetail.employeeApproval === 'approved' ? 'Disetujui' : viewDetail.employeeApproval === 'rejected' ? 'Izin Tidak Lembur' : 'Pending'}</strong></span>
                                </div>
                            </div>

                            {viewDetail.rejectionReason && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                                    <span className="font-bold block text-xs mb-1">Alasan Izin Tidak Lembur Dari Karyawan:</span>
                                    <p className="italic">"{viewDetail.rejectionReason}"</p>
                                </div>
                            )}

                            {/* Surat Perintah Lembur (SPL) */}
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                                <div className="font-semibold text-gray-700 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-orange-600" /> 1. Surat Perintah Lembur ({viewDetail.splNumber || "SPL Resmi"})
                                </div>
                                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-gray-200">
                                    <span className="text-gray-600 font-mono text-[11px] truncate max-w-[220px]">
                                        {viewDetail.splDocumentUrl && !viewDetail.splDocumentUrl.includes('[object')
                                            ? viewDetail.splDocumentUrl
                                            : "Dokumen Surat Perintah Lembur (SPL)"}
                                    </span>
                                    {viewDetail.splDocumentUrl && !viewDetail.splDocumentUrl.includes('[object') ? (
                                        <a href={resolveFileUrl(viewDetail.splDocumentUrl)} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 font-bold">
                                                Unduh SPL
                                            </Button>
                                        </a>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px] text-blue-600 border-blue-200 hover:bg-blue-50 font-bold"
                                            onClick={() => handlePrintOvertime(viewDetail)}
                                        >
                                            Cetak / Unduh SPL
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Deskripsi Awal & Bukti Foto */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                                    <div className="font-semibold text-gray-700 flex items-center gap-1">
                                        <ImageIcon className="w-3.5 h-3.5 text-gray-500" /> 2. Foto Awal Lembur
                                    </div>
                                    {viewDetail.initialProofUrl ? (
                                        <img src={resolveFileUrl(viewDetail.initialProofUrl)} alt="Foto Awal" className="h-32 w-full object-contain bg-slate-900/5 rounded-lg border border-gray-200" />
                                    ) : (
                                        <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs italic border border-dashed">
                                            Belum diupload
                                        </div>
                                    )}
                                    <p className="text-[11px] text-gray-600 italic font-medium">"{viewDetail.description || '-'}"</p>
                                </div>

                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                                    <div className="font-semibold text-gray-700 flex items-center gap-1">
                                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> 3. Dokumentasi Hasil
                                    </div>
                                    {viewDetail.finalProofUrl ? (
                                        <img src={resolveFileUrl(viewDetail.finalProofUrl)} alt="Foto Hasil" className="h-32 w-full object-contain bg-slate-900/5 rounded-lg border border-gray-200" />
                                    ) : (
                                        <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs italic border border-dashed">
                                            Belum diupload / Ongoing
                                        </div>
                                    )}
                                    <p className="text-[11px] text-gray-600 italic font-bold text-emerald-800">"{viewDetail.finalDescription || '-'}"</p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>

            {/* Modal Edit Penugasan / Jam Lembur */}
            <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
                <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-primary" />
                            Edit Jam Lembur & Penugasan
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500">
                            Sesuaikan jam kerja lembur, tanggal pelaksanaan, status, atau pergantian penugasan tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>

                    {editItem && (
                        <div className="space-y-4 py-2">
                            {/* Ganti / Pilih Tenaga Kerja */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <UserIcon className="w-3.5 h-3.5 text-primary" /> Tenaga Kerja
                                </label>
                                <Select value={editUserId} onValueChange={setEditUserId}>
                                    <SelectTrigger className="w-full h-10 rounded-xl text-xs bg-gray-50/60 border-gray-200 font-semibold text-gray-700">
                                        <SelectValue placeholder="Pilih Tenaga Kerja..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[250px]">
                                        {displayEmployeeUsers.map((u: any) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.fullName} ({u.nik || "-"}) - {u.position || "Operator"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tanggal Lembur */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" /> Tanggal Lembur
                                </label>
                                <Input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="h-10 rounded-xl text-xs border-gray-200"
                                />
                            </div>

                            {/* Jam Mulai & Selesai Lembur */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-emerald-600" /> Jam Mulai
                                    </label>
                                    <TimePicker24h
                                        value={editStartTime}
                                        onChange={setEditStartTime}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-orange-600" /> Jam Selesai
                                    </label>
                                    <TimePicker24h
                                        value={editEndTime}
                                        onChange={setEditEndTime}
                                    />
                                </div>
                            </div>

                            {/* Uraian Tugas / Instruksi Lembur */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700">Instruksi / Uraian Tugas</label>
                                <Textarea
                                    rows={2}
                                    value={editTask}
                                    onChange={(e) => setEditTask(e.target.value)}
                                    placeholder="Contoh: Bongkar pasang dies & lembur perbaikan mesin..."
                                    className="rounded-xl text-xs border-gray-200 resize-none"
                                />
                            </div>

                            {/* Status Pelaksanaan & Persetujuan Karyawan */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700">Status Pelaksanaan</label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                        <SelectTrigger className="h-9 rounded-xl text-xs border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Menunggu Konfirmasi</SelectItem>
                                            <SelectItem value="ongoing">Sedang Berlangsung</SelectItem>
                                            <SelectItem value="completed">Selesai (Completed)</SelectItem>
                                            <SelectItem value="cancelled">Dibatalkan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700">Respon Karyawan</label>
                                    <Select value={editApproval} onValueChange={setEditApproval}>
                                        <SelectTrigger className="h-9 rounded-xl text-xs border-gray-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="approved">Disetujui</SelectItem>
                                            <SelectItem value="pending">Belum Merespon</SelectItem>
                                            <SelectItem value="rejected">Izin Tidak Lembur</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditItem(null)}
                            className="rounded-xl text-xs"
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={editMutation.isPending}
                            onClick={() => editMutation.mutate()}
                            className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white"
                        >
                            {editMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
