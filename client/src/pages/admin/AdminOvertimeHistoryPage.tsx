import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, ArrowLeft, Search, Filter, Printer, Trash2, Eye, FileText, Image as ImageIcon, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toTitleCase, resolveFileUrl } from "@/lib/utils";

export default function AdminOvertimeHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [viewDetail, setViewDetail] = useState<any | null>(null);
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
            const mins = otMins % 60;
            if (hrs > 0 && mins > 0) durationStr = `${hrs} Jam ${mins} Menit`;
            else if (hrs > 0) durationStr = `${hrs} Jam`;
            else if (mins > 0) durationStr = `${mins} Menit`;
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
      <div class="sig-name">SUPER ADMIN</div>
      <p class="sig-desc">Staff HRD</p>
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

    const filteredRequests = (requests || []).filter(req => {
        const userName = getUserName(req.userId || req.fullName).toLowerCase();
        const nik = (req.nik || "").toLowerCase();
        const desc = (req.description || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        return userName.includes(search) || nik.includes(search) || desc.includes(search);
    });

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {/* Header Section (DISAMAKAN PERSIS DENGAN RIWAYAT CUTI) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Riwayat Penugasan & Lembur</h1>
                        <p className="text-sm text-gray-500">Daftar arsip dan riwayat persetujuan lembur seluruh tenaga kerja.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                        <CardHeader className="bg-white border-b border-gray-50 flex flex-row items-center justify-between gap-4 p-6">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Cari nama tenaga kerja, NIK, atau pekerjaan..."
                                    className="pl-10 rounded-lg border-gray-100 bg-gray-50 focus:bg-white transition-all h-11"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="rounded-lg h-11 gap-2 text-gray-600 border-gray-200">
                                <Filter className="w-4 h-4" /> Filter
                            </Button>
                        </CardHeader>
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
                                        <img src={resolveFileUrl(viewDetail.initialProofUrl)} alt="Foto Awal" className="h-28 w-full object-cover rounded-lg border border-gray-200" />
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
                                        <img src={resolveFileUrl(viewDetail.finalProofUrl)} alt="Foto Hasil" className="h-28 w-full object-cover rounded-lg border border-gray-200" />
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
        </div>
    );
}
