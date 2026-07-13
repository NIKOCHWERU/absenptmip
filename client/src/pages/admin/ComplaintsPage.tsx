import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Clock, CheckCircle, AlertCircle, Eye, User, Image as ImageIcon, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";
import { toTitleCase, resolveFileUrl, uploadFileWithProgress } from "@/lib/utils";

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

interface UserInfo {
    id: number;
    fullName: string;
    username: string;
    nik: string;
    branch: string;
    position: string;
}

export default function AdminComplaintsPage() {
    const { toast } = useToast();
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
    const [sortField, setSortField] = useState<string>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    const [isResolving, setIsResolving] = useState(false);
    const [adminFeedback, setAdminFeedback] = useState("");
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [docUrl, setDocUrl] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
        queryKey: ["/api/admin/complaints"],
    });

    const { data: allUsers = [] } = useQuery<UserInfo[]>({
        queryKey: ["/api/admin/users"],
    });

    const complaintPhotos = selectedComplaint?.photos || [];

    const statusMutation = useMutation({
        mutationFn: async (data: { id: number; status: string; adminFeedback?: string; feedbackDocumentUrl?: string }) => {
            const res = await fetch(`/api/admin/complaints/${data.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Gagal update status");
            return res.json();
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ["/api/admin/complaints"] });
            const previousComplaints = queryClient.getQueryData<Complaint[]>(["/api/admin/complaints"]);
            if (previousComplaints) {
                queryClient.setQueryData<Complaint[]>(["/api/admin/complaints"], old => {
                    if (!old) return old;
                    return old.map(c => c.id === variables.id ? { 
                        ...c, 
                        status: variables.status as any,
                        adminFeedback: variables.adminFeedback || c.adminFeedback,
                        feedbackDocumentUrl: variables.feedbackDocumentUrl || c.feedbackDocumentUrl,
                        resolvedAt: variables.status === 'resolved' ? new Date().toISOString() : c.resolvedAt
                    } : c);
                });
            }
            setSelectedComplaint(null);
            setIsResolving(false);
            setAdminFeedback("");
            setDocUrl("");
            return { previousComplaints };
        },
        onSuccess: () => {
            toast({ title: "Status diperbarui", className: "bg-primary text-white" });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
        },
        onError: (e: any, variables, context: any) => {
            if (context?.previousComplaints) {
                queryClient.setQueryData(["/api/admin/complaints"], context.previousComplaints);
            }
            toast({ title: "Gagal", description: e.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/complaints/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Gagal menghapus pengaduan");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Pengaduan berhasil dihapus", className: "bg-primary text-white" });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
        },
        onError: (e: any) => {
            toast({ title: "Gagal", description: e.message, variant: "destructive" });
        },
    });

    const getUserName = (userId: number) => {
        const u = allUsers.find((u) => u.id === userId);
        const name = u ? u.fullName : `User #${userId}`;
        return toTitleCase(name);
    };

    const sortedComplaints = [...complaints].sort((a, b) => {
        let valA: any, valB: any;
        if (sortField === 'name') {
            valA = getUserName(a.userId).toLowerCase();
            valB = getUserName(b.userId).toLowerCase();
        } else if (sortField === 'createdAt') {
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
        } else if (sortField === 'status') {
            valA = a.status || '';
            valB = b.status || '';
        } else {
            valA = (a as any)[sortField] || '';
            valB = (b as any)[sortField] || '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

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
                    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Selesai
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Pengaduan Tenaga Kerja</h1>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={sortField === 'createdAt' ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleSort('createdAt')}
                            className="text-xs rounded-full h-8 px-3"
                        >
                            Urutan: Terbaru {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </Button>
                        <Button
                            variant={sortField === 'name' ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleSort('name')}
                            className="text-xs rounded-full h-8 px-3"
                        >
                            Berdasarkan Nama {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </Button>
                        <Button
                            variant={sortField === 'status' ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleSort('status')}
                            className="text-xs rounded-full h-8 px-3"
                        >
                            Berdasarkan Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : sortedComplaints.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Belum ada pengaduan</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                        <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Tanggal</TableHead>
                                        <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Karyawan</TableHead>
                                        <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Judul Pengaduan</TableHead>
                                        <TableHead className="font-semibold text-gray-700 whitespace-nowrap">Status</TableHead>
                                        <TableHead className="font-semibold text-gray-700 whitespace-nowrap text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedComplaints.map((c) => (
                                        <TableRow 
                                            key={c.id} 
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            onClick={() => setSelectedComplaint(c)}
                                        >
                                            <TableCell className="whitespace-nowrap text-xs text-gray-500">
                                                {(() => {
                                                    if (!c.createdAt) return "-";
                                                    let d = new Date(c.createdAt);
                                                    // Fix for past records that were saved with +8 hours offset by defaultNow()
                                                    if (d.getTime() > Date.now() + 60 * 60 * 1000) {
                                                        d = new Date(d.getTime() - 8 * 60 * 60 * 1000);
                                                    }
                                                    return format(d, "dd MMM yyyy, HH:mm", { locale: idLocale });
                                                })()}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap font-medium text-gray-800 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3 h-3 text-gray-400" />
                                                    {getUserName(c.userId)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-[250px] truncate text-gray-600 text-xs font-semibold">
                                                {c.title}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {getStatusBadge(c.status)}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-7 w-7 text-primary hover:bg-primary/10"
                                                        onClick={() => setSelectedComplaint(c)}
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        className="h-7 w-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                        disabled={deleteMutation.isPending}
                                                        onClick={() => {
                                                            if (confirm("Yakin ingin menghapus pengaduan ini beserta dokumennya?")) {
                                                                deleteMutation.mutate(c.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedComplaint} onOpenChange={(open) => {
                if (!open) {
                    setSelectedComplaint(null);
                    setIsResolving(false);
                }
            }}>
                <DialogContent className="rounded-xl max-w-md p-5 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">{selectedComplaint?.title}</DialogTitle>
                        <DialogDescription>
                            Detail dan status pengaduan tenaga kerja.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedComplaint && getStatusBadge(selectedComplaint.status)}
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <User className="w-3 h-3" /> {selectedComplaint && getUserName(selectedComplaint.userId)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {(() => {
                                    if (!selectedComplaint?.createdAt) return "-";
                                    let d = new Date(selectedComplaint.createdAt);
                                    if (d.getTime() > Date.now() + 60 * 60 * 1000) {
                                        d = new Date(d.getTime() - 8 * 60 * 60 * 1000);
                                    }
                                    return format(d, "dd MMM yyyy, HH:mm", { locale: idLocale });
                                })()}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedComplaint?.description}</p>

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

                        {/* Status Update Buttons */}
                        {isResolving ? (
                            <div className="border-t pt-4 space-y-4">
                                <p className="text-sm font-bold text-gray-800">Tandai Selesai</p>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-600">Catatan/Tanggapan Admin (Opsional)</label>
                                    <textarea
                                        value={adminFeedback}
                                        onChange={(e) => setAdminFeedback(e.target.value)}
                                        className="w-full text-sm border-gray-200 rounded-lg shadow-sm"
                                        rows={3}
                                        placeholder="Masukkan tanggapan untuk pengaduan ini..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-600">Lampiran Dokumen (Opsional)</label>
                                    <input 
                                        type="file"
                                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setUploadingDoc(true);
                                            try {
                                                const url = await uploadFileWithProgress(file, setUploadProgress);
                                                setDocUrl(url);
                                            } catch (err) {
                                                toast({ title: "Gagal upload", variant: "destructive" });
                                            } finally {
                                                setUploadingDoc(false);
                                            }
                                        }}
                                    />
                                    {uploadingDoc && <p className="text-xs text-primary">Mengunggah... {uploadProgress}%</p>}
                                    {docUrl && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Dokumen terlampir</p>}
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setIsResolving(false)}>Batal</Button>
                                    <Button 
                                        size="sm"
                                        disabled={statusMutation.isPending || uploadingDoc}
                                        onClick={() => {
                                            if (selectedComplaint) {
                                                statusMutation.mutate({ 
                                                    id: selectedComplaint.id, 
                                                    status: "resolved",
                                                    adminFeedback,
                                                    feedbackDocumentUrl: docUrl
                                                });
                                            }
                                        }}
                                    >
                                        {statusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1"/> : <CheckCircle className="w-4 h-4 mr-1"/>}
                                        Simpan & Selesai
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="border-t pt-4 space-y-2">
                                {selectedComplaint?.status === "resolved" && (
                                    <div className="bg-gray-50 p-3 rounded-lg mb-4 space-y-2 border border-gray-100">
                                        <p className="text-xs font-bold text-gray-700">Tanggapan Admin</p>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedComplaint.adminFeedback || "-"}</p>
                                        {selectedComplaint.feedbackDocumentUrl && (
                                            <a href={resolveFileUrl(selectedComplaint.feedbackDocumentUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline">
                                                <ImageIcon className="w-3 h-3" /> Lihat Lampiran
                                            </a>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-2">Diselesaikan pada {selectedComplaint.resolvedAt ? format(new Date(selectedComplaint.resolvedAt), "dd MMM yyyy, HH:mm") : "-"}</p>
                                    </div>
                                )}
                                <p className="text-xs font-semibold text-gray-500 mb-2">Ubah Status:</p>
                                <div className="flex gap-2 flex-wrap">
                                <Button
                                    disabled={selectedComplaint?.status === "pending" || statusMutation.isPending}
                                    onClick={() => selectedComplaint && statusMutation.mutate({ id: selectedComplaint.id, status: "pending" })}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                                >
                                    <Clock className="w-3 h-3 mr-1" /> Menunggu
                                </Button>
                                <Button
                                    disabled={selectedComplaint?.status === "reviewed" || statusMutation.isPending}
                                    onClick={() => selectedComplaint && statusMutation.mutate({ id: selectedComplaint.id, status: "reviewed" })}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-blue-700 border-blue-200 hover:bg-blue-50"
                                >
                                    <AlertCircle className="w-3 h-3 mr-1" /> Ditinjau
                                </Button>
                                <Button
                                    disabled={selectedComplaint?.status === "resolved" || statusMutation.isPending}
                                    onClick={() => setIsResolving(true)}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-green-700 border-green-200 hover:bg-green-50"
                                >
                                    <CheckCircle className="w-3 h-3 mr-1" /> Selesai
                                </Button>
                            </div>
                        </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
