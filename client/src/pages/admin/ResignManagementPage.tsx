import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    Plus,
    Search,
    Trash2,
    Edit2,
    Eye,
    FileText,
    Download,
    Calendar,
    UserMinus,
    AlertCircle,
    User,
    ChevronLeft,
    Printer
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface ResignationData {
    id: number;
    userId: number;
    resignDate: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    documentUrl: string | null;
    createdAt: string;
    user: {
        fullName: string;
        nik: string | null;
        branch: string | null;
        position: string | null;
    };
}

interface ActiveEmployee {
    id: number;
    fullName: string;
    nik: string | null;
    branch: string | null;
    position: string | null;
    role: string;
    employmentStatus: string | null;
}

export default function ResignManagementPage() {
    const { user: currentUser } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    
    // Modals state
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [openViewModal, setOpenViewModal] = useState(false);
    
    // Selected data for edit/view
    const [selectedResign, setSelectedResign] = useState<ResignationData | null>(null);
    
    // Form fields state
    const [formUserId, setFormUserId] = useState("");
    const [formResignDate, setFormResignDate] = useState("");
    const [formReason, setFormReason] = useState("");
    const [formFile, setFormFile] = useState<File | null>(null);
    const [employeeQuery, setEmployeeQuery] = useState("");

    // Queries
    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
    const singkatanPt = config?.singkatanPt || config?.namaPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
    const alamatPt = config?.alamatPt || import.meta.env.VITE_ALAMAT_PT || "";
    const logoUrl = config?.logoUrl && config.logoUrl !== "/logo_elok_buah.jpg" ? config.logoUrl : null;

    const { data: resignationsList = [], isLoading: isLoadingResignations } = useQuery<ResignationData[]>({
        queryKey: ["/api/admin/resignations"],
    });

    const { data: employees = [] } = useQuery<ActiveEmployee[]>({
        queryKey: ["/api/admin/users"],
    });

    const handlePrintReport = (items: ResignationData[]) => {
        const escapeHtml = (str: string) => (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const logoImgHtml = logoUrl ? `<img src="${logoUrl}" style="height:48px; max-width:140px; object-fit:contain;" />` : '';

        const rowsHtml = items.map((r, index) => `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td style="font-weight: bold;">${escapeHtml(r.user?.fullName || '-')}</td>
                <td style="font-family: monospace;">${escapeHtml(r.user?.nik || '-')}</td>
                <td>${escapeHtml(r.user?.position || '-')}</td>
                <td>${escapeHtml(r.user?.branch || '-')}</td>
                <td style="font-weight: bold;">${format(new Date(r.resignDate), "dd MMMM yyyy", { locale: id })}</td>
                <td style="text-transform: uppercase; font-weight: bold; color: ${r.status === 'approved' ? '#166534' : r.status === 'rejected' ? '#991b1b' : '#d97706'};">
                    ${r.status === 'approved' ? 'DISETUJUI' : r.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU'}
                </td>
                <td>${escapeHtml(r.reason || '-')}</td>
            </tr>
        `).join('');

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>LAPORAN TENAGA KERJA RESIGN - ${escapeHtml(singkatanPt)}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 8pt; color: #0f172a; margin: 0; padding: 15px; }
        .letterhead { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .company-block h1 { font-size: 16px; margin: 0; text-transform: uppercase; font-weight: bold; }
        .company-block p { font-size: 9px; margin: 2px 0 0; color: #475569; }
        .title { text-align: center; margin: 15px 0 10px; }
        .title h2 { font-size: 13pt; margin: 0; text-transform: uppercase; font-weight: 800; }
        .title p { font-size: 8pt; color: #64748b; margin: 2px 0 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
        th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; }
        td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; font-size: 7.5pt; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
        .sig-box { text-align: center; width: 200px; }
        .sig-line { margin-top: 55px; border-bottom: 1px solid #0f172a; font-weight: bold; }
    </style>
</head>
<body>
    <div class="letterhead">
        <div>${logoImgHtml}</div>
        <div class="company-block" style="text-align: right;">
            <h1>${escapeHtml(namaPt)}</h1>
            <p>${escapeHtml(alamatPt || "Sistem Informasi Manajemen Presensi & Tenaga Kerja")}</p>
        </div>
    </div>
    <div class="title">
        <h2>LAPORAN REKAPITULASI TENAGA KERJA RESIGN</h2>
        <p>Dicetak pada: ${format(new Date(), "dd MMMM yyyy, HH:mm", { locale: id })} WIB</p>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width: 5%;">NO</th>
                <th style="width: 20%;">TENAGA KERJA</th>
                <th style="width: 15%;">NIK</th>
                <th style="width: 13%;">JABATAN</th>
                <th style="width: 13%;">CABANG</th>
                <th style="width: 13%;">TGL RESIGN</th>
                <th style="width: 9%;">STATUS</th>
                <th style="width: 12%;">ALASAN</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml || `<tr><td colSpan="8" style="text-align:center;">Tidak ada data resign</td></tr>`}
        </tbody>
    </table>
    <div class="footer-sig">
        <div class="sig-box">
            <p>Diperiksa oleh,</p>
            <div class="sig-line">Penanggung Jawab / HRD</div>
        </div>
        <div class="sig-box">
            <p>Disetujui oleh,</p>
            <div class="sig-line">Super Admin / Management</div>
        </div>
    </div>
    <script>window.onload = function() { setTimeout(() => window.print(), 500); };</script>
</body>
</html>`;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    const handlePrintSingleResign = (resign: ResignationData) => {
        const escapeHtml = (str: string) => (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        const logoImgHtml = logoUrl ? `<img src="${logoUrl}" style="height:55px; max-width:160px; object-fit:contain;" />` : '';

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>SURAT KETERANGAN RESIGN - ${escapeHtml(resign.user?.fullName || '')}</title>
    <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 0; padding: 20px; line-height: 1.5; }
        .letterhead { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
        .company-block h1 { font-size: 18px; margin: 0; text-transform: uppercase; font-weight: bold; }
        .company-block p { font-size: 9.5px; margin: 2px 0 0; color: #475569; }
        .doc-title { text-align: center; margin: 25px 0 20px; }
        .doc-title h2 { font-size: 14pt; margin: 0; text-transform: uppercase; font-weight: 800; text-decoration: underline; }
        .doc-title p { font-size: 9pt; color: #64748b; margin-top: 3px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 15px 0 25px; }
        .info-table td { padding: 6px 8px; vertical-align: top; font-size: 10pt; }
        .info-table td.label { font-weight: bold; width: 180px; color: #334155; }
        .box-reason { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-style: italic; margin-top: 5px; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; }
        .sig-box { text-align: center; width: 220px; }
        .sig-line { margin-top: 70px; border-bottom: 1.5px solid #0f172a; font-weight: bold; }
    </style>
</head>
<body>
    <div class="letterhead">
        <div>${logoImgHtml}</div>
        <div class="company-block" style="text-align: right;">
            <h1>${escapeHtml(namaPt)}</h1>
            <p>${escapeHtml(alamatPt || "Sistem Informasi Manajemen Presensi & Tenaga Kerja")}</p>
        </div>
    </div>
    <div class="doc-title">
        <h2>SURAT KETERANGAN RESIGNASI TENAGA KERJA</h2>
        <p>Ref: RESIGN-${resign.id}/${format(new Date(resign.resignDate), "yyyyMM", { locale: id })}</p>
    </div>
    <p>Dengan ini menerangkan bahwa data pengunduran diri tenaga kerja di bawah ini telah terverifikasi dan dicatat pada sistem resmi <strong>${escapeHtml(namaPt)}</strong>:</p>
    <table class="info-table">
        <tr>
            <td class="label">Nama Lengkap</td>
            <td>: <strong>${escapeHtml(resign.user?.fullName || '-')}</strong></td>
        </tr>
        <tr>
            <td class="label">NIK</td>
            <td>: ${escapeHtml(resign.user?.nik || '-')}</td>
        </tr>
        <tr>
            <td class="label">Jabatan Terakhir</td>
            <td>: ${escapeHtml(resign.user?.position || '-')}</td>
        </tr>
        <tr>
            <td class="label">Cabang Terakhir</td>
            <td>: ${escapeHtml(resign.user?.branch || '-')}</td>
        </tr>
        <tr>
            <td class="label">Tanggal Efektif Resign</td>
            <td>: <strong>${format(new Date(resign.resignDate), "EEEE, dd MMMM yyyy", { locale: id })}</strong></td>
        </tr>
        <tr>
            <td class="label">Status Pengajuan</td>
            <td>: <strong style="color: ${resign.status === 'approved' ? '#166534' : resign.status === 'rejected' ? '#991b1b' : '#d97706'}; text-transform: uppercase;">${resign.status === 'approved' ? 'DISETUJUI' : resign.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU PERSETUJUAN'}</strong></td>
        </tr>
        <tr>
            <td class="label">Keterangan / Alasan</td>
            <td>
                <div class="box-reason">${escapeHtml(resign.reason || '-')}</div>
            </td>
        </tr>
    </table>
    <p>Demikian surat keterangan pencatatan resignasi ini diterbitkan untuk dipergunakan sebagaimana mestinya.</p>
    <div class="footer-sig">
        <div class="sig-box">
            <p>Yang Mengajukan,</p>
            <div class="sig-line">${escapeHtml(resign.user?.fullName || 'Karyawan')}</div>
        </div>
        <div class="sig-box">
            <p>${escapeHtml(singkatanPt)}, ${format(new Date(), "dd MMMM yyyy", { locale: id })}<br/>Disetujui oleh,</p>
            <div class="sig-line">Management / Super Admin</div>
        </div>
    </div>
    <script>window.onload = function() { setTimeout(() => window.print(), 500); };</script>
</body>
</html>`;
        const win = window.open("", "_blank");
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    // Filter active employees (role is employee and not already resigned)
    const activeEmployees = employees.filter(
        (emp) => emp.role === "employee" && 
                 emp.employmentStatus !== "Resign" && 
                 !(emp as any).isResigned && 
                 !resignationsList.some((r) => r.userId === emp.id)
    );

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await fetch("/api/admin/resignations", {
                method: "POST",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal menyimpan data.");
            }
            return res.json();
        },
        onSuccess: async (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Pencatatan resign berhasil disimpan.",
                variant: "default",
            });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            resetForm();
            setOpenAddModal(false);
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: "PATCH",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal memperbarui data.");
            }
            return res.json();
        },
        onSuccess: async (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Data resign berhasil diperbarui.",
                variant: "default",
            });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            resetForm();
            setOpenEditModal(false);
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, file }: { id: number; status: string; file?: File | null }) => {
            const formData = new FormData();
            formData.append("status", status);
            if (file) formData.append("document", file);

            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: "PATCH",
                body: formData,
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal memperbarui status.");
            }
            return res.json();
        },
        onSuccess: async (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Status resign berhasil diperbarui.",
                variant: "default",
            });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setOpenViewModal(false);
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Gagal menghapus data.");
            }
            return res.json();
        },
        onSuccess: async (data) => {
            toast({
                title: "Berhasil",
                description: data.message || "Data resign berhasil dihapus.",
                variant: "default",
            });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const resetForm = () => {
        setFormUserId("");
        setFormResignDate("");
        setFormReason("");
        setFormFile(null);
        setSelectedResign(null);
        setEmployeeQuery("");
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formUserId || !formResignDate || !formReason) {
            toast({
                title: "Peringatan",
                description: "Harap lengkapi semua field wajib.",
                variant: "destructive",
            });
            return;
        }

        const formData = new FormData();
        formData.append("userId", formUserId);
        formData.append("resignDate", formResignDate);
        formData.append("reason", formReason);
        if (formFile) {
            formData.append("document", formFile);
        }

        createMutation.mutate(formData);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResign) return;

        const formData = new FormData();
        formData.append("resignDate", formResignDate);
        formData.append("reason", formReason);
        if (formFile) {
            formData.append("document", formFile);
        }

        updateMutation.mutate({ id: selectedResign.id, formData });
    };

    const handleOpenFileEdit = (resign: ResignationData) => {
        setSelectedResign(resign);
        setFormResignDate(resign.resignDate);
        setFormReason(resign.reason);
        setFormFile(null);
        setOpenEditModal(true);
    };

    const handleOpenFileView = (resign: ResignationData) => {
        setSelectedResign(resign);
        setFormFile(null);
        setOpenViewModal(true);
    };

    const handleDelete = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus pencatatan resign ini? Status keaktifan tenaga kerja akan dipulihkan.")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredResignations = resignationsList.filter((r) => {
        const name = r.user?.fullName?.toLowerCase() || "";
        const nik = r.user?.nik?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || nik.includes(term);
    });

    const getStatusBadge = (status: string) => {
        if (status === 'approved') return <span className="inline-block px-2 py-1 rounded bg-green-100 text-green-700 text-[10px] font-bold">Disetujui</span>;
        if (status === 'rejected') return <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700 text-[10px] font-bold">Ditolak</span>;
        return <span className="inline-block px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold">Menunggu</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Resign Tenaga Kerja</h1>
                    <p className="text-sm text-gray-500">Mencatat, menyunting, dan menghapus dokumen surat resign tenaga kerja.</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                    <Button
                        variant="outline"
                        className="rounded-lg gap-2 cursor-pointer bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        onClick={() => handlePrintReport(filteredResignations)}
                    >
                        <Printer className="w-4 h-4 text-primary" />
                        Cetak Laporan Resign
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-lg gap-2 cursor-pointer bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        onClick={() => setLocation("/admin/resign-history")}
                    >
                        <FileText className="w-4 h-4" />
                        Lihat Riwayat
                    </Button>
                    <Button
                        onClick={() => {
                            resetForm();
                            setOpenAddModal(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Tenaga Kerja Resign
                    </Button>
                </div>
            </div>

            {/* Search and Table Card */}
            <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-0">
                    {/* Filters bar */}
                    <div className="p-4 sm:p-5 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Cari tenaga kerja berdasarkan nama / NIK..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 rounded-lg border-gray-200"
                            />
                        </div>
                        <div className="text-xs text-gray-400 font-medium">
                            Menampilkan {filteredResignations.length} dari {resignationsList.length} data resign.
                        </div>
                    </div>

                    {/* Table Viewport */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                                    <th className="py-4 px-6 text-center w-16">No</th>
                                    <th className="py-4 px-6">Tenaga Kerja</th>
                                    <th className="py-4 px-6">NIK</th>
                                    <th className="py-4 px-6">Jabatan / Cabang</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Tanggal Resign</th>
                                    <th className="py-4 px-6">Keterangan</th>
                                    <th className="py-4 px-6 text-center">Surat Resign</th>
                                    <th className="py-4 px-6 text-center w-40">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm">
                                {isLoadingResignations ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
                                                <span>Memuat data resign...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredResignations.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-16 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <UserMinus className="w-10 h-10 text-gray-300" />
                                                <p className="font-semibold text-gray-500">Tidak ada data resign ditemukan</p>
                                                <p className="text-xs text-gray-400">Silakan tambahkan data resign melalui tombol di atas.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredResignations.map((r, index) => (
                                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 text-center font-semibold text-gray-400">{index + 1}</td>
                                            <td className="py-4 px-6 font-bold text-gray-900">{r.user?.fullName}</td>
                                            <td className="py-4 px-6 font-mono text-xs text-gray-500">{r.user?.nik || "-"}</td>
                                            <td className="py-4 px-6">
                                                <div className="text-xs">
                                                    <span className="font-bold text-gray-700">{r.user?.position || "-"}</span>
                                                    <span className="text-gray-400 mx-1">•</span>
                                                    <span className="text-gray-500">{r.user?.branch || "-"}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {getStatusBadge(r.status)}
                                            </td>
                                            <td className="py-4 px-6 font-medium text-gray-700">
                                                {format(new Date(r.resignDate), "dd MMM yyyy", { locale: id })}
                                            </td>
                                            <td className="py-4 px-6 text-gray-500 max-w-xs truncate">{r.reason}</td>
                                            <td className="py-4 px-6 text-center">
                                                {r.documentUrl ? (
                                                    <a
                                                        href={r.documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/5 text-primary border border-primary/10 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Buka File
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Tidak ada file</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleOpenFileView(r)}
                                                        title="Lihat Detail"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleOpenFileEdit(r)}
                                                        title="Edit Data"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                                                        onClick={() => handleDelete(r.id)}
                                                        title="Hapus"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal: Tambah Tenaga Kerja Resign */}
            <Dialog open={openAddModal} onOpenChange={setOpenAddModal}>
                <DialogContent className="max-w-lg rounded-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Catat Tenaga Kerja Resign</DialogTitle>
                        <DialogDescription>
                            Daftarkan dokumen surat menyurat resign dan ubah status keaktifan tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5 relative">
                            <label className="text-xs font-black text-gray-500 uppercase">Pilih Tenaga Kerja <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Ketik nama / NIK untuk mencari..."
                                    value={employeeQuery}
                                    onChange={(e) => setEmployeeQuery(e.target.value)}
                                    className="pl-9 rounded-lg border-gray-200"
                                />
                            </div>
                            
                            {employeeQuery.trim() !== "" && (
                                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-50">
                                    {activeEmployees.filter(emp => 
                                        emp.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) ||
                                        (emp.nik || "").toLowerCase().includes(employeeQuery.toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-3 text-center text-xs text-gray-400">Tidak ada tenaga kerja cocok</div>
                                    ) : (
                                        activeEmployees
                                            .filter(emp => 
                                                emp.fullName.toLowerCase().includes(employeeQuery.toLowerCase()) ||
                                                (emp.nik || "").toLowerCase().includes(employeeQuery.toLowerCase())
                                            )
                                            .map((emp) => (
                                                <button
                                                    key={emp.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormUserId(emp.id.toString());
                                                        setEmployeeQuery("");
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs hover:bg-slate-50 flex items-center justify-between font-bold text-gray-800 transition-colors"
                                                >
                                                    <span>{emp.fullName} ({emp.nik || "Tanpa NIK"})</span>
                                                    <span className="text-[10px] text-gray-400 font-medium">{emp.position || "Staff"}</span>
                                                </button>
                                            ))
                                    )}
                                </div>
                            )}

                            {/* Active Display Selected Employee */}
                            {formUserId && (
                                <div className="mt-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg text-xs font-bold text-primary flex items-center justify-between">
                                    <span>
                                        Terpilih: {activeEmployees.find(e => e.id.toString() === formUserId)?.fullName} ({activeEmployees.find(e => e.id.toString() === formUserId)?.position || "Staff"})
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormUserId("")} 
                                        className="text-red-500 hover:text-red-700 font-bold ml-2 transition-colors cursor-pointer"
                                    >
                                        Batal
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Tanggal Resign <span className="text-red-500">*</span></label>
                            <Input
                                type="date"
                                value={formResignDate}
                                onChange={(e) => setFormResignDate(e.target.value)}
                                className="rounded-lg border-gray-200"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Keterangan Resign <span className="text-red-500">*</span></label>
                            <Textarea
                                placeholder="Tulis alasan resign tenaga kerja di sini secara jelas..."
                                value={formReason}
                                onChange={(e) => setFormReason(e.target.value)}
                                className="rounded-lg border-gray-200 min-h-[100px]"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-500 uppercase">Upload Surat/Dokumen Resign (Opsional)</label>
                            {currentUser?.role === 'superadmin' ? (
                                <div className="border border-dashed border-gray-200 hover:border-green-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                    <Input
                                        type="file"
                                        onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                    />
                                    <Download className="w-6 h-6 text-gray-400 group-hover:text-primary mb-2 transition-colors" />
                                    <span className="text-xs font-bold text-gray-700">
                                        {formFile ? formFile.name : "Klik atau seret file di sini (Opsional)"}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-1">Mengunggah file akan otomatis menyetujui pengajuan.</span>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold flex items-start gap-2 border border-amber-200/50">
                                    Hanya Super Admin yang dapat mengunggah dokumen untuk menyetujui pengajuan ini.
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-lg cursor-pointer"
                                onClick={() => setOpenAddModal(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 shadow-sm cursor-pointer"
                            >
                                {createMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal: Edit Resign */}
            <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
                <DialogContent className="max-w-lg rounded-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Perbarui Data Resign Tenaga Kerja</DialogTitle>
                        <DialogDescription>
                            Sunting tanggal, keterangan, atau unggah ulang dokumen surat resign.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResign && (
                        <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
                            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                    {selectedResign.user?.fullName?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-sm">{selectedResign.user?.fullName || "Pengguna Dihapus"}</h4>
                                    <p className="text-xs text-gray-400 font-mono">NIK: {selectedResign.user?.nik || "-"}</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Tanggal Resign <span className="text-red-500">*</span></label>
                                <Input
                                    type="date"
                                    value={formResignDate}
                                    onChange={(e) => setFormResignDate(e.target.value)}
                                    className="rounded-lg border-gray-200"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Keterangan Resign <span className="text-red-500">*</span></label>
                                <Textarea
                                    placeholder="Tulis alasan resign tenaga kerja..."
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    className="rounded-lg border-gray-200 min-h-[100px]"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-500 uppercase">Upload Ulang Surat/Dokumen Resign</label>
                                {currentUser?.role === 'superadmin' ? (
                                    <>
                                        <div className="border border-dashed border-gray-200 hover:border-green-300 rounded-lg p-4 bg-gray-50/50 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                            <Input
                                                type="file"
                                                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                            />
                                            <Download className="w-6 h-6 text-gray-400 group-hover:text-primary mb-2 transition-colors" />
                                            <span className="text-xs font-bold text-gray-700">
                                                {formFile ? formFile.name : "Pilih file baru untuk menggantikan file lama"}
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-1">Mengunggah file akan otomatis menyetujui pengajuan.</span>
                                        </div>
                                        {selectedResign.documentUrl && (
                                            <p className="text-[11px] text-primary font-bold mt-1">
                                                File saat ini: <a href={selectedResign.documentUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-800">Lihat dokumen aktif</a>
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="p-3 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold flex items-start gap-2 border border-amber-200/50">
                                        Hanya Super Admin yang dapat mengunggah dokumen untuk menyetujui pengajuan ini.
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-lg cursor-pointer"
                                    onClick={() => setOpenEditModal(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 shadow-sm cursor-pointer"
                                >
                                    {updateMutation.isPending ? "Memperbarui..." : "Simpan Perubahan"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: View Resign Detail */}
            <Dialog open={openViewModal} onOpenChange={setOpenViewModal}>
                <DialogContent className="max-w-md rounded-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detail Resign Tenaga Kerja</DialogTitle>
                        <DialogDescription>
                            Informasi detail pencatatan resignasi tenaga kerja {namaPt}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedResign && (
                        <div className="space-y-4 pt-2">
                            {/* Profile Info */}
                            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                                    {selectedResign.user?.fullName?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-base">{selectedResign.user?.fullName || "Pengguna Dihapus"}</h4>
                                    <p className="text-xs text-gray-400 font-mono">NIK: {selectedResign.user?.nik || "-"}</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-3.5 text-sm">
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Jabatan</span>
                                    <span className="col-span-2 font-bold text-gray-800">{selectedResign.user?.position || "-"}</span>
                                </div>
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Cabang</span>
                                    <span className="col-span-2 font-bold text-gray-800">{selectedResign.user?.branch || "-"}</span>
                                </div>
                                <div className="grid grid-cols-3">
                                    <span className="text-gray-400 font-medium">Tanggal Resign</span>
                                    <span className="col-span-2 font-bold text-gray-800 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                                        {format(new Date(selectedResign.resignDate), "EEEE, dd MMMM yyyy", { locale: id })}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-gray-400 font-medium block">Keterangan / Alasan Resign</span>
                                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
                                        {selectedResign.reason}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 items-center">
                                    <span className="text-gray-400 font-medium">Surat Resign</span>
                                    <span className="col-span-2">
                                        {selectedResign.documentUrl ? (
                                            <a
                                                href={selectedResign.documentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary border border-primary/10 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                Buka Surat
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Belum ada file terlampir.</span>
                                        )}
                                    </span>
                                </div>
                            </div>
                            
                            {currentUser?.role === 'superadmin' && selectedResign.status === 'pending' && (
                                <div className="mt-4 p-4 border border-blue-100 bg-blue-50/50 rounded-xl space-y-3">
                                    <h4 className="text-sm font-bold text-gray-900">Persetujuan Super Admin</h4>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">Upload PDF Resmi (Opsional)</label>
                                        <div className="border border-dashed border-blue-200 hover:border-blue-400 rounded-lg p-3 bg-white flex flex-col items-center justify-center text-center cursor-pointer relative group transition-colors">
                                            <Input type="file" onChange={(e) => setFormFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept=".pdf" />
                                            <Download className="w-4 h-4 text-blue-400 mb-1" />
                                            <span className="text-xs font-bold text-blue-700">{formFile ? formFile.name : "Upload PDF"}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: selectedResign.id, status: 'rejected' })}>
                                            Tolak
                                        </Button>
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: selectedResign.id, status: 'approved', file: formFile })}>
                                            {updateStatusMutation.isPending ? "Proses..." : "Setujui Resign"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-4">
                                <Button
                                    variant="outline"
                                    className="rounded-lg border-primary/20 text-primary hover:bg-primary/5 gap-2 cursor-pointer"
                                    onClick={() => handlePrintSingleResign(selectedResign)}
                                >
                                    <Printer className="w-4 h-4" />
                                    Cetak Surat Resignasi
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-lg cursor-pointer"
                                    onClick={() => setOpenViewModal(false)}
                                >
                                    Tutup
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
