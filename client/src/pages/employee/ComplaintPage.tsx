import { useAuth } from "@/hooks/use-auth";
import { CompanyHeader } from "@/components/CompanyHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Send, Image, Clock, CheckCircle, AlertCircle, X, Camera } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { safeCompressImage, uploadFileWithProgress, resolveFileUrl } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { CameraModal } from "@/components/CameraModal";

interface Complaint {
    id: number;
    userId: number;
    title: string;
    description: string;
    status: "pending" | "reviewed" | "resolved";
    adminFeedback?: string | null;
    feedbackDocumentUrl?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
    photos?: ComplaintPhoto[];
}

interface ComplaintPhoto {
    id: number;
    complaintId: number;
    photoUrl: string;
    caption: string | null;
}

export default function ComplaintPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [photos, setPhotos] = useState<{ url: string; caption: string; preview: string; id: string }[]>([]);
    const [uploadingState, setUploadingState] = useState<{ [key: string]: number }>({});
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
    
    // Camera & Location State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [locationAddress, setLocationAddress] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch location when camera opens
    useEffect(() => {
        if (isCameraOpen && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                        const data = await res.json();
                        setLocationAddress(data.display_name);
                    } catch (error) {
                        console.error("Gagal mendapatkan alamat:", error);
                    }
                },
                (error) => {
                    console.error("Gagal mengambil lokasi:", error.message);
                }
            );
        }
    }, [isCameraOpen]);

    const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
        queryKey: ["/api/employee/complaints"],
    });

    const complaintPhotos = selectedComplaint?.photos || [];

    const submitMutation = useMutation({
        mutationFn: async () => {
            const body = {
                title,
                description,
                photos: photos.filter(p => p.url).map(p => ({ url: p.url, caption: p.caption }))
            };

            const res = await fetch("/api/employee/complaints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Gagal mengirim pengaduan");
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/employee/complaints"] });
            setIsFormOpen(false);
            setTitle("");
            setDescription("");
            setPhotos([]);
            toast({ title: "Pengaduan Terkirim", description: "Terima kasih, pengaduan Anda sedang diproses.", className: "bg-primary/50 text-white" });
        },
        onError: (e: any) => {
            toast({ title: "Gagal", description: e.message, variant: "destructive" });
        },
    });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            const id = Math.random().toString(36).substring(7);
            const preview = URL.createObjectURL(file);
            setPhotos(prev => [...prev, { url: "", caption: "", preview, id }]);
            setUploadingState(prev => ({ ...prev, [id]: 0 }));

            try {
                const compressedFile = await safeCompressImage(file);
                const url = await uploadFileWithProgress(
                    compressedFile, 
                    (p) => setUploadingState(prev => ({ ...prev, [id]: p })),
                    "complaint" // Upload to Pengaduan folder
                );
                setPhotos(prev => prev.map(p => p.id === id ? { ...p, url } : p));
                setUploadingState(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            } catch (error: any) {
                toast({ title: "Gagal Upload", description: error.message, variant: "destructive" });
                setPhotos(prev => prev.filter(p => p.id !== id));
            }
        }
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAddPhoto = () => {
        setIsCameraOpen(true);
    };

    const handleCameraCapture = async (photoData: string, caption: string = "") => {
        setIsCameraOpen(false); // Close camera modal
        const id = Math.random().toString(36).substring(7);
        const preview = photoData;
        
        setPhotos(prev => [...prev, { url: "", caption, preview, id }]);
        setUploadingState(prev => ({ ...prev, [id]: 0 }));

        try {
            const response = await fetch(photoData);
            const blob = await response.blob();
            
            const url = await uploadFileWithProgress(
                blob,
                (p) => setUploadingState(prev => ({ ...prev, [id]: p })),
                "complaint" // Upload to Pengaduan folder
            );
            
            setPhotos(prev => prev.map(p => p.id === id ? { ...p, url } : p));
            setUploadingState(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } catch (error: any) {
            toast({ title: "Gagal Upload", description: error.message, variant: "destructive" });
            setPhotos(prev => prev.filter(p => p.id !== id));
        }
    };

    const removePhoto = (id: string) => {
        setPhotos((prev) => prev.filter((p) => p.id !== id));
        setUploadingState(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const updateCaption = (id: string, caption: string) => {
        setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return (
                    <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> Menunggu
                    </span>
                );
            case "reviewed":
                return (
                    <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Ditinjau
                    </span>
                );
            case "resolved":
                return (
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary-foreground px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Selesai
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <CompanyHeader title="Pengaduan Saya" />

            <main className="px-4 -mt-6 max-w-lg mx-auto space-y-4">
                <div className="flex justify-end mb-2">
                    <Button
                        onClick={() => setIsFormOpen(true)}
                        size="sm"
                        className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Buat Pengaduan
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : complaints.length === 0 ? (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100"
                    >
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Belum ada pengaduan</p>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {complaints.map((c, i) => (
                            <motion.div
                                key={c.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => setSelectedComplaint(c)}
                                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-gray-800 text-sm">{c.title}</h3>
                                    {getStatusBadge(c.status)}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{c.description}</p>
                                <p className="text-[10px] text-gray-400">
                                    {c.createdAt && format(new Date(c.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            <BottomNav />

            {/* Create Complaint Dialog */}
            <Dialog open={isFormOpen} onOpenChange={(open) => {
                if (!open && isCameraOpen) return; // Mencegah form tertutup saat kamera aktif
                setIsFormOpen(open);
            }}>
                <DialogContent 
                    className="rounded-3xl max-w-sm md:max-w-md p-5 max-h-[90vh] overflow-y-auto"
                    onInteractOutside={(e) => {
                        if (isCameraOpen) e.preventDefault();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (isCameraOpen) e.preventDefault();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="text-center text-lg font-bold">Buat Pengaduan</DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground">
                            Isi formulir di bawah ini untuk mengajukan keluhan atau masalah.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="Judul Pengaduan..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="rounded-xl"
                        />
                        <Textarea
                            placeholder="Jelaskan pengaduan Anda secara detail..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="resize-none rounded-xl min-h-[100px]"
                        />

                        {/* Photos */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-500">Foto Bukti</p>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="rounded-full text-xs"
                                    >
                                        <Image className="w-3 h-3 mr-1" /> Upload
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddPhoto}
                                        className="rounded-full text-xs"
                                    >
                                        <Camera className="w-3 h-3 mr-1" /> Live
                                    </Button>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            {photos.map((p) => (
                                <div key={p.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 relative overflow-hidden">
                                    <div className="flex items-start gap-3">
                                        <div className="relative w-20 h-20 shrink-0">
                                            <img src={p.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                                            {uploadingState[p.id] !== undefined && (
                                                <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center rounded-lg">
                                                    <Loader2 className="w-5 h-5 animate-spin text-primary mb-1" />
                                                    <span className="text-[10px] font-bold text-primary">{uploadingState[p.id]}%</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                placeholder="Keterangan foto..."
                                                value={p.caption}
                                                onChange={(e) => updateCaption(p.id, e.target.value)}
                                                className="text-xs rounded-lg"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removePhoto(p.id)}
                                                className="text-red-500 text-xs h-7"
                                            >
                                                <X className="w-3 h-3 mr-1" /> Hapus
                                            </Button>
                                        </div>
                                    </div>
                                    {uploadingState[p.id] !== undefined && (
                                        <Progress value={uploadingState[p.id]} className="absolute bottom-0 left-0 right-0 h-1 rounded-none" />
                                    )}
                                </div>
                            ))}
                        </div>

                        <Button
                            onClick={() => submitMutation.mutate()}
                            disabled={!title || !description || submitMutation.isPending || Object.keys(uploadingState).length > 0}
                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
                        >
                            {submitMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" /> Kirim Pengaduan
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
                <DialogContent className="rounded-3xl max-w-sm md:max-w-md p-5 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">{selectedComplaint?.title}</DialogTitle>
                        <DialogDescription>
                            Detail dan status pengaduan Anda.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedComplaint && getStatusBadge(selectedComplaint.status)}
                            <span className="text-[10px] text-gray-400">
                                {selectedComplaint?.createdAt &&
                                    format(new Date(selectedComplaint.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                            </span>
                        </div>
                        
                        {selectedComplaint?.status === "resolved" && (
                            <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 space-y-2 mt-2">
                                <p className="text-xs font-bold text-primary">Tanggapan Admin:</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedComplaint.adminFeedback || "-"}</p>
                                {selectedComplaint.feedbackDocumentUrl && (
                                    <a href={resolveFileUrl(selectedComplaint.feedbackDocumentUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline">
                                        <CheckCircle className="w-3 h-3" /> Lihat Lampiran Dokumen
                                    </a>
                                )}
                                <p className="text-[10px] text-gray-500 mt-2">Diselesaikan pada {selectedComplaint.resolvedAt ? format(new Date(selectedComplaint.resolvedAt), "dd MMM yyyy, HH:mm") : "-"}</p>
                            </div>
                        )}

                        <p className="text-sm text-gray-600 whitespace-pre-wrap pt-2">{selectedComplaint?.description}</p>

                        {complaintPhotos.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500">Foto Lampiran</p>
                                {complaintPhotos.map((photo) => (
                                    <div key={photo.id} className="space-y-1">
                                        <img
                                            src={resolveFileUrl(photo.photoUrl)}
                                            alt={photo.caption || ""}
                                            className="w-full rounded-xl border border-gray-100"
                                        />
                                        {photo.caption && (
                                            <p className="text-xs text-gray-400 italic">{photo.caption}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Camera Modal */}
            <CameraModal
                open={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={async (photoData, caption) => {
                    setIsCameraOpen(false);
                    await handleCameraCapture(photoData, caption);
                }}
                locationAddress={locationAddress}
                allowCaption={true}
            />
        </div>
    );
}
