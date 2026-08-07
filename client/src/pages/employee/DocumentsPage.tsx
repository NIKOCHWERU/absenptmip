import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { 
  FileText, 
  Download, 
  Eye, 
  Search, 
  Filter, 
  Zap, 
  AlertTriangle, 
  ArrowLeftRight, 
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function safeFormatDate(dateVal: any, formatStr: string) {
  if (!dateVal) return "-";
  try {
    let d: Date;
    if (typeof dateVal === "string" && dateVal.length === 10 && dateVal.includes("-")) {
      const [y, m, day] = dateVal.split("-").map(Number);
      d = new Date(y, m - 1, day, 12, 0, 0);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return "-";
    return format(d, formatStr, { locale: id });
  } catch (_) {
    return "-";
  }
}

function checkIsOvertimePast(splDateVal: any, endTimeVal: any): boolean {
  if (!splDateVal) return false;
  try {
    let dateStr = "";
    if (typeof splDateVal === "string") {
      dateStr = splDateVal.split("T")[0];
    } else if (splDateVal instanceof Date) {
      dateStr = splDateVal.toISOString().split("T")[0];
    } else {
      return false;
    }

    let endHhMm = "23:59";
    if (endTimeVal) {
      if (typeof endTimeVal === "string") {
        if (endTimeVal.length === 5) {
          endHhMm = endTimeVal;
        } else if (endTimeVal.includes("T")) {
          endHhMm = endTimeVal.split("T")[1]?.substring(0, 5) || "23:59";
        }
      } else if (endTimeVal instanceof Date) {
        endHhMm = `${String(endTimeVal.getHours()).padStart(2, '0')}:${String(endTimeVal.getMinutes()).padStart(2, '0')}`;
      }
    }

    const [yr, mo, dy] = dateStr.split("-").map(Number);
    const [hh, mm] = endHhMm.split(":").map(Number);
    
    const endDateTime = new Date(yr, mo - 1, dy, hh, mm, 59);
    return new Date().getTime() > endDateTime.getTime();
  } catch (err) {
    return false;
  }
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "spl" | "sp" | "mutation" | "resign">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  // Fetch all documents for employee
  const { data: docsData, isLoading: isLoadingDocs } = useQuery<any>({
    queryKey: ["/api/employee/documents/all"],
  });

  // Direct fetch for employee SPL list
  const { data: mySplData, isLoading: isLoadingSpl } = useQuery<any[]>({
    queryKey: ["/api/employee/overtimes/my-spl"],
  });

  const isLoading = isLoadingDocs && isLoadingSpl;

  // Combine and map documents
  const allDocs: any[] = [];
  const processedSplIds = new Set<number>();

  const splItems = [...(docsData?.spl || []), ...(mySplData || [])];

  splItems.forEach((item: any) => {
    if (!item || !item.id || processedSplIds.has(item.id)) return;
    processedSplIds.add(item.id);

    const isPast = checkIsOvertimePast(item.date || item.overtimeDate || item.startTime, item.endTime) && item.status !== 'completed' && item.status !== 'ongoing';
    allDocs.push({
      id: `spl-${item.id}`,
      type: "spl",
      title: "Surat Perintah Lembur (SPL)",
      docNumber: item.splNumber || `SPL-${item.id}`,
      date: item.date || item.overtimeDate || item.startTime || item.createdAt,
      rawDate: new Date(item.date || item.overtimeDate || item.startTime || item.createdAt).getTime(),
      status: isPast ? "expired" : (item.employeeApproval || item.status || "pending"),
      statusLabel: isPast ? "Melewatkan Lembur" : item.employeeApproval === 'approved' ? "Disetujui" : item.employeeApproval === 'rejected' ? "Ditolak" : "Menunggu",
      description: item.description || "Instruksi Penugasan Lembur dari Pimpinan / HRD",
      fileUrl: item.splDocumentUrl || item.fileUrl,
      raw: item,
    });
  });

  if (docsData?.warningLetters) {
    docsData.warningLetters.forEach((item: any) => {
      allDocs.push({
        id: `sp-${item.id}`,
        type: "sp",
        title: `Surat Peringatan (${item.level || 'SP'})`,
        docNumber: item.letterNumber || `SP-${item.id}`,
        date: item.createdAt,
        rawDate: new Date(item.createdAt).getTime(),
        status: item.status || "approved",
        statusLabel: item.status === 'approved' ? "Diterbitkan Resmi" : "Draft",
        description: item.reason || "Surat Peringatan Kedisiplinan Kerja Karyawan",
        fileUrl: item.fileUrl,
        raw: item,
      });
    });
  }

  if (docsData?.mutations) {
    docsData.mutations.forEach((item: any) => {
      allDocs.push({
        id: `mut-${item.id}`,
        type: "mutation",
        title: `Surat Mutasi / Promosi (${item.type || 'Jabatan'})`,
        docNumber: item.letterNumber || `MUT-${item.id}`,
        date: item.createdAt,
        rawDate: new Date(item.createdAt).getTime(),
        status: item.status || "approved",
        statusLabel: item.status === 'approved' ? "Disetujui Pimpinan" : "Diproses",
        description: `Perubahan posisi: ${item.oldPosition || '-'} -> ${item.newPosition || '-'}`,
        fileUrl: item.fileUrl,
        raw: item,
      });
    });
  }

  if (docsData?.resignations) {
    docsData.resignations.forEach((item: any) => {
      allDocs.push({
        id: `resg-${item.id}`,
        type: "resign",
        title: "Surat Pengunduran Diri (Resign)",
        docNumber: `RESIGN-${item.id}`,
        date: item.createdAt,
        rawDate: new Date(item.createdAt).getTime(),
        status: item.status || "approved",
        statusLabel: item.status === 'approved' ? "Disetujui HRD" : "Proses Review",
        description: item.reason || "Pengajuan Surat Resign Resmi Karyawan",
        fileUrl: item.fileUrl,
        raw: item,
      });
    });
  }

  // Sort latest first
  allDocs.sort((a, b) => b.rawDate - a.rawDate);

  // Filter by category tab
  const filteredDocs = allDocs.filter((doc) => {
    if (activeTab !== "all" && doc.type !== activeTab) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.docNumber.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getDocIcon = (type: string) => {
    switch (type) {
      case "spl":
        return <Zap className="w-5 h-5 text-orange-600" />;
      case "sp":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "mutation":
        return <ArrowLeftRight className="w-5 h-5 text-blue-600" />;
      case "resign":
        return <UserCheck className="w-5 h-5 text-purple-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string, statusLabel: string) => {
    if (status === "expired") {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
          Melewatkan Lembur
        </span>
      );
    }
    if (status === "approved" || status === "Disetujui") {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          {statusLabel}
        </span>
      );
    }
    if (status === "rejected" || status === "Ditolak") {
      return (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
          {statusLabel}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        {statusLabel}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28 pt-4 px-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 mb-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">Surat & Dokumen Saya</h1>
            <p className="text-xs text-slate-500 font-medium">Arsip resmi seluruh dokumen penugasan & HRD</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative pt-2">
          <Search className="absolute left-3.5 top-5 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor surat atau keterangan..."
            className="pl-10 h-10 rounded-2xl bg-slate-50 border-slate-200 text-xs font-semibold"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "all"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Semua ({allDocs.length})
        </button>
        <button
          onClick={() => setActiveTab("spl")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "spl"
              ? "bg-orange-600 text-white shadow-md shadow-orange-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Lembur (SPL)
        </button>
        <button
          onClick={() => setActiveTab("sp")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "sp"
              ? "bg-red-600 text-white shadow-md shadow-red-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Peringatan (SP)
        </button>
        <button
          onClick={() => setActiveTab("mutation")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "mutation"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Mutasi
        </button>
        <button
          onClick={() => setActiveTab("resign")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === "resign"
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Resign
        </button>
      </div>

      {/* Document Cards */}
      {isLoading ? (
        <div className="bg-white rounded-3xl p-8 text-center space-y-2 border border-slate-200">
          <Clock className="w-8 h-8 text-slate-300 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Memuat dokumen resmi...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center space-y-2 border border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Tidak ada dokumen ditemukan</p>
          <p className="text-xs text-slate-400">Belum ada dokumen resmi yang diterbitkan untuk kategori ini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocs.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {getDocIcon(doc.type)}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-tight">{doc.title}</h3>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {safeFormatDate(doc.date, "EEEE, d MMMM yyyy")}
                    </p>
                  </div>
                </div>
                {getStatusBadge(doc.status, doc.statusLabel)}
              </div>

              {/* Description Box */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-700 font-medium">
                <p className="italic text-[11px]">"{doc.description}"</p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDoc(doc)}
                  className="h-10 rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" /> Lihat Dokumen
                </Button>

                {doc.fileUrl ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const printUrl = doc.fileUrl.includes('?') ? `${doc.fileUrl}&print=1` : `${doc.fileUrl}?print=1`;
                      window.open(printUrl, "_blank");
                    }}
                    className="h-10 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh PDF
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled
                    className="h-10 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs"
                  >
                    Tutup
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Document Detail Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="rounded-3xl max-w-sm md:max-w-md p-6 bg-white shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-black text-slate-900">
              {selectedDoc?.title}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              Rincian Informasi Dokumen Resmi Perusahaan
            </DialogDescription>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold block">Nomor Dokumen:</span>
                    <strong className="text-slate-900 font-mono">{selectedDoc.docNumber}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">Tanggal Terbit:</span>
                    <strong className="text-slate-900">{safeFormatDate(selectedDoc.date, "d MMMM yyyy")}</strong>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2 text-[11px]">
                  <span className="text-slate-400 font-bold block">Keterangan / Deskripsi:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedDoc.description}</p>
                </div>
              </div>

              {selectedDoc.fileUrl && (
                <Button
                  onClick={() => {
                    const printUrl = selectedDoc.fileUrl.includes('?') ? `${selectedDoc.fileUrl}&print=1` : `${selectedDoc.fileUrl}?print=1`;
                    window.open(printUrl, "_blank");
                  }}
                  className="w-full h-11 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" /> Unduh Dokumen PDF Resmi
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
