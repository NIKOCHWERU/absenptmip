import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Plus, Calendar, Clock, User as UserIcon, Eye, Printer, Trash2, Check, X, FileText, Send, Upload, ArrowLeft, Image as ImageIcon
} from "lucide-react";

export default function AdminOvertimePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: config } = useQuery<any>({ queryKey: ["/api/config"] });
  const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
  const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
  const logoUrl = config?.logoUrl || "/icon-192.png";

  // Modal State for Penugasan Lembur
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Modal State for Detail View
  const [viewDetail, setViewDetail] = useState<any | null>(null);

  // Form Fields
  const [assignEmployee, setAssignEmployee] = useState("KARYAWAN B");
  const [assignDate, setAssignDate] = useState("2026-07-25");
  const [assignStartTime, setAssignStartTime] = useState("17:00");
  const [assignEndTime, setAssignEndTime] = useState("20:30");
  const [assignTask, setAssignTask] = useState("");
  const [assignSplFile, setAssignSplFile] = useState<File | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dummy Overtime Data List (Karyawan A, B, C)
  const [overtimeRequests, setOvertimeRequests] = useState([
    {
      id: 1,
      userId: 2,
      employeeName: "KARYAWAN B",
      nik: "3215000000000002",
      position: "Operator Mesin Line 3",
      branch: "Pabrik Utama Cikarang",
      createdAt: "2026-07-25T08:00:00.000Z",
      date: "2026-07-25",
      masuk: "17:00",
      pulang: "20:30",
      duration: "3 Jam 30 Menit",
      status: "approved", // approved = SELESAI
      reason: "Perbaikan Mesin Production Line 3 bersama Tim Maintenance",
      finalDesc: "Perbaikan Selesai 100%, Mesin Siap Beroperasi Besok Pagi",
      splName: "SPL_KARYAWAN_B.PDF",
      initialPhoto: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&q=80",
      finalPhoto: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80",
    },
    {
      id: 2,
      userId: 1,
      employeeName: "KARYAWAN A",
      nik: "3215000000000001",
      position: "Teknisi Maintenance Electrical",
      branch: "Gedung B Panel Listrik",
      createdAt: "2026-07-25T08:30:00.000Z",
      date: "2026-07-25",
      masuk: "17:00",
      pulang: "-",
      duration: "1 Jam 45 Menit (Berjalan)",
      status: "ongoing", // ongoing = BERLANGSUNG
      reason: "Overtime maintenance rutin panel listrik utama gedung B",
      finalDesc: "-",
      splName: "SPL_KARYAWAN_A.PDF",
      initialPhoto: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80",
      finalPhoto: null,
    },
    {
      id: 3,
      userId: 3,
      employeeName: "KARYAWAN C",
      nik: "3215000000000003",
      position: "Staff Warehouse & Security",
      branch: "Gudang Logistik Utama",
      createdAt: "2026-07-25T09:00:00.000Z",
      date: "2026-07-25",
      masuk: "19:00",
      pulang: "22:00",
      duration: "3 Jam 0 Menit",
      status: "pending", // pending = PENGATURAN TUGAS / MENUNGGU
      reason: "Patroli pengawasan ekstra pengiriman barang malam hari",
      finalDesc: "-",
      splName: "SPL_KARYAWAN_C.PDF",
      initialPhoto: null,
      finalPhoto: null,
    }
  ]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedRequests = [...overtimeRequests].sort((a, b) => {
    let valA: any = a[sortField as keyof typeof a] || "";
    let valB: any = b[sortField as keyof typeof b] || "";
    if (sortField === "name") {
      valA = a.employeeName.toLowerCase();
      valB = b.employeeName.toLowerCase();
    }
    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTask.trim()) {
      toast({
        title: "Pekerjaan Belum Diisi",
        description: "Mohon isi uraian tugas lembur yang diberikan kepada karyawan.",
        variant: "destructive",
      });
      return;
    }

    const nikMap: Record<string, string> = {
      "KARYAWAN A": "3215000000000001",
      "KARYAWAN B": "3215000000000002",
      "KARYAWAN C": "3215000000000003",
    };

    const newOvertime = {
      id: overtimeRequests.length + 1,
      userId: assignEmployee === "KARYAWAN A" ? 1 : assignEmployee === "KARYAWAN B" ? 2 : 3,
      employeeName: assignEmployee,
      nik: nikMap[assignEmployee] || "3215000000000001",
      position: assignEmployee === "KARYAWAN A" ? "Teknisi Maintenance" : assignEmployee === "KARYAWAN B" ? "Operator Mesin" : "Staff Warehouse",
      branch: "Pabrik Utama",
      createdAt: new Date().toISOString(),
      date: assignDate,
      masuk: assignStartTime,
      pulang: assignEndTime,
      duration: "3 Jam 30 Menit",
      status: "pending",
      reason: assignTask,
      finalDesc: "-",
      splName: assignSplFile ? assignSplFile.name : `SPL_${assignEmployee.replace(" ", "_")}.PDF`,
      initialPhoto: null,
      finalPhoto: null,
    };

    setOvertimeRequests([newOvertime, ...overtimeRequests]);
    setIsAssignModalOpen(false);
    setAssignTask("");
    setAssignSplFile(null);

    toast({
      title: "Penugasan Lembur Berhasil Dikirim!",
      description: `Surat Perintah Lembur (SPL) telah terkirim ke HP ${assignEmployee}.`,
    });
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    setOvertimeRequests(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    toast({
      title: "Status Diperbarui",
      description: `Status penugasan lembur #${id} telah diubah.`,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus permohonan/penugasan lembur ini?")) {
      setOvertimeRequests(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Penugasan Dihapus",
        description: "Data penugasan lembur telah berhasil dihapus.",
      });
    }
  };

  const handlePrintSpl = (item: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SURAT PERINTAH LEMBUR - ${item.employeeName}</title>
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
        <p>Berdasarkan kebutuhan operasional perusahaan, dengan ini Manajer HRD memberikan instruksi lembur kepada:</p>
        <table>
          <tr><td class="label">Nama Karyawan</td><td class="colon">:</td><td><strong>${item.employeeName}</strong></td></tr>
          <tr><td class="label">NIK Karyawan</td><td class="colon">:</td><td>${item.nik}</td></tr>
          <tr><td class="label">Jabatan</td><td class="colon">:</td><td>${item.position}</td></tr>
          <tr><td class="label">Tanggal Lembur</td><td class="colon">:</td><td>${item.date}</td></tr>
          <tr><td class="label">Waktu Lembur</td><td class="colon">:</td><td>${item.masuk} s.d ${item.pulang} (${item.duration})</td></tr>
          <tr><td class="label">Uraian Pekerjaan</td><td class="colon">:</td><td>${item.reason}</td></tr>
          <tr><td class="label">Status Lembur</td><td class="colon">:</td><td><strong>${item.status === 'approved' ? 'SELESAI' : item.status === 'ongoing' ? 'BERLANGSUNG' : 'PENDING/MENUNGGU'}</strong></td></tr>
        </table>
        <p>Demikian Surat Perintah Lembur ini diterbitkan untuk dilaksanakan sebagaimana mestinya dengan penuh tanggung jawab.</p>
        <div class="sig-container">
          <div class="sig-box"><p>Pemberi Tugas,</p><div class="sig-line">SUPER ADMIN HRD</div></div>
          <div class="sig-box"><p>Penerima Tugas,</p><div class="sig-line">${item.employeeName}</div></div>
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
      {/* Header Section (Persis Kelola Cuti) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Manajemen Permohonan & Penugasan Lembur</h1>
          <p className="text-sm text-gray-500">Kelola penugasan lembur, buat SPL baru, serta verifikasi laporan lembur tenaga kerja.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Modal Penugasan Lembur */}
          <Button
            className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-2 cursor-pointer shadow-sm font-bold"
            onClick={() => setIsAssignModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            + Penugasan Lembur Baru (SPL)
          </Button>

          {/* Tombol Lihat Riwayat Lembur */}
          <Button
            variant="outline"
            className="rounded-lg gap-2 cursor-pointer bg-white"
            onClick={() => setLocation("/preview/overtime-admin")}
          >
            <Calendar className="w-4 h-4" />
            Lihat Riwayat & Rekap Lembur
          </Button>
        </div>
      </div>

      {/* Main Table Section (Persis Kelola Cuti) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Daftar Penugasan Lembur</h2>
            <p className="text-sm text-gray-500">Daftar instruksi dan permohonan lembur karyawan PT MIP.</p>
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
            <Button
              variant={sortField === "status" ? "default" : "outline"}
              size="sm"
              onClick={() => toggleSort("status")}
              className="text-xs rounded-full h-8 px-3"
            >
              Status {sortField === "status" && (sortOrder === "asc" ? "↑" : "↓")}
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
                    <th className="px-6 py-4">Tanggal Lembur</th>
                    <th className="px-6 py-4">Jam & Durasi</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 max-w-[220px]">Uraian Pekerjaan</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Column 1: Tenaga Kerja */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase shrink-0">
                            {req.employeeName.charAt(req.employeeName.length - 1)}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block">{req.employeeName}</span>
                            <span className="text-[10px] text-gray-400 font-mono">NIK: {req.nik}</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Tanggal */}
                      <td className="px-6 py-4 text-gray-700 font-medium whitespace-nowrap">
                        <div className="font-bold text-xs">{req.date}</div>
                        <div className="text-[10px] text-gray-400">📄 {req.splName}</div>
                      </td>

                      {/* Column 3: Jam & Durasi */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800 text-xs whitespace-nowrap">{req.masuk} - {req.pulang}</div>
                        <span className="text-[10px] font-semibold text-primary">{req.duration}</span>
                      </td>

                      {/* Column 4: Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                            req.status === "approved"
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                              : req.status === "ongoing"
                              ? "text-orange-700 bg-orange-50 border-orange-200 animate-pulse"
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}
                        >
                          {req.status === "approved" ? "Selesai" : req.status === "ongoing" ? "Berlangsung" : "Pending"}
                        </span>
                      </td>

                      {/* Column 5: Uraian Pekerjaan */}
                      <td className="px-6 py-4 max-w-[220px]">
                        <p className="text-gray-600 line-clamp-2 italic text-xs leading-relaxed">"{req.reason}"</p>
                      </td>

                      {/* Column 6: Aksi */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Eye Detail */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 w-8 p-0"
                            onClick={() => setViewDetail(req)}
                            title="Lihat Detail Lembur & Berkas"
                          >
                            <Eye className="w-3.5 h-3.5" />
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
                            onClick={() => handleDelete(req.id)}
                            title="Hapus Penugasan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Approve / Reject buttons if pending */}
                          {req.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg text-red-600 border-red-100 hover:bg-red-50 gap-1 h-8 px-2.5"
                                onClick={() => handleStatusChange(req.id, "rejected")}
                                title="Tolak"
                              >
                                <X className="w-3.5 h-3.5" /> <span className="hidden xl:inline">Tolak</span>
                              </Button>
                              <Button
                                size="sm"
                                className="bg-primary hover:bg-primary/90 text-white rounded-lg gap-1 shadow-sm h-8 px-2.5"
                                onClick={() => handleStatusChange(req.id, "approved")}
                                title="Setujui"
                              >
                                <Check className="w-3.5 h-3.5" /> <span className="hidden xl:inline">Setuju</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
              Isi instruksi penugasan lembur karyawan. Surat SPL otomatis terkirim ke HP Karyawan terpilih.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssignment} className="space-y-4 py-2">
            {/* Field 1: Pilih Karyawan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Tenaga Kerja / Karyawan *</label>
              <Select value={assignEmployee} onValueChange={setAssignEmployee}>
                <SelectTrigger className="rounded-xl border-gray-200 h-10 text-xs font-semibold">
                  <SelectValue placeholder="Pilih Karyawan" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="KARYAWAN A">KARYAWAN A (3215000000000001 - Teknisi Maintenance)</SelectItem>
                  <SelectItem value="KARYAWAN B">KARYAWAN B (3215000000000002 - Operator Production Line 3)</SelectItem>
                  <SelectItem value="KARYAWAN C">KARYAWAN C (3215000000000003 - Staff Warehouse & Logistics)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Field 2 & 3: Tanggal & Waktu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Tanggal Lembur</label>
                <Input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Jam Mulai</label>
                <Input
                  type="time"
                  value={assignStartTime}
                  onChange={(e) => setAssignStartTime(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Estimasi Selesai</label>
                <Input
                  type="time"
                  value={assignEndTime}
                  onChange={(e) => setAssignEndTime(e.target.value)}
                  className="rounded-xl border-gray-200 h-10 text-xs font-medium"
                />
              </div>
            </div>

            {/* Field 4: Uraian Tugas */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Uraian Pekerjaan Lembur *</label>
              <Textarea
                placeholder="Contoh: Perbaikan Mesin Production Line 3 & Maintenance Panel Listrik..."
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
                    {assignSplFile ? assignSplFile.name : "Klik untuk upload berkas SPL"}
                  </span>
                  <span className="text-[10px] text-gray-400">PDF, JPG, PNG (Maks 5MB)</span>
                </label>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)} className="rounded-xl text-xs font-semibold">
                Batal
              </Button>
              <Button type="submit" className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white gap-2">
                <Send className="w-4 h-4" /> Kirim Penugasan ke HP Karyawan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL POPUP 2: VIEW DETAIL LEMBUR & BUKTI FOTO                           */}
      {/* ========================================================================= */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-6 bg-white">
          {viewDetail && (
            <div>
              <DialogHeader className="border-b pb-3 mb-4">
                <DialogTitle className="text-lg font-black text-gray-900">Detail Penugasan & Berkas Lembur</DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  {viewDetail.employeeName} — NIK: {viewDetail.nik} ({viewDetail.date})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs text-gray-700">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 block font-bold text-[10px] uppercase">Waktu Lembur</span>
                    <span className="font-extrabold text-gray-900 text-sm">{viewDetail.masuk} - {viewDetail.pulang}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-bold text-[10px] uppercase">Estimasi Durasi</span>
                    <span className="font-extrabold text-primary text-sm">{viewDetail.duration}</span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 font-bold block mb-1">Uraian Pekerjaan / Instruksi:</span>
                  <p className="p-3 bg-gray-50 rounded-xl border border-gray-100 font-medium italic text-gray-800">
                    "{viewDetail.reason}"
                  </p>
                </div>

                {/* Bukti Foto Modal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="font-bold block mb-1 text-gray-700 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" /> Foto Awal Mulai Lembur
                    </span>
                    {viewDetail.initialPhoto ? (
                      <div className="border rounded-xl overflow-hidden h-36 bg-gray-100">
                        <img src={viewDetail.initialPhoto} alt="Awal Lembur" className="w-full h-full object-cover" />
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
                    {viewDetail.finalPhoto ? (
                      <div className="border rounded-xl overflow-hidden h-36 bg-gray-100">
                        <img src={viewDetail.finalPhoto} alt="Hasil Selesai Lembur" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="border border-dashed rounded-xl h-36 flex items-center justify-center text-gray-400 italic">
                        Belum diupload / Berlangsung
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 pt-3 border-t">
                <Button variant="outline" onClick={() => setViewDetail(null)} className="rounded-xl text-xs font-semibold">
                  Tutup
                </Button>
                <Button onClick={() => handlePrintSpl(viewDetail)} className="rounded-xl text-xs font-bold bg-primary text-white gap-2">
                  <Printer className="w-4 h-4" /> Cetak Surat SPL
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
