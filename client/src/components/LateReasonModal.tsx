import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, RefreshCw, Check, X, SwitchCamera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LateReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, photo?: string) => void;
    expectedTime?: string;
}

export function LateReasonModal({ isOpen, onClose, onSubmit, expectedTime = "07:00" }: LateReasonModalProps) {
    const [reason, setReason] = useState("");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { toast } = useToast();

    const startCamera = async (overrideMode?: "environment" | "user") => {
        const modeToUse = overrideMode || facingMode;
        try {
            setIsCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: modeToUse }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            if (overrideMode) setFacingMode(overrideMode);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast({
                title: "Gagal mengakses kamera",
                description: "Pastikan Anda memberikan izin akses kamera.",
                variant: "destructive",
            });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const toggleCamera = () => {
        stopCamera();
        const newMode = facingMode === "environment" ? "user" : "environment";
        startCamera(newMode);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const photo = canvas.toDataURL("image/png");
                setCapturedPhoto(photo);
                stopCamera();
            }
        }
    };

    const handleSubmit = () => {
        if (!reason.trim()) {
            toast({
                title: "Alasan wajib diisi",
                description: "Silakan berikan alasan mengapa Anda terlambat.",
                variant: "destructive",
            });
            return;
        }
        onSubmit(reason, capturedPhoto || undefined);
        setReason("");
        setCapturedPhoto(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md w-full bg-white border border-zinc-200 text-zinc-900 rounded-3xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="space-y-1.5 pb-1">
                    <DialogTitle className="text-xl font-black text-center text-red-600 tracking-tight uppercase">
                        Anda Terlambat
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-500 text-center font-medium leading-relaxed">
                        Batas waktu pukul {expectedTime} telah terlewati. <br />
                        Mohon sampaikan alasan keterlambatan Anda di bawah ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Keterangan Alasan <span className="text-red-500">*</span></label>
                        <Textarea
                            placeholder="Contoh: Terjebak macet parah, ada kendala pada kendaraan, kepentingan mendesak, dll."
                            className="bg-zinc-50 border-zinc-200 text-zinc-900 w-full min-h-[90px] rounded-2xl focus:ring-red-500 focus:border-red-500 transition-all placeholder:text-zinc-400 text-xs p-3 resize-none font-medium"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Foto (Opsional)</label>
                        <div className="relative aspect-video bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-red-200 group">
                            {capturedPhoto ? (
                                <>
                                    <img src={capturedPhoto} alt="Bukti Terlambat" className="w-full h-full object-cover" />
                                    <Button
                                        size="icon"
                                        variant="destructive"
                                        className="absolute top-3 right-3 rounded-full shadow-lg h-8 w-8"
                                        onClick={() => setCapturedPhoto(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : isCameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        <Button
                                            size="icon"
                                            variant="secondary"
                                            className="rounded-full shadow-lg bg-white/50 backdrop-blur-md hover:bg-white/80 h-8 w-8"
                                            onClick={toggleCamera}
                                        >
                                            <SwitchCamera className="h-4 w-4 text-black" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="rounded-full shadow-lg h-8 w-8"
                                            onClick={stopCamera}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 hover:bg-red-700 shadow-xl px-6 h-9 text-xs font-bold"
                                        size="sm"
                                        onClick={capturePhoto}
                                    >
                                        Ambil Foto
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center space-y-2 p-4 flex flex-col items-center">
                                    <div className="p-3 bg-white shadow-sm rounded-2xl inline-block group-hover:scale-105 transition-transform">
                                        <Camera className="h-6 w-6 text-zinc-300" />
                                    </div>
                                    <p className="text-[11px] text-zinc-400 font-medium">Opsional: Lampirkan bukti foto jika diperlukan</p>
                                    <div className="flex gap-2 w-full pt-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-zinc-200 hover:bg-zinc-100 rounded-xl px-3 font-semibold gap-1.5 flex-1 text-xs h-9"
                                            onClick={() => startCamera()}
                                        >
                                            <Camera className="h-3.5 w-3.5" />
                                            Buka Kamera
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-zinc-200 hover:bg-zinc-100 rounded-xl px-3 font-semibold gap-1.5 flex-1 text-xs h-9"
                                            onClick={() => document.getElementById('gallery-upload')?.click()}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Pilih Galeri
                                        </Button>
                                        <input
                                            id="gallery-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setCapturedPhoto(reader.result as string);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-col gap-2 pt-3 border-t border-zinc-100 mt-2">
                    <Button
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl h-12 shadow-md shadow-red-100 text-sm"
                        onClick={handleSubmit}
                    >
                        Simpan & Masuk Sesi
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full text-zinc-400 hover:text-red-600 hover:bg-red-50 font-bold rounded-2xl h-9 text-xs"
                        onClick={onClose}
                    >
                        Batalkan
                    </Button>
                </DialogFooter>
            </DialogContent>
            <canvas ref={canvasRef} className="hidden" />
        </Dialog>
    );
}

