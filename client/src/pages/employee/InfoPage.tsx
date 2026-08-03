import { useAuth } from "@/hooks/use-auth";
import { CompanyHeader } from "@/components/CompanyHeader";
import { BottomNav } from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Newspaper, Calendar, Download, Share2, ExternalLink, FileText, AlertCircle } from "lucide-react";
import { safeCompressImage, uploadFileWithProgress, resolveFileUrl } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";

interface Announcement {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export default function InfoPage() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const { data, isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const { data: employeeDocs, isLoading: isLoadingDocs } = useQuery<{
    mutations: any[];
    warningLetters: any[];
    resignations: any[];
  }>({
    queryKey: ["/api/employee/documents"],
  });

  const { data: mySplList, isLoading: isLoadingSpl } = useQuery<any[]>({
    queryKey: ["/api/employee/overtimes/my-spl"],
  });

  const announcements = Array.isArray(data) ? data : [];
  const riwayatSurat = [
    ...(employeeDocs?.mutations?.map(m => ({ ...m, category: m.type === 'mutasi' ? 'Mutasi' : m.type === 'promosi' ? 'Promosi' : 'Demosi' })) || []),
    ...(employeeDocs?.warningLetters?.map(sp => ({ ...sp, category: `Surat Peringatan (${sp.type})` })) || []),
    ...(employeeDocs?.resignations?.map(r => ({ ...r, category: 'Surat Resign/PHK' })) || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleDownload = async (announcement: Announcement) => {
    if (!announcement.imageUrl) return;
    try {
      const response = await fetch(resolveFileUrl(announcement.imageUrl));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${announcement.title.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleShareWhatsApp = (announcement: Announcement) => {
    const text = `📢 *${announcement.title}*\n\n${announcement.content}\n\n— PT ELOK JAYA ABADHI`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const safeFormat = (dateStr: string | null | undefined, fmt: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return format(date, fmt, { locale: idLocale });
    } catch (e) {
      return "";
    }
  };

  // Fullscreen Image State
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Event listener for opening images inline
  useState(() => {
    const handleOpenImage = (e: any) => setFullscreenImage(e.detail);
    window.addEventListener('open-fullscreen-image', handleOpenImage);
    return () => window.removeEventListener('open-fullscreen-image', handleOpenImage);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-1 bg-transparent border-none shadow-none flex items-center justify-center">
          <DialogTitle className="sr-only">Lihat Gambar</DialogTitle>
          <DialogDescription className="sr-only">Tampilan penuh gambar pengumuman</DialogDescription>
          {fullscreenImage && (
            <img
              src={resolveFileUrl(fullscreenImage)}
              alt="Full Size"
              className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>

      <CompanyHeader title="Papan Informasi" />

      <main className="px-4 pt-4 max-w-lg mx-auto">

        {isLoading && announcements.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100"
          >
            <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada pengumuman</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {announcements.map((ann, i) => (
              <motion.article
                key={ann.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedAnnouncement(ann)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
              >
                {ann.imageUrl ? (
                  <div className="relative overflow-hidden">
                    <img
                      src={resolveFileUrl(ann.imageUrl)}
                      alt={ann.title}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <h3 className="absolute bottom-2 left-2 right-2 text-white font-bold text-xs leading-tight drop-shadow-lg pointer-events-none line-clamp-2">
                      {ann.title}
                    </h3>
                  </div>
                ) : (
                  <div className="h-16 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center px-3">
                    <Newspaper className="w-6 h-6 text-primary/40" />
                  </div>
                )}
                <div className="p-2.5">
                  {!ann.imageUrl && (
                    <h3 className="font-bold text-gray-800 text-xs mb-1 line-clamp-2">{ann.title}</h3>
                  )}
                  <p className="text-[10px] text-gray-400 line-clamp-2 mb-2 leading-relaxed">
                    {ann.content.replace(/<[^>]*>/g, '')}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-300 flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {safeFormat(ann.createdAt, "dd MMM")}
                    </span>
                    <span className="text-[9px] text-primary font-semibold flex items-center gap-0.5">
                      Baca <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
        
        {/* Section Surat Perintah Lembur (SPL) */}
        <div className="mt-8 mb-4">
            <h2 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                Surat Perintah Lembur (SPL)
            </h2>
            {isLoadingSpl ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                </div>
            ) : (!mySplList || mySplList.length === 0) ? (
                <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm">
                    <FileText className="w-8 h-8 text-orange-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Belum ada Surat Perintah Lembur (SPL) yang diterbitkan.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {mySplList.map((spl: any) => {
                        const dateStr = safeFormat(spl.date, "dd MMMM yyyy");
                        const startTimeStr = spl.startTime ? safeFormat(spl.startTime, "HH:mm") : "-";
                        const endTimeStr = spl.endTime ? safeFormat(spl.endTime, "HH:mm") : "-";

                        return (
                            <div key={spl.id} className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">SPL</span>
                                        <span className="font-bold text-xs text-gray-900">{spl.splNumber || "SPL Resmi"}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                        spl.employeeApproval === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                        spl.employeeApproval === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-amber-100 text-amber-800'
                                    }`}>
                                        {spl.employeeApproval === 'approved' ? 'Disetujui' : spl.employeeApproval === 'rejected' ? 'Ditolak' : 'Menunggu'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                    <p className="font-semibold text-gray-800">{dateStr} ({startTimeStr} - {endTimeStr} WIB)</p>
                                    <p className="italic text-[11px] text-gray-500 mt-1 bg-orange-50/50 p-2 rounded-lg border border-orange-100">
                                        "{spl.description || 'Pekerjaan Lembur'}"
                                    </p>
                                </div>
                                {spl.splDocumentUrl && (
                                    <a 
                                        href={resolveFileUrl(spl.splDocumentUrl)} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors mt-1"
                                    >
                                        <Download className="w-3.5 h-3.5" /> Unduh Dokumen SPL
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Riwayat Surat Section */}
        <div className="mt-8 mb-4">
            <h2 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Riwayat Surat Administrasi
            </h2>
            {isLoadingDocs ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
            ) : riwayatSurat.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center border border-gray-100 shadow-sm">
                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Belum ada riwayat surat untuk Anda.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {riwayatSurat.map((surat: any) => (
                        <div key={`${surat.category}-${surat.id}`} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                {surat.category.includes('Peringatan') ? <AlertCircle className="w-5 h-5 text-orange-500" /> : <FileText className="w-5 h-5 text-primary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm text-gray-900 truncate">{surat.category}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{safeFormat(surat.createdAt, "dd MMMM yyyy")}</p>
                                {surat.notes && <p className="text-[11px] text-gray-600 mt-2 bg-gray-50 p-2 rounded">{surat.notes}</p>}
                                {surat.reason && <p className="text-[11px] text-gray-600 mt-2 bg-gray-50 p-2 rounded">{surat.reason}</p>}
                                
                                {surat.documentUrl && (
                                    <div className="mt-3">
                                        <a href={resolveFileUrl(surat.documentUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                                            <Download className="w-3.5 h-3.5" />
                                            Unduh PDF
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </main>

      <BottomNav />

      {/* Detail Dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="rounded-3xl max-w-sm md:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {selectedAnnouncement?.imageUrl && (
            <div
              className="relative cursor-pointer group/zoom"
              onClick={() => {
                // Dispatch custom event to open fullscreen image (handled by a top-level listener or state)
                // We'll add local state for easier handling here
                const event = new CustomEvent('open-fullscreen-image', { detail: selectedAnnouncement.imageUrl });
                window.dispatchEvent(event);
              }}
            >
              <img
                src={resolveFileUrl(selectedAnnouncement.imageUrl)}
                alt={selectedAnnouncement.title}
                className="w-full h-56 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/zoom:bg-black/20 transition-colors flex items-center justify-center">
                <ExternalLink className="text-white opacity-0 group-hover/zoom:opacity-100 w-8 h-8 drop-shadow-md transition-opacity" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent pointer-events-none" />
              <h2 className="absolute bottom-4 left-5 right-5 text-white font-bold text-lg leading-tight drop-shadow-lg pointer-events-none">
                {selectedAnnouncement.title}
              </h2>
            </div>
          )}
          <div className="p-5 space-y-4">
            {!selectedAnnouncement?.imageUrl && (
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">{selectedAnnouncement?.title}</DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Detail informasi pengumuman.
                </DialogDescription>
              </DialogHeader>
            )}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {safeFormat(selectedAnnouncement?.createdAt, "EEEE, dd MMMM yyyy • HH:mm")}
            </span>
            <div className="ql-snow">
              <div 
                className="ql-editor !p-0 text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none prose-p:my-3 prose-headings:my-4 prose-ul:my-2 prose-ol:my-2 prose-p:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement?.content || '' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 border-t pt-4">
              {selectedAnnouncement?.imageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(selectedAnnouncement);
                  }}
                  className="flex-1 rounded-xl text-xs"
                >
                  <Download className="w-3 h-3 mr-1" /> Download
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedAnnouncement) handleShareWhatsApp(selectedAnnouncement);
                }}
                className="flex-1 rounded-xl text-xs text-primary border-primary/20 hover:bg-primary/5"
              >
                <Share2 className="w-3 h-3 mr-1" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
