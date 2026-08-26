import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    ArrowLeft,
    Search,
    Calendar,
    FileText,
    Download,
    UserMinus,
    Clock,
    Trash2,
    Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface ResignationHistoryItem {
    id: number;
    userId: number;
    resignDate: string;
    reason: string;
    status?: string;
    documentUrl: string | null;
    createdAt: string;
    user: {
        fullName: string;
        nik: string | null;
        branch: string | null;
        position: string | null;
    };
}

export default function ResignHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });

    const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
    const singkatanPt = config?.singkatanPt || config?.namaPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
    const alamatPt = config?.alamatPt || import.meta.env.VITE_ALAMAT_PT || "";
    const logoUrl = config?.logoUrl && config.logoUrl !== "/logo_elok_buah.jpg" ? config.logoUrl : null;

    const { data: resignationsList = [], isLoading } = useQuery<ResignationHistoryItem[]>({
        queryKey: ["/api/admin/resignations"],
    });

    const handlePrintReport = (items: ResignationHistoryItem[]) => {
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
    <title>LAPORAN RIWAYAT TENAGA KERJA RESIGN - ${escapeHtml(singkatanPt)}</title>
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
        <h2>LAPORAN RIWAYAT TENAGA KERJA RESIGN</h2>
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
            ${rowsHtml || `<tr><td colSpan="8" style="text-align:center;">Tidak ada riwayat resign</td></tr>`}
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

    const handlePrintSingleResign = (resign: ResignationHistoryItem) => {
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

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/resignations/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error("Gagal menghapus riwayat resign");
            return res.json();
        

            await queryClient.invalidateQueries({ queryKey: ["/api/admin/resignations"] });
            toast({
                title: "Berhasil",
                description: "Riwayat resign telah dihapus.",
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

    const handleDeleteResignation = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus catatan resign ini?")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredResignations = resignationsList.filter((r) => {
        const name = r.user?.fullName?.toLowerCase() || "";
        const nik = r.user?.nik?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || nik.includes(term);
    });

    return (
        <div className="space-y-6">
            {/* Header section with Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 cursor-pointer"
                        onClick={() => setLocation("/admin/resign-management")}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Resign Tenaga Kerja</h1>
                        <p className="text-sm text-gray-500">Timeline historis seluruh tenaga kerja yang telah resign dari perusahaan.</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="rounded-lg gap-2 cursor-pointer bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={() => handlePrintReport(filteredResignations)}
                >
                    <Printer className="w-4 h-4 text-primary" />
                    Cetak Laporan Riwayat Resign
                </Button>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Cari riwayat resign..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 rounded-lg border-gray-200"
                    />
                </div>
                <div className="text-xs text-gray-400 font-bold bg-white border border-gray-100 px-3 py-1.5 rounded-full shadow-xs">
                    Total: {filteredResignations.length} Tenaga Kerja Resign
                </div>
            </div>

            {/* History Timeline Cards */}
            {isLoading ? (
                <div className="py-20 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                        <span>Memuat riwayat resign...</span>
                    </div>
                </div>
            ) : filteredResignations.length === 0 ? (
                <Card className="border-dashed border-gray-200 shadow-none rounded-xl">
                    <CardContent className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                        <UserMinus className="w-12 h-12 text-gray-300" />
                        <p className="font-semibold text-gray-500">Belum ada riwayat resign</p>
                        <p className="text-xs text-gray-400">Pencatatan resign aktif akan otomatis terekam dalam halaman riwayat ini.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="relative pl-6 sm:pl-8 border-l border-gray-200 space-y-8 ml-4">
                    {filteredResignations.map((item) => {
                        const dateFormatted = format(new Date(item.resignDate), "dd MMMM yyyy", { locale: id });
                        const recordDate = format(new Date(item.createdAt), "dd/MM/yyyy HH:mm");
                        
                        return (
                            <div key={item.id} className="relative">
                                {/* Timeline Bullet Dot */}
                                <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200 shadow-xs">
                                    <UserMinus className="w-3.5 h-3.5" />
                                </span>

                                {/* Timeline Card */}
                                <Card className="border-gray-100 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                    <CardContent className="p-5 sm:p-6 space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-50 pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                                    {item.user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-gray-900 text-base">{item.user.fullName}</h3>
                                                    <p className="text-xs font-bold text-gray-400">
                                                        NIK: <span className="font-mono">{item.user.nik || "-"}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Date Badge */}
                                            <div className="flex flex-col items-start sm:items-end gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded-full text-xs font-bold shadow-2xs">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Resign: {dateFormatted}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-primary border-primary/20 hover:bg-primary/5 h-7 px-2 flex items-center gap-1 cursor-pointer text-xs font-bold"
                                                        onClick={() => handlePrintSingleResign(item)}
                                                        title="Cetak Surat Resignasi"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        Cetak
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 h-7 w-7 p-0 flex items-center justify-center cursor-pointer"
                                                        onClick={() => handleDeleteResignation(item.id)}
                                                        disabled={deleteMutation.isPending}
                                                        title="Hapus Riwayat Resign"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold">
                                                    <Clock className="w-3 h-3" />
                                                    Dicatat pada: {recordDate}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Jabatan & Cabang */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                            <div className="space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Jabatan Terakhir</span>
                                                <span className="font-bold text-gray-800 text-sm">{item.user.position || "-"}</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Cabang Terakhir</span>
                                                <span className="font-bold text-gray-800 text-sm">{item.user.branch || "-"}</span>
                                            </div>
                                            <div className="col-span-2 space-y-0.5">
                                                <span className="text-gray-400 font-bold block uppercase tracking-wider">Surat Dokumen Resign</span>
                                                <div>
                                                    {item.documentUrl ? (
                                                        <a
                                                            href={item.documentUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-primary-foreground font-bold hover:underline"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Unduh Dokumen Attach
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Tidak ada surat terlampir</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Alasan/Keterangan */}
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Keterangan Lengkap / Kronologi Resign</span>
                                            <p className="text-sm text-gray-600 leading-relaxed font-medium">{item.reason}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
