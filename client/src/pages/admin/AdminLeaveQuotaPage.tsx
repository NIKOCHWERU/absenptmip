import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Search, Filter, Edit2, RotateCcw, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { toTitleCase } from "@/lib/utils";

const DEFAULT_QUOTA = 12;

export default function AdminLeaveQuotaPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [editUser, setEditUser] = useState<any | null>(null);
    const [editQuotaValue, setEditQuotaValue] = useState<number>(DEFAULT_QUOTA);

    const { data: quotaList, isLoading } = useQuery<any[]>({
        queryKey: ["/api/admin/leave-quota"],
    });

    const updateMutation = useMutation({
        mutationFn: async ({ userId, leaveQuota }: { userId: number; leaveQuota: number }) => {
            const res = await fetch(`/api/admin/leave-quota/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaveQuota }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Gagal memperbarui jatah cuti");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/leave-quota"] });
            toast({ title: "Berhasil", description: "Jatah cuti karyawan berhasil diperbarui." });
            setEditUser(null);
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        },
    });

    const resetMutation = useMutation({
        mutationFn: async (userId: number) => {
            const res = await fetch(`/api/admin/leave-quota/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaveQuota: DEFAULT_QUOTA }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Gagal mereset jatah cuti");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/leave-quota"] });
            toast({ title: "Berhasil", description: `Jatah cuti direset ke ${DEFAULT_QUOTA} hari.` });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        },
    });

    const handleReset = (user: any) => {
        if (confirm(`Reset jatah cuti ${toTitleCase(user.fullName)} ke ${DEFAULT_QUOTA} hari?`)) {
            resetMutation.mutate(user.id);
        }
    };

    const handleEditOpen = (user: any) => {
        setEditUser(user);
        setEditQuotaValue(user.leaveQuota ?? DEFAULT_QUOTA);
    };

    const handleSaveEdit = () => {
        if (!editUser) return;
        if (editQuotaValue < 0 || editQuotaValue > 365) {
            toast({ title: "Error", description: "Jatah cuti harus antara 0-365 hari", variant: "destructive" });
            return;
        }
        updateMutation.mutate({ userId: editUser.id, leaveQuota: editQuotaValue });
    };

    const filteredList = (quotaList || []).filter(u => {
        const name = (u.fullName || "").toLowerCase();
        const nik = (u.nik || u.username || "").toLowerCase();
        const search = searchTerm.toLowerCase();
        return name.includes(search) || nik.includes(search);
    });

    const getStatusColor = (remaining: number, quota: number) => {
        const pct = quota > 0 ? remaining / quota : 0;
        if (pct <= 0) return "text-red-600 bg-red-50 border-red-100";
        if (pct <= 0.3) return "text-orange-600 bg-orange-50 border-orange-100";
        return "text-primary bg-primary/5 border-primary/10";
    };

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kelola Jatah Cuti</h1>
                        <p className="text-sm text-gray-500">
                            Atur sisa dan kuota jatah cuti tahunan seluruh tenaga kerja. Default: {DEFAULT_QUOTA} hari/tahun.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            className="rounded-lg gap-2 cursor-pointer bg-white"
                            onClick={() => setLocation("/admin/leaves")}
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
                                    placeholder="Cari nama karyawan atau NIK..."
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
                                            <th className="px-6 py-4">Sisa Cuti</th>
                                            <th className="px-6 py-4">Sudah Digunakan</th>
                                            <th className="px-6 py-4">Total Kuota</th>
                                            <th className="px-6 py-4 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-200" />
                                                </td>
                                            </tr>
                                        ) : filteredList.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                    Tidak ditemukan data karyawan.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredList.map((emp) => (
                                                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                                    {/* Tenaga Kerja */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                                {toTitleCase(emp.fullName).charAt(0)}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-900 block">{toTitleCase(emp.fullName)}</span>
                                                                <span className="text-[10px] text-gray-400 font-mono">NIK: {emp.nik || emp.username || '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Sisa Cuti */}
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(emp.remainingDays, emp.leaveQuota)}`}>
                                                            {emp.remainingDays} / {emp.leaveQuota} hari
                                                        </span>
                                                    </td>

                                                    {/* Sudah Digunakan */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                                                                <div
                                                                    className="bg-primary h-2 rounded-full transition-all"
                                                                    style={{ width: `${Math.min(100, emp.leaveQuota > 0 ? (emp.usedDays / emp.leaveQuota) * 100 : 0)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-600">{emp.usedDays} hari</span>
                                                        </div>
                                                    </td>

                                                    {/* Total Kuota */}
                                                    <td className="px-6 py-4">
                                                        <span className="font-bold text-gray-700 flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                            {emp.leaveQuota} hari/tahun
                                                        </span>
                                                    </td>

                                                    {/* Aksi */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50 h-8 gap-1.5 px-3"
                                                                onClick={() => handleEditOpen(emp)}
                                                                title="Edit Jatah Cuti"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                <span className="hidden xl:inline">Edit</span>
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="rounded-lg text-orange-600 border-orange-100 hover:bg-orange-50 h-8 gap-1.5 px-3"
                                                                onClick={() => handleReset(emp)}
                                                                disabled={resetMutation.isPending}
                                                                title={`Reset ke ${DEFAULT_QUOTA} hari`}
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                                <span className="hidden xl:inline">Reset</span>
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
                </div>
            </div>

            {/* Modal Edit Jatah Cuti */}
            <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
                {editUser && (
                    <DialogContent className="sm:max-w-sm bg-white rounded-2xl p-6">
                        <DialogHeader>
                            <DialogTitle className="text-base font-bold text-gray-900">
                                Edit Jatah Cuti: {toTitleCase(editUser.fullName)}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-gray-500">
                                NIK: <strong>{editUser.nik || editUser.username || "-"}</strong> | Jabatan: {editUser.position || "-"}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            {/* Info Penggunaan */}
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
                                <p>Sudah digunakan (tahun ini): <strong>{editUser.usedDays} hari</strong></p>
                                <p>Sisa saat ini: <strong>{editUser.remainingDays} hari</strong></p>
                            </div>

                            {/* Input Kuota Baru */}
                            <div>
                                <label className="text-xs font-semibold text-gray-700 block mb-2">
                                    Total Kuota Cuti (hari/tahun)
                                </label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={365}
                                    value={editQuotaValue}
                                    onChange={(e) => setEditQuotaValue(Number(e.target.value))}
                                    className="rounded-xl h-11 text-center text-lg font-bold"
                                    placeholder="12"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Default: {DEFAULT_QUOTA} hari. Sisa baru: <strong>{Math.max(0, editQuotaValue - editUser.usedDays)} hari</strong>
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditUser(null)}
                                    className="rounded-xl"
                                >
                                    Batalkan
                                </Button>
                                <Button
                                    onClick={handleSaveEdit}
                                    disabled={updateMutation.isPending}
                                    className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold"
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        "Simpan"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
