import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Attendance, Shift } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import React, { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Search, ArrowUpDown, MessageSquare, Plus, Edit2, Trash2, Camera, Image as ImageIcon } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { differenceInMinutes } from "date-fns";
import { calculateDailyTotal, calculateDuration, formatDuration, calculateDurationSeconds, formatDurationFull } from "@/lib/attendance";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { TimePicker24h } from "@/components/TimePicker24h";

const loadHtml2Pdf = () => {
    return new Promise<any>((resolve, reject) => {
        if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
            return;
        }
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve((window as any).html2pdf);
        script.onerror = () => reject(new Error("Gagal memuat script html2pdf"));
        document.head.appendChild(script);
    });
};

const loadJSZip = () => {
    return new Promise<any>((resolve, reject) => {
        if ((window as any).JSZip) {
            resolve((window as any).JSZip);
            return;
        }
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        script.onload = () => resolve((window as any).JSZip);
        script.onerror = () => reject(new Error("Gagal memuat script JSZip"));
        document.head.appendChild(script);
    });
};

const generatePdfBlobFromHtml = async (htmlContent: string, pdfFileName: string): Promise<Blob> => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '794px';
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '9990';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';
    container.style.color = '#1e293b';
    container.style.fontFamily = 'Arial, Helvetica, sans-serif';
    container.style.fontSize = '11px';
    container.style.padding = '28px 36px';
    container.style.boxSizing = 'border-box';
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(res => {
            img.onload = res;
            img.onerror = res;
        });
    }));

    try {
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     pdfFileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: 794 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        const html2pdf = (window as any).html2pdf;
        const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');
        return pdfBlob;
    } finally {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
    }
};

export default function RecapPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState("");

    const { data: config } = useQuery<any>({
        queryKey: ["/api/config"],
    });
    const namaPt = config?.namaPt || import.meta.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
    const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PT MIP";
    const alamatPt = config?.alamatPt || import.meta.env.VITE_ALAMAT_PT || "";

    const [targetDate, setTargetDate] = useState(new Date());
    const [selectedPhotoRecord, setSelectedPhotoRecord] = useState<Attendance | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState<Partial<Attendance> | null>(null);
    const [manualEntry, setManualEntry] = useState({
        userId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        checkIn: "",
        checkOut: "",
        breakStart: "",
        breakEnd: "",
        status: "present",
        notes: "",
        shift: "-"
    });

    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
    const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    let startDate: Date;
    let endDate: Date;

    if (reportType === "daily") {
        startDate = startOfDay(targetDate);
        endDate = endOfDay(targetDate);
    } else if (reportType === "weekly") {
        startDate = startOfWeek(targetDate, { weekStartsOn: 1 });
        endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
    } else if (reportType === "custom") {
        startDate = startOfDay(new Date(customStartDate));
        endDate = endOfDay(new Date(customEndDate));
    } else {
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 26);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 25);
    }

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: allAttendance } = useQuery<Attendance[]>({
        queryKey: [`/api/attendance?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`],
    });

    const { data: allOvertimes } = useQuery<any[]>({
        queryKey: ["/api/admin/overtimes"],
    });

    const { data: allShifts } = useQuery<Shift[]>({
        queryKey: ["/api/shifts"],
    });

    const [showOvertimeInput, setShowOvertimeInput] = useState(false);
    const [manualOvertime, setManualOvertime] = useState({
        id: null as number | null,
        startTime: "",
        endTime: "",
        description: "",
    });

    const handlePrev = () => {
        if (reportType === "daily") setTargetDate(d => subDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => subDays(d, 7));
        else setTargetDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (reportType === "daily") setTargetDate(d => addDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => addDays(d, 7));
        else setTargetDate(d => addMonths(d, 1));
    };

    const [searchName, setSearchName] = useState("");
    const [sortField, setSortField] = useState<'date' | 'name'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchName, reportType, targetDate, customStartDate, customEndDate]);

    const getUserName = (userId: number) => {
        return users?.find(u => u.id === userId)?.fullName || null;
    };

    const filteredRecords = allAttendance?.filter(att => {
        if (!getUserName(att.userId)) return false;

        // Sembunyikan jika belum mulai absen (checkIn null) & bukan izin/sakit/cuti/off resmi
        const hasStartedAttendance = !!att.checkIn || ['sick', 'permission', 'cuti', 'off'].includes(att.status || '');
        if (!hasStartedAttendance) return false;

        const attDate = new Date(att.date);
        const d = new Date(attDate);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    }) || [];

    const processedData = filteredRecords
        .filter(att => {
            const name = (getUserName(att.userId) || '').toLowerCase();
            return name.includes(searchName.toLowerCase());
        })
        .sort((a, b) => {
            if (sortField === 'date') {
                const dateA = new Date(a.date).setHours(0, 0, 0, 0);
                const dateB = new Date(b.date).setHours(0, 0, 0, 0);
                if (dateA !== dateB) return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                const nameA = (getUserName(a.userId) || '').toLowerCase();
                const nameB = (getUserName(b.userId) || '').toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                const checkInA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                const checkInB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                return sortOrder === 'desc' ? checkInB - checkInA : checkInA - checkInB;
            } else {
                const nameA = (getUserName(a.userId) || '').toLowerCase();
                const nameB = (getUserName(b.userId) || '').toLowerCase();
                if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1;
                if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1;
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                return timeB - timeA;
            }
        });

    const totalPages = Math.ceil(processedData.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = processedData.slice(startIndex, startIndex + itemsPerPage);

    const toggleSort = (field: 'date' | 'name') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const safeFormatDate = (dateVal: any, formatStr: string, options?: any) => {
        try {
            if (!dateVal) return "";
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return "";
            return format(d, formatStr, options);
        } catch (e) {
            return "";
        }
    };

    const dailyTotals = new Map<string, { mins: number; complete: boolean }>();
    processedData.forEach(row => {
        const dateKey = safeFormatDate(row.date, "yyyy-MM-dd");
        const key = `${dateKey}-${row.userId}`;
        if (dateKey && !dailyTotals.has(key)) {
            const dayRecords = processedData.filter(r =>
                safeFormatDate(r.date, "yyyy-MM-dd") === dateKey &&
                r.userId === row.userId
            );
            const { netWorkMins, hasAllCheckOuts } = calculateDailyTotal(dayRecords);
            dailyTotals.set(key, { mins: netWorkMins, complete: hasAllCheckOuts });
        }
    });

    const manualMutation = useMutation({
        mutationFn: async (data: any) => {
            const isEdit = !!editingAttendance?.id;
            const url = isEdit ? `/api/admin/attendance/${editingAttendance!.id}` : "/api/admin/attendance/manual";
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text() || "Gagal menyimpan data");
            const attendanceResult = await res.json();
            const targetAttId = editingAttendance?.id || attendanceResult?.id;

            // Simpan Data Lembur Manual jika diisi
            if (targetAttId && showOvertimeInput && manualOvertime.startTime) {
                const attDateStr = manualEntry.date;
                const startIso = `${attDateStr}T${manualOvertime.startTime}:00`;
                const endIso = manualOvertime.endTime ? `${attDateStr}T${manualOvertime.endTime}:00` : null;

                if (manualOvertime.id) {
                    await fetch(`/api/admin/overtimes/${manualOvertime.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            startTime: startIso,
                            endTime: endIso,
                            description: manualOvertime.description,
                            status: endIso ? "completed" : "ongoing"
                        })
                    });
                } else {
                    await fetch("/api/admin/overtimes/manual", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            attendanceId: targetAttId,
                            startTime: startIso,
                            endTime: endIso,
                            description: manualOvertime.description,
                            status: endIso ? "completed" : "ongoing"
                        })
                    });
                }
            }

            return attendanceResult;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
            setIsManualModalOpen(false);
            setEditingAttendance(null);
            setShowOvertimeInput(false);
            setManualOvertime({ id: null, startTime: "", endTime: "", description: "" });
            toast({ title: "Berhasil", description: "Data absensi & lembur telah diperbarui." });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/admin/attendance/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Gagal menghapus data");
            }
            return res.status === 204 ? { id } : res.json().catch(() => ({ id }));
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            await queryClient.invalidateQueries({ queryKey: ["/api/admin/overtimes"] });
            setDeleteConfirmId(null);
            toast({ title: "Dihapus", description: "Data absensi berhasil dihapus." });
        },
        onError: (err: any) => {
            toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
    });

    const handleOpenManualModal = (existing?: Attendance) => {
        if (existing) {
            setEditingAttendance(existing);
            const toTime = (d: string | Date | null | undefined) => d ? format(new Date(d), "HH:mm") : "";
            setManualEntry({
                userId: String(existing.userId),
                date: format(new Date(existing.date), "yyyy-MM-dd"),
                checkIn: toTime(existing.checkIn),
                checkOut: toTime(existing.checkOut),
                breakStart: toTime(existing.breakStart),
                breakEnd: toTime(existing.breakEnd),
                status: existing.status || "present",
                notes: existing.notes || "",
                shift: existing.shift || "-"
            });

            // Cek apakah ada record lembur untuk absensi ini
            const ot = allOvertimes?.find(o => o.attendanceId === existing.id);
            if (ot) {
                setShowOvertimeInput(true);
                setManualOvertime({
                    id: ot.id,
                    startTime: ot.startTime ? format(new Date(ot.startTime), "HH:mm") : "",
                    endTime: ot.endTime ? format(new Date(ot.endTime), "HH:mm") : "",
                    description: ot.description || "",
                });
            } else {
                setShowOvertimeInput(false);
                setManualOvertime({ id: null, startTime: "", endTime: "", description: "" });
            }
        } else {
            setEditingAttendance(null);
            setManualEntry({
                userId: "",
                date: format(new Date(), "yyyy-MM-dd"),
                checkIn: "",
                checkOut: "",
                breakStart: "",
                breakEnd: "",
                status: "present",
                notes: "",
                shift: "-"
            });
            setShowOvertimeInput(false);
            setManualOvertime({ id: null, startTime: "", endTime: "", description: "" });
        }
        setIsManualModalOpen(true);
    };

    const handleExport = async () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = format(targetDate, "dd MMMM yyyy", { locale: id }).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "dd MMM yyyy", { locale: id })} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const fileName = `LAPORAN ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr}.html`;
        let logoDataUrl = '';
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const logoToUse = config?.logoUrl || '/icon-192.png';
            const logoRes = await fetch(logoToUse, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            const logoBlob = await logoRes.blob();
            logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(logoBlob);
            });
        } catch (_) { }

        const html = `<!DOCTYPE html>
<html>
<head>
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; text-transform: uppercase !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }
    .letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; min-height: 50px; }
    .logo-img { height: 50px; max-width: 140px; object-fit: contain; flex-shrink: 0; }
    .company-block { text-align: right; flex-grow: 1; margin-left: 20px; }
    .company-block h1 { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-block .alamat { font-size: 12px; font-weight: normal; color: #334155; line-height: 1.4; margin-top: 4px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }
    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; }
    th.c { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    .col-no   { text-align: center; color: #94a3b8; font-size: 10px; }
    .col-date { color: #374151; font-weight: 600; }
    .col-name { color: #1d4ed8; font-weight: 600; }
    .col-time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; text-align: center; }
    .t-in   { color: #15803d; font-weight: 700; }
    .t-brk  { color: #b45309; font-weight: 700; }
    .t-out  { color: #b91c1c; font-weight: 700; }
    .t-dash { color: #94a3b8; }
    .col-work { font-size: 11px; font-weight: 700; color: #1e293b; }
    .col-brk  { text-align: center; font-size: 11px; font-weight: 700; color: #ea580c; }
    .col-stat { text-align: center; font-weight: 700; font-size: 11px; }
    .st-hadir { color: #16a34a; }
    .st-telat { color: #ea580c; }
    .st-sakit { color: #2563eb; }
    .st-izin  { color: #7c3aed; }
    .st-cuti  { color: #0d9488; }
    .st-alpha { color: #dc2626; }
    .col-note { font-size: 10.5px; color: #475569; white-space: normal; max-width: 200px; }
    .note-late { color: #dc2626; font-size: 10px; }
    .note-warn { color: #ca8a04; font-weight: 600; }
    .signature-section { margin-top: 48px; display: flex; justify-content: center; gap: 100px; padding: 0; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; text-decoration: none; }
    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
    <div class="company-block">
      <h1>${namaPt}</h1>
      ${alamatPt ? `<p class="alamat">${alamatPt}</p>` : `<p class="alamat">Sistem Manajemen Kehadiran Digital</p>`}
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />
  <div class="report-meta">
    <h2>Laporan Rekapitulasi Absensi</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Periode: ${format(startDate, "EEEE, d MMMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:28px;">No</th>
        <th style="width:130px;">Hari & Tanggal</th>
        <th style="width:130px;">Nama Tenaga Kerja</th>
        <th class="c" style="width:62px;">Masuk</th>
        <th class="c" style="width:62px;">Istirahat</th>
        <th class="c" style="width:62px;">Selesai</th>
        <th class="c" style="width:62px;">Pulang</th>
        <th style="width:80px;">Jam Kerja</th>
        <th class="c" style="width:80px;">Total Istirahat</th>
        <th class="c" style="width:62px;">Status</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${processedData.map((row, index) => {
            const dateStr = format(new Date(row.date), "yyyy-MM-dd");
            const breakMins = calculateDuration(row.breakStart, row.breakEnd);
            const key = `${dateStr}-${row.userId}`;
            const dailyEntry = dailyTotals.get(key);
            const dailyTotalMins = dailyEntry?.mins ?? 0;
            const prevRow = index > 0 ? processedData[index - 1] : null;
            const isSameDayAndUser = !!(prevRow && format(new Date(prevRow.date), "yyyy-MM-dd") === dateStr && prevRow.userId === row.userId);
            const statusLabel = row.status === 'present' ? 'Hadir' : row.status === 'late' ? 'Telat' : row.status === 'sick' ? 'Sakit' : row.status === 'permission' ? 'Izin' : row.status === 'cuti' ? 'Cuti' : row.status === 'absent' ? 'Alpha' : (row.status || '-');
            const statusClass = row.status === 'present' ? 'st-hadir' : row.status === 'late' ? 'st-telat' : row.status === 'sick' ? 'st-sakit' : row.status === 'permission' ? 'st-izin' : row.status === 'cuti' ? 'st-cuti' : row.status === 'absent' ? 'st-alpha' : '';
            const inTime = row.checkIn ? format(new Date(row.checkIn), 'HH:mm') : '-';
            const brkTime = row.breakStart ? format(new Date(row.breakStart), 'HH:mm') : '-';
            const brkEnd = row.breakEnd ? format(new Date(row.breakEnd), 'HH:mm') : '-';
            const outTime = row.checkOut ? format(new Date(row.checkOut), 'HH:mm') : '-';
            const isNoBreak = (inTime !== '-' && outTime !== '-' && brkTime === '-' && brkEnd === '-');
            const jamKerja = !isSameDayAndUser ? (dailyTotalMins > 0 ? formatDuration(dailyTotalMins) : '-') : '';
            let keterangan = row.notes ? row.notes : '-';
            if (!row.checkOut) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Belum Pulang)</span>' : '<span class="note-warn">Belum Pulang</span>';
            else if (isNoBreak) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Tanpa Istirahat)</span>' : '<span class="note-warn">Tanpa Istirahat</span>';
            const lateNote = row.status === 'late' && (row as any).lateReason ? `<br><span class="note-late">[Telat: ${(row as any).lateReason}]</span>` : '';
            
            let rowHtml = `<tr>
          <td class="col-no">${isSameDayAndUser ? '<span style="color:#cbd5e1;">↳</span>' : (index + 1)}</td>
          <td class="col-date" style="font-size:9.5px;">${isSameDayAndUser ? '' : format(new Date(row.date), 'EEEE, d MMMM yyyy', { locale: id })}</td>
          <td class="col-name">
              ${isSameDayAndUser ? '' : `
                   <div style="line-height:1.2;">
                      <b style="color:#1d4ed8;font-size:11.5px;">${getUserName(row.userId) || '-'}</b><br/>
                      ${(row.shift && row.shift.toLowerCase().trim() !== '-' && row.shift.toLowerCase().trim() !== 'management') 
                          ? `<span style="color:#16a34a;font-size:9px;font-weight:bold;text-transform:uppercase;">${row.shift}</span><br/>` 
                          : '<span style="color:#94a3b8;font-size:9px;font-style:italic;">Belum Tercatat</span><br/>'}
                      <span style="color:#64748b;font-size:9px;">NIK: ${users?.find(u => u.id === row.userId)?.nik || users?.find(u => u.id === row.userId)?.username || '-'}</span>
                  </div>
              `}
          </td>
          <td class="col-time ${inTime === '-' ? 't-dash' : 't-in'}">${inTime}</td>
          <td class="col-time ${brkTime === '-' ? 't-dash' : 't-brk'}">${brkTime}</td>
          <td class="col-time ${brkEnd === '-' ? 't-dash' : 't-brk'}">${brkEnd}</td>
          <td class="col-time ${outTime === '-' ? 't-dash' : 't-out'}">${outTime}</td>
          <td class="col-work">${jamKerja}</td>
          <td class="col-brk">${breakMins > 0 ? formatDuration(breakMins) : '-'}</td>
          <td class="col-stat"><span class="${statusClass}">${statusLabel}</span></td>
          <td class="col-note">${keterangan}${lateNote}</td>
        </tr>`;

            // Baris Lembur jika Super Admin & karyawan sudah setuju + mulai lembur (punya bukti awal)
            if (user?.role === "superadmin") {
                const ot = allOvertimes?.find(o => o.attendanceId === row.id);
                if (ot && ot.employeeApproval === "approved" && ot.initialProofUrl) {
                    const hasStarted = true;
                    const hasFinished = ot.status === "completed" && !!ot.finalProofUrl;

                    const otStart = ot.startTime ? format(new Date(ot.startTime), "HH:mm") : "-";
                    const otEnd = hasFinished && ot.endTime ? format(new Date(ot.endTime), "HH:mm") : "-";

                    const otMins = (hasFinished && ot.startTime && ot.endTime)
                        ? Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000)
                        : 0;
                    const otDurationStr = (hasFinished && otMins > 0) ? formatDuration(otMins) : "-";

                    let statusLabel = "SEDANG BERLANGSUNG";
                    let statusStyle = "background:#ffedd5;color:#c2410c;";
                    if (hasFinished) {
                        statusLabel = "SELESAI";
                        statusStyle = "background:#dcfce7;color:#15803d;";
                    }

                    const noteText = ot.description || "Pekerjaan Lembur";

                    rowHtml += `<tr style="background-color: #fff7ed;">
                      <td class="col-no"><span style="color:#ea580c;font-weight:bold;">↳</span></td>
                      <td class="col-date" style="font-size:9.5px;color:#c2410c;font-weight:bold;">LEMBUR (OVERTIME)</td>
                      <td class="col-name"><span style="color:#ea580c;font-weight:bold;font-size:10px;">⚡ ${getUserName(row.userId) || '-'}</span></td>
                      <td class="col-time" style="color:#c2410c;font-weight:bold;">${otStart}</td>
                      <td class="col-time t-dash">-</td>
                      <td class="col-time t-dash">-</td>
                      <td class="col-time" style="color:#c2410c;font-weight:bold;">${otEnd}</td>
                      <td class="col-work" style="color:#9a3412;font-weight:bold;">${otDurationStr}</td>
                      <td class="col-brk">-</td>
                      <td class="col-stat"><span style="${statusStyle}padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;">${statusLabel}</span></td>
                      <td class="col-note" style="color:#9a3412;font-style:italic;">${noteText}</td>
                    </tr>`;
                }
            }

            return rowHtml;
        }).join('')}
    </tbody>
  </table>
  ${(() => {
                const usersSummary = new Map<number, { name: string, totalMins: number, totalOtMins: number, breakdown: string[] }>();
                const recordsByUser = new Map<number, typeof processedData>();
                processedData.forEach(r => {
                    if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, []);
                    recordsByUser.get(r.userId)!.push(r);
                });
                recordsByUser.forEach((records, userId) => {
                    const name = getUserName(userId) || '-';
                    const userSummary = { name, totalMins: 0, totalOtMins: 0, breakdown: [] as string[] };
                    const recordsByDay = new Map<string, typeof processedData>();
                    records.forEach(r => {
                        const d = format(new Date(r.date), "yyyy-MM-dd");
                        if (!recordsByDay.has(d)) recordsByDay.set(d, []);
                        recordsByDay.get(d)!.push(r);
                    });
                    const days = Array.from(recordsByDay.keys()).sort();
                    days.forEach(day => {
                        const dayRecords = recordsByDay.get(day)!;
                        const hasIn = dayRecords.some(r => r.checkIn);
                        const hasOut = dayRecords.some(r => r.checkOut);
                        const dateStr = format(new Date(day), "EEEE, d MMMM yyyy", { locale: id });
                        if (hasIn && hasOut) {
                            const { netWorkMins } = calculateDailyTotal(dayRecords);
                            userSummary.totalMins += netWorkMins;
                            const firstIn = dayRecords.map(r => r.checkIn).filter(Boolean).sort()[0];
                            const lastOut = dayRecords.map(r => r.checkOut).filter(Boolean).sort().reverse()[0];
                            const totalBreakMins = dayRecords.reduce((sum, r) => sum + (r.breakStart && r.breakEnd ? calculateDuration(r.breakStart, r.breakEnd) : 0), 0);
                            const brkStr = totalBreakMins > 0 ? formatDuration(totalBreakMins) : `0 jam (Tanpa Istirahat)`;
                            userSummary.breakdown.push(`<span style="color:#1e293b;font-weight:600;">${dateStr}</span> : Kerja jam ${format(new Date(firstIn!), "HH.mm")} - ${format(new Date(lastOut!), "HH.mm")} istirahat ${brkStr} (Total: ${formatDuration(netWorkMins)})`);
                        } else {
                            userSummary.breakdown.push(`<span style="color:#dc2626;font-weight:600;">${dateStr}</span> : <span style="color:#b91c1c;">Absensi belum lengkap</span>`);
                        }

                        // hitung lembur per hari jika ada (hanya jika sudah selesai dan ada bukti akhir)
                        if (user?.role === "superadmin") {
                            dayRecords.forEach(r => {
                                const ot = allOvertimes?.find(o => o.attendanceId === r.id);
                                if (ot && ot.initialProofUrl && ot.status === "completed" && ot.finalProofUrl && ot.startTime && ot.endTime) {
                                    const otMins = Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000);
                                    if (otMins > 0) {
                                        userSummary.totalOtMins += otMins;
                                        userSummary.breakdown.push(`<span style="color:#c2410c;font-weight:700;">↳ Lembur ( Overtime ) ${dateStr}</span> : ${format(new Date(ot.startTime), "HH.mm")} - ${format(new Date(ot.endTime), "HH.mm")} (${formatDuration(otMins)}) - ${ot.description || 'Pekerjaan Lembur'}`);
                                    }
                                }
                            });
                        }
                    });
                    usersSummary.set(userId, userSummary);
                });
                let sumHtml = `<div style="page-break-before: always; padding-top: 20px;">
              <div class="report-meta">
                <h2>Rekapitulasi Total Jam Kerja</h2>
                <p class="sub">Periode: ${periodStr}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="c" style="width:40px;">No</th>
                    <th style="width:180px;">Nama Tenaga Kerja</th>
                    <th class="c" style="width:120px;">Total Jam Kerja</th>
                    <th>Rincian Harian</th>
                  </tr>
                </thead>
                <tbody>`;
                let sumIdx = 1;
                usersSummary.forEach((summary) => {
                    const totalJamStr = summary.totalOtMins > 0 
                        ? `Reguler: ${formatDuration(summary.totalMins)}<br/><span style="color:#c2410c;">Lembur: ${formatDuration(summary.totalOtMins)}</span>`
                        : (summary.totalMins > 0 ? formatDuration(summary.totalMins) : "-");
                    sumHtml += `<tr>
                    <td class="col-no">${sumIdx++}</td>
                    <td class="col-name">${summary.name}</td>
                    <td class="c" style="font-weight:bold;font-size:11px;line-height:1.4;">${totalJamStr}</td>
                    <td style="font-size:10.5px;line-height:1.6;padding-bottom:12px;padding-top:12px;white-space:normal;">${summary.breakdown.join('<br>')}</td>
                  </tr>`;
                });
                sumHtml += `</tbody></table></div>`;
                return sumHtml;
            })()}
  <div class="signature-section">
    <div class="sig-box"><p class="sig-label">Checked By</p><div class="sig-name">NIKO</div></div>
    <div class="sig-box"><p class="sig-label">Approved By</p><div class="sig-name">CLAVERINA</div></div>
  </div>
  <div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Absensi ${namaPt.toUpperCase()} &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB</div>
  <div class="btn-wrap"><a id="dl-btn" class="download-btn" href="#">&#11015;&nbsp; Download File</a></div>
  <script>
    var _fn = "${fileName}";
    document.title = _fn;
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) { btn.href = window.location.href; btn.download = _fn; }
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        }, 5000);
    };

    const handleExportPdf = async () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = format(targetDate, "dd MMMM yyyy", { locale: id }).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "dd MMM yyyy", { locale: id })} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const todayStamp = format(new Date(), "dd-MM-yyyy");
        const pdfFileName = `LAPORAN REKAP ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr} (${todayStamp}).pdf`;
        setIsExporting(true);
        try {
            let logoDataUrl = '';
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const logoToUse = config?.logoUrl || '/icon-192.png';
                const logoRes = await fetch(logoToUse, { signal: controller.signal });
                clearTimeout(timeoutId);
                const logoBlob = await logoRes.blob();
                logoDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(logoBlob);
                });
            } catch (_) {}

            // Exact same HTML structure as handleExport
            const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; text-transform: uppercase !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 20px 24px; }
    .letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; min-height: 50px; }
    .logo-img { height: 50px; max-width: 140px; object-fit: contain; flex-shrink: 0; }
    .company-block { text-align: right; flex-grow: 1; margin-left: 20px; }
    .company-block h1 { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-block .alamat { font-size: 12px; font-weight: normal; color: #334155; line-height: 1.4; margin-top: 4px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }
    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; }
    th.c { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    .col-no   { text-align: center; color: #94a3b8; font-size: 10px; }
    .col-date { color: #374151; font-weight: 600; }
    .col-name { color: #1d4ed8; font-weight: 600; }
    .col-time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; text-align: center; }
    .t-in   { color: #15803d; font-weight: 700; }
    .t-brk  { color: #b45309; font-weight: 700; }
    .t-out  { color: #b91c1c; font-weight: 700; }
    .t-dash { color: #94a3b8; }
    .col-work { font-size: 11px; font-weight: 700; color: #1e293b; }
    .col-brk  { text-align: center; font-size: 11px; font-weight: 700; color: #ea580c; }
    .col-stat { text-align: center; font-weight: 700; font-size: 11px; }
    .st-hadir { color: #16a34a; }
    .st-telat { color: #ea580c; }
    .st-sakit { color: #2563eb; }
    .st-izin  { color: #7c3aed; }
    .st-cuti  { color: #0d9488; }
    .st-alpha { color: #dc2626; }
    .col-note { font-size: 10.5px; color: #475569; white-space: normal; max-width: 200px; }
    .note-late { color: #dc2626; font-size: 10px; }
    .note-warn { color: #ca8a04; font-weight: 600; }
    .signature-section { margin-top: 48px; display: flex; justify-content: center; gap: 100px; padding: 0; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="letterhead">
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
    <div class="company-block">
      <h1>${namaPt}</h1>
      ${alamatPt ? `<p class="alamat">${alamatPt}</p>` : `<p class="alamat">Sistem Manajemen Kehadiran Digital</p>`}
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />
  <div class="report-meta">
    <h2>Laporan Rekapitulasi Absensi</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Periode: ${format(startDate, "EEEE, d MMMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:28px;">No</th>
        <th style="width:130px;">Hari & Tanggal</th>
        <th style="width:130px;">Nama Tenaga Kerja</th>
        <th class="c" style="width:62px;">Masuk</th>
        <th class="c" style="width:62px;">Istirahat</th>
        <th class="c" style="width:62px;">Selesai</th>
        <th class="c" style="width:62px;">Pulang</th>
        <th style="width:80px;">Jam Kerja</th>
        <th class="c" style="width:80px;">Total Istirahat</th>
        <th class="c" style="width:62px;">Status</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${processedData.map((row, index) => {
            const dateStr = format(new Date(row.date), "yyyy-MM-dd");
            const breakMins = calculateDuration(row.breakStart, row.breakEnd);
            const key = `${dateStr}-${row.userId}`;
            const dailyEntry = dailyTotals.get(key);
            const dailyTotalMins = dailyEntry?.mins ?? 0;
            const prevRow = index > 0 ? processedData[index - 1] : null;
            const isSameDayAndUser = !!(prevRow && format(new Date(prevRow.date), "yyyy-MM-dd") === dateStr && prevRow.userId === row.userId);
            const statusLabel = row.status === 'present' ? 'Hadir' : row.status === 'late' ? 'Telat' : row.status === 'sick' ? 'Sakit' : row.status === 'permission' ? 'Izin' : row.status === 'cuti' ? 'Cuti' : row.status === 'absent' ? 'Alpha' : (row.status || '-');
            const statusClass = row.status === 'present' ? 'st-hadir' : row.status === 'late' ? 'st-telat' : row.status === 'sick' ? 'st-sakit' : row.status === 'permission' ? 'st-izin' : row.status === 'cuti' ? 'st-cuti' : row.status === 'absent' ? 'st-alpha' : '';
            const inTime = row.checkIn ? format(new Date(row.checkIn), 'HH:mm') : '-';
            const brkTime = row.breakStart ? format(new Date(row.breakStart), 'HH:mm') : '-';
            const brkEnd = row.breakEnd ? format(new Date(row.breakEnd), 'HH:mm') : '-';
            const outTime = row.checkOut ? format(new Date(row.checkOut), 'HH:mm') : '-';
            const isNoBreak = (inTime !== '-' && outTime !== '-' && brkTime === '-' && brkEnd === '-');
            const jamKerja = !isSameDayAndUser ? (dailyTotalMins > 0 ? formatDuration(dailyTotalMins) : '-') : '';
            let keterangan = row.notes ? row.notes : '-';
            if (!row.checkOut) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Belum Pulang)</span>' : '<span class="note-warn">Belum Pulang</span>';
            else if (isNoBreak) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Tanpa Istirahat)</span>' : '<span class="note-warn">Tanpa Istirahat</span>';
            const lateNote = row.status === 'late' && (row as any).lateReason ? `<br><span class="note-late">[Telat: ${(row as any).lateReason}]</span>` : '';
            
            let rowHtml = `<tr>
          <td class="col-no">${isSameDayAndUser ? '<span style="color:#cbd5e1;">↳</span>' : (index + 1)}</td>
          <td class="col-date" style="font-size:9.5px;">${isSameDayAndUser ? '' : format(new Date(row.date), 'EEEE, d MMMM yyyy', { locale: id })}</td>
          <td class="col-name">
              ${isSameDayAndUser ? '' : `
                   <div style="line-height:1.2;">
                      <b style="color:#1d4ed8;font-size:11.5px;">${getUserName(row.userId) || '-'}</b><br/>
                      ${(row.shift && row.shift.toLowerCase().trim() !== '-' && row.shift.toLowerCase().trim() !== 'management') 
                          ? `<span style="color:#16a34a;font-size:9px;font-weight:bold;text-transform:uppercase;">${row.shift}</span><br/>` 
                          : '<span style="color:#94a3b8;font-size:9px;font-style:italic;">Belum Tercatat</span><br/>'}
                      <span style="color:#64748b;font-size:9px;">NIK: ${users?.find(u => u.id === row.userId)?.nik || users?.find(u => u.id === row.userId)?.username || '-'}</span>
                  </div>
              `}
          </td>
          <td class="col-time ${inTime === '-' ? 't-dash' : 't-in'}">${inTime}</td>
          <td class="col-time ${brkTime === '-' ? 't-dash' : 't-brk'}">${brkTime}</td>
          <td class="col-time ${brkEnd === '-' ? 't-dash' : 't-brk'}">${brkEnd}</td>
          <td class="col-time ${outTime === '-' ? 't-dash' : 't-out'}">${outTime}</td>
          <td class="col-work">${jamKerja}</td>
          <td class="col-brk">${breakMins > 0 ? formatDuration(breakMins) : '-'}</td>
          <td class="col-stat"><span class="${statusClass}">${statusLabel}</span></td>
          <td class="col-note">${keterangan}${lateNote}</td>
        </tr>`;

            if (user?.role === "superadmin") {
                const ot = allOvertimes?.find(o => o.attendanceId === row.id);
                if (ot && ot.employeeApproval === "approved" && ot.initialProofUrl) {
                    const hasFinished = ot.status === "completed" && !!ot.finalProofUrl;

                    const otStart = ot.startTime ? format(new Date(ot.startTime), "HH:mm") : "-";
                    const otEnd = hasFinished && ot.endTime ? format(new Date(ot.endTime), "HH:mm") : "-";

                    const otMins = (hasFinished && ot.startTime && ot.endTime)
                        ? Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000)
                        : 0;
                    const otDurationStr = (hasFinished && otMins > 0) ? formatDuration(otMins) : "-";

                    let statusLabel = "SEDANG BERLANGSUNG";
                    let statusStyle = "background:#ffedd5;color:#c2410c;";
                    if (hasFinished) {
                        statusLabel = "SELESAI";
                        statusStyle = "background:#dcfce7;color:#15803d;";
                    }

                    const noteText = ot.description || "Pekerjaan Lembur";

                    rowHtml += `<tr style="background-color: #fff7ed;">
                      <td class="col-no"><span style="color:#ea580c;font-weight:bold;">↳</span></td>
                      <td class="col-date" style="font-size:9.5px;color:#c2410c;font-weight:bold;">LEMBUR (OVERTIME)</td>
                      <td class="col-name"><span style="color:#ea580c;font-weight:bold;font-size:10px;">⚡ ${getUserName(row.userId) || '-'}</span></td>
                      <td class="col-time" style="color:#c2410c;font-weight:bold;">${otStart}</td>
                      <td class="col-time t-dash">-</td>
                      <td class="col-time t-dash">-</td>
                      <td class="col-time" style="color:#c2410c;font-weight:bold;">${otEnd}</td>
                      <td class="col-work" style="color:#9a3412;font-weight:bold;">${otDurationStr}</td>
                      <td class="col-brk">-</td>
                      <td class="col-stat"><span style="${statusStyle}padding:2px 6px;border-radius:4px;font-weight:bold;font-size:9px;">${statusLabel}</span></td>
                      <td class="col-note" style="color:#9a3412;font-style:italic;">${noteText}</td>
                    </tr>`;
                }
            }

            return rowHtml;
        }).join('')}
    </tbody>
  </table>
  ${(() => {
        const usersSummary = new Map<number, { name: string, totalMins: number, totalOtMins: number, breakdown: string[] }>();
        const recordsByUser = new Map<number, typeof processedData>();
        processedData.forEach(r => {
            if (!recordsByUser.has(r.userId)) recordsByUser.set(r.userId, []);
            recordsByUser.get(r.userId)!.push(r);
        });

        recordsByUser.forEach((userRecords, userId) => {
            const empName = getUserName(userId);
            const userSummary = { name: empName, totalMins: 0, totalOtMins: 0, breakdown: [] as string[] };
            const recordsByDate = new Map<string, typeof userRecords>();
            userRecords.forEach(r => {
                const dateStr = format(new Date(r.date), "dd/MM/yyyy");
                if (!recordsByDate.has(dateStr)) recordsByDate.set(dateStr, []);
                recordsByDate.get(dateStr)!.push(r);
            });

            recordsByDate.forEach((dayRecords, dateStr) => {
                const hasIn = dayRecords.some(r => r.checkIn);
                const hasOut = dayRecords.some(r => r.checkOut);
                if (hasIn && hasOut) {
                    const { netWorkMins } = calculateDailyTotal(dayRecords);
                    userSummary.totalMins += netWorkMins;
                    const firstIn = dayRecords.map(r => r.checkIn).filter(Boolean).sort()[0];
                    const lastOut = dayRecords.map(r => r.checkOut).filter(Boolean).sort().reverse()[0];
                    const totalBreakMins = dayRecords.reduce((sum, r) => sum + (r.breakStart && r.breakEnd ? calculateDuration(r.breakStart, r.breakEnd) : 0), 0);
                    const brkStr = totalBreakMins > 0 ? formatDuration(totalBreakMins) : `0 jam (Tanpa Istirahat)`;
                    userSummary.breakdown.push(`<span style="color:#1e293b;font-weight:600;">${dateStr}</span> : Kerja jam ${format(new Date(firstIn!), "HH.mm")} - ${format(new Date(lastOut!), "HH.mm")} istirahat ${brkStr} (Total: ${formatDuration(netWorkMins)})`);
                } else {
                    userSummary.breakdown.push(`<span style="color:#dc2626;font-weight:600;">${dateStr}</span> : <span style="color:#b91c1c;">Absensi belum lengkap</span>`);
                }

                if (user?.role === "superadmin") {
                    dayRecords.forEach(r => {
                        const ot = allOvertimes?.find(o => o.attendanceId === r.id);
                        if (ot && ot.initialProofUrl && ot.status === "completed" && ot.finalProofUrl && ot.startTime && ot.endTime) {
                            const otMins = Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000);
                            if (otMins > 0) {
                                userSummary.totalOtMins += otMins;
                                userSummary.breakdown.push(`<span style="color:#c2410c;font-weight:700;">↳ Lembur ( Overtime ) ${dateStr}</span> : ${format(new Date(ot.startTime), "HH.mm")} - ${format(new Date(ot.endTime), "HH.mm")} (${formatDuration(otMins)}) - ${ot.description || 'Pekerjaan Lembur'}`);
                            }
                        }
                    });
                }
            });
            usersSummary.set(userId, userSummary);
        });

        let sumHtml = `<div style="page-break-before: always; padding-top: 20px;">
      <div class="report-meta">
        <h2>Rekapitulasi Total Jam Kerja</h2>
        <p class="sub">Periode: ${periodStr}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th class="c" style="width:40px;">No</th>
            <th style="width:180px;">Nama Tenaga Kerja</th>
            <th class="c" style="width:120px;">Total Jam Kerja</th>
            <th>Rincian Harian</th>
          </tr>
        </thead>
        <tbody>`;
        let sumIdx = 1;
        usersSummary.forEach((summary) => {
            const totalJamStr = summary.totalOtMins > 0 
                ? `Reguler: ${formatDuration(summary.totalMins)}<br/><span style="color:#c2410c;">Lembur: ${formatDuration(summary.totalOtMins)}</span>`
                : (summary.totalMins > 0 ? formatDuration(summary.totalMins) : "-");
            sumHtml += `<tr>
            <td class="col-no">${sumIdx++}</td>
            <td class="col-name">${summary.name}</td>
            <td class="c" style="font-weight:bold;font-size:11px;line-height:1.4;">${totalJamStr}</td>
            <td style="font-size:10.5px;line-height:1.6;padding-bottom:12px;padding-top:12px;white-space:normal;">${summary.breakdown.join('<br>')}</td>
          </tr>`;
        });
        sumHtml += `</tbody></table></div>`;
        return sumHtml;
    })()}
  <div class="signature-section">
    <div class="sig-box"><p class="sig-label">Checked By</p><div class="sig-name">NIKO</div></div>
    <div class="sig-box"><p class="sig-label">Approved By</p><div class="sig-name">CLAVERINA</div></div>
  </div>
  <div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Absensi ${namaPt.toUpperCase()} &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB</div>
</body>
</html>`;

            // Off-screen container for rendering
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '1050px';
            container.style.backgroundColor = '#ffffff';
            container.innerHTML = html;
            document.body.appendChild(container);

            const imgs = Array.from(container.querySelectorAll('img'));
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(res => { img.onload = res; img.onerror = res; });
            }));

            const html2pdfLib = await loadHtml2Pdf();
            const opt = {
                margin: [6, 6, 6, 6],
                filename: pdfFileName,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { scale: 3, useCORS: true, logging: false, windowWidth: 1050, letterRendering: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            await html2pdfLib().set(opt).from(container).save();
            document.body.removeChild(container);

            toast({ title: "✅ PDF Berhasil Diunduh", description: pdfFileName });
        } catch (e: any) {
            toast({ title: "Gagal Export PDF", description: e.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    const handleBulkExport = async () => {
        if (user?.role !== "superadmin") {
            toast({
                title: "Akses Ditolak",
                description: "Hanya Super Admin yang dapat melakukan export massal.",
                variant: "destructive"
            });
            return;
        }

        const datePairs: { d1: Date; d2: Date }[] = [];
        let curr = new Date(startDate);
        const end = new Date(endDate);

        while (curr <= end) {
            const d1 = new Date(curr);
            const dayOfWeek = d1.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
            let step = 1;
            let d2Add = 1;

            if (dayOfWeek === 5) {
                // Friday -> Friday to Monday (+3 days)
                d2Add = 3;
                step = 3;
            } else if (dayOfWeek === 6) {
                // Saturday -> Saturday to Monday (+2 days)
                d2Add = 2;
                step = 2;
            }

            const d2 = addDays(d1, d2Add);
            datePairs.push({ d1, d2 });
            curr = addDays(curr, step);
        }

        if (datePairs.length === 0) {
            toast({
                title: "Info",
                description: "Tidak ada data untuk rentang tanggal yang dipilih.",
            });
            return;
        }

        setIsExporting(true);
        
        let html2pdf: any;
        let JSZip: any;
        try {
            html2pdf = await loadHtml2Pdf();
            JSZip = await loadJSZip();
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal memuat engine pembuat PDF atau ZIP.",
                variant: "destructive"
            });
            setIsExporting(false);
            return;
        }

        toast({
            title: "Export Massal Dimulai",
            description: `Mengekspor ${datePairs.length} laporan harian ke dalam 1 file ZIP. Harap tunggu sebentar...`,
        });

        let logoDataUrl = '';
        try {
            const logoToUse = config?.logoUrl || '/icon-192.png';
            const logoRes = await fetch(logoToUse);
            const logoBlob = await logoRes.blob();
            logoDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(logoBlob);
            });
        } catch (_) { }

        const zip = new JSZip();

        for (let i = 0; i < datePairs.length; i++) {
            const { d1, d2 } = datePairs[i];
            
            const dayStr1 = format(d1, "d");
            const monthStr1 = format(d1, "MMMM", { locale: id }).toUpperCase();
            const dayStr2 = format(d2, "d");
            const monthStr2 = format(d2, "MMMM", { locale: id }).toUpperCase();
            const yearStr = format(d1, "yyyy");
            
            const docTitle = `REKAP ABSENSI NON MANAJEMEN ${dayStr1} ${monthStr1} - ${dayStr2} ${monthStr2} ${yearStr} ${singkatanPt}`;
            const pdfFileName = `${docTitle}.pdf`;

            const dayRecords = allAttendance?.filter(row => {
                if (!getUserName(row.userId)) return false;
                const rowDate = new Date(row.date);
                return format(rowDate, "yyyy-MM-dd") === format(d1, "yyyy-MM-dd");
            }) || [];

            const filteredDayRecords = dayRecords
                .filter(row => {
                    const name = (getUserName(row.userId) || '').toLowerCase();
                    return name.includes(searchName.toLowerCase());
                })
                .sort((a, b) => {
                    const nameA = (getUserName(a.userId) || '').toLowerCase();
                    const nameB = (getUserName(b.userId) || '').toLowerCase();
                    if (nameA < nameB) return -1;
                    if (nameA > nameB) return 1;
                    return 0;
                });

            const localDailyTotals = new Map<string, { mins: number; complete: boolean }>();
            filteredDayRecords.forEach(row => {
                const dateKey = format(new Date(row.date), "yyyy-MM-dd");
                const key = `${dateKey}-${row.userId}`;
                if (!localDailyTotals.has(key)) {
                    const userDayRecords = filteredDayRecords.filter(r => r.userId === row.userId);
                    const { netWorkMins, hasAllCheckOuts } = calculateDailyTotal(userDayRecords);
                    localDailyTotals.set(key, { mins: netWorkMins, complete: hasAllCheckOuts });
                }
            });

            let totalHadirCount = 0;
            let totalJamKerjaMins = 0;
            let totalIstirahatMins = 0;

            filteredDayRecords.forEach(row => {
                const breakMins = calculateDuration(row.breakStart, row.breakEnd);
                totalIstirahatMins += breakMins;
                if (row.status === 'present' || row.status === 'late') {
                    totalHadirCount++;
                }
            });

            localDailyTotals.forEach(val => {
                totalJamKerjaMins += val.mins;
            });

            const html = `<!DOCTYPE html>
<html>
<head>
  <title>${docTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; text-transform: uppercase !important; }
    body, .pdf-export-container { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; box-sizing: border-box; }
    .letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; min-height: 50px; }
    .logo-img { height: 50px; max-width: 140px; object-fit: contain; flex-shrink: 0; }
    .company-block { text-align: right; flex-grow: 1; margin-left: 20px; }
    .company-block h1 { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .company-block .alamat { font-size: 12px; font-weight: normal; color: #334155; line-height: 1.4; margin-top: 4px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }
    .report-meta { text-align: center; margin-bottom: 15px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }
    .summary-card { margin-top: 12px; margin-bottom: 18px; padding: 10px 14px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; display: flex; justify-content: space-around; font-size: 10.5px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; }
    th.c { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }
    .col-no   { text-align: center; color: #94a3b8; font-size: 10px; }
    .col-date { color: #374151; font-weight: 600; }
    .col-name { color: #1d4ed8; font-weight: 600; }
    .col-time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; text-align: center; }
    .t-in   { color: #15803d; font-weight: 700; }
    .t-brk  { color: #b45309; font-weight: 700; }
    .t-out  { color: #b91c1c; font-weight: 700; }
    .t-dash { color: #94a3b8; }
    .col-work { font-size: 11px; font-weight: 700; color: #1e293b; }
    .col-brk  { text-align: center; font-size: 11px; font-weight: 700; color: #ea580c; }
    .col-stat { text-align: center; font-weight: 700; font-size: 11px; }
    .st-hadir { color: #16a34a; }
    .st-telat { color: #ea580c; }
    .st-sakit { color: #2563eb; }
    .st-izin  { color: #7c3aed; }
    .st-cuti  { color: #0d9488; }
    .st-alpha { color: #dc2626; }
    .col-note { font-size: 10.5px; color: #475569; white-space: normal; max-width: 200px; }
    .note-late { color: #dc2626; font-size: 10px; }
    .note-warn { color: #ca8a04; font-weight: 600; }
    .signature-section { margin-top: 48px; display: flex; justify-content: center; gap: 100px; padding: 0; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }
    @media print {
      body, .pdf-export-container { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
    <div class="company-block">
      <h1>${namaPt}</h1>
      ${alamatPt ? `<p class="alamat">${alamatPt}</p>` : `<p class="alamat">Sistem Manajemen Kehadiran Digital</p>`}
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />
  <div class="report-meta">
    <h2>Laporan Rekapitulasi Absensi Harian</h2>
    <p class="sub">Periode: ${format(d1, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>
  <div class="summary-card">
    <div><b>TOTAL HADIR:</b> <span style="color:#16a34a; font-weight:800;">${totalHadirCount} ORANG</span></div>
    <div><b>REKAPITULASI TOTAL JAM KERJA:</b> <span style="color:#1d4ed8; font-weight:800;">${formatDuration(totalJamKerjaMins)}</span></div>
    <div><b>TOTAL WAKTU ISTIRAHAT:</b> <span style="color:#ea580c; font-weight:800;">${formatDuration(totalIstirahatMins)}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:28px;">No</th>
        <th style="width:130px;">Hari & Tanggal</th>
        <th style="width:130px;">Nama Tenaga Kerja</th>
        <th class="c" style="width:62px;">Masuk</th>
        <th class="c" style="width:62px;">Istirahat</th>
        <th class="c" style="width:62px;">Selesai</th>
        <th class="c" style="width:62px;">Pulang</th>
        <th style="width:80px;">Jam Kerja</th>
        <th class="c" style="width:80px;">Total Istirahat</th>
        <th class="c" style="width:62px;">Status</th>
        <th>Keterangan</th>
      </tr>
    </thead>
    <tbody>
      ${filteredDayRecords.length === 0 ? `
        <tr>
          <td colSpan="11" style="text-align:center;padding:20px;color:#94a3b8;">Tidak ada data absensi untuk hari ini.</td>
        </tr>
      ` : filteredDayRecords.map((row, index) => {
            const dateStr = format(new Date(row.date), "yyyy-MM-dd");
            const breakMins = calculateDuration(row.breakStart, row.breakEnd);
            const key = `${dateStr}-${row.userId}`;
            const dailyEntry = localDailyTotals.get(key);
            const dailyTotalMins = dailyEntry?.mins ?? 0;
            const prevRow = index > 0 ? filteredDayRecords[index - 1] : null;
            const isSameDayAndUser = !!(prevRow && format(new Date(prevRow.date), "yyyy-MM-dd") === dateStr && prevRow.userId === row.userId);
            const statusLabel = row.status === 'present' ? 'Hadir' : row.status === 'late' ? 'Telat' : row.status === 'sick' ? 'Sakit' : row.status === 'permission' ? 'Izin' : row.status === 'cuti' ? 'Cuti' : row.status === 'absent' ? 'Alpha' : (row.status || '-');
            const statusClass = row.status === 'present' ? 'st-hadir' : row.status === 'late' ? 'st-telat' : row.status === 'sick' ? 'st-sakit' : row.status === 'permission' ? 'st-izin' : row.status === 'cuti' ? 'st-cuti' : row.status === 'absent' ? 'st-alpha' : '';
            const inTime = row.checkIn ? format(new Date(row.checkIn), 'HH:mm') : '-';
            const brkTime = row.breakStart ? format(new Date(row.breakStart), 'HH:mm') : '-';
            const brkEnd = row.breakEnd ? format(new Date(row.breakEnd), 'HH:mm') : '-';
            const outTime = row.checkOut ? format(new Date(row.checkOut), 'HH:mm') : '-';
            const isNoBreak = (inTime !== '-' && outTime !== '-' && brkTime === '-' && brkEnd === '-');
            const jamKerja = !isSameDayAndUser ? (dailyTotalMins > 0 ? formatDuration(dailyTotalMins) : '-') : '';
            let keterangan = row.notes ? row.notes : '-';
            if (!row.checkOut) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Belum Pulang)</span>' : '<span class="note-warn">Belum Pulang</span>';
            else if (isNoBreak) keterangan = row.notes ? row.notes + ' <br><span class="note-warn">(Tanpa Istirahat)</span>' : '<span class="note-warn">Tanpa Istirahat</span>';
            const lateNote = row.status === 'late' && (row as any).lateReason ? `<br><span class="note-late">[Telat: ${(row as any).lateReason}]</span>` : '';
            return `<tr>
          <td class="col-no">${isSameDayAndUser ? '<span style="color:#cbd5e1;">↳</span>' : (index + 1)}</td>
          <td class="col-date" style="font-size:9.5px;">${isSameDayAndUser ? '' : format(new Date(row.date), 'EEEE, d MMMM yyyy', { locale: id })}</td>
          <td class="col-name">
              ${isSameDayAndUser ? '' : `
                   <div style="line-height:1.2;">
                       <b style="color:#1d4ed8;font-size:11.5px;">${getUserName(row.userId) || '-'}</b><br/>
                       ${(row.shift && row.shift.toLowerCase().trim() !== '-' && row.shift.toLowerCase().trim() !== 'management') 
                           ? `<span style="color:#16a34a;font-size:9px;font-weight:bold;text-transform:uppercase;">${row.shift}</span><br/>` 
                           : '<span style="color:#94a3b8;font-size:9px;font-style:italic;">Belum Tercatat</span><br/>'}
                       <span style="color:#64748b;font-size:9px;">NIK: ${users?.find(u => u.id === row.userId)?.nik || users?.find(u => u.id === row.userId)?.username || '-'}</span>
                   </div>
              `}
          </td>
          <td class="col-time ${inTime === '-' ? 't-dash' : 't-in'}">${inTime}</td>
          <td class="col-time ${brkTime === '-' ? 't-dash' : 't-brk'}">${brkTime}</td>
          <td class="col-time ${brkEnd === '-' ? 't-dash' : 't-brk'}">${brkEnd}</td>
          <td class="col-time ${outTime === '-' ? 't-dash' : 't-out'}">${outTime}</td>
          <td class="col-work">${jamKerja}</td>
          <td class="col-brk">${breakMins > 0 ? formatDuration(breakMins) : '-'}</td>
          <td class="col-stat"><span class="${statusClass}">${statusLabel}</span></td>
          <td class="col-note">${keterangan}${lateNote}</td>
        </tr>`;
        }).join('')}
    </tbody>
  </table>
  <div class="signature-section">
    <div class="sig-box"><p class="sig-label">Checked By</p><div class="sig-name">NIKO</div></div>
    <div class="sig-box"><p class="sig-label">Approved By</p><div class="sig-name">CLAVERINA</div></div>
  </div>
  <div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Absensi ${namaPt.toUpperCase()} &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB</div>
</body>
</html>`;

            setExportProgress(`Mengekspor ${i + 1} dari ${datePairs.length} laporan harian (${format(d1, "dd MMM yyyy", { locale: id })})...`);

            try {
                const pdfFileName = `${docTitle}.pdf`;
                const pdfBlob = await generatePdfBlobFromHtml(html, pdfFileName);
                zip.file(pdfFileName, pdfBlob);
            } catch (e) {
                console.error("Gagal membuat PDF untuk tanggal", d1, e);
            }
        }

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipFileName = `REKAP_ABSENSI_HARIAN_MASSAL_${format(startDate, 'yyyyMMdd')}_SD_${format(endDate, 'yyyyMMdd')}.zip`;
            const blobUrl = URL.createObjectURL(zipBlob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = zipFileName;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }, 1000);

            toast({
                title: "Ekspor Massal Berhasil",
                description: `File ZIP ${zipFileName} berhasil diunduh.`,
            });
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal membuat file ZIP.",
                variant: "destructive",
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full">
            
            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Rekap Kehadiran Tenaga Kerja</h1>
                    <p className="text-sm text-gray-500">Ekspor laporan rekap kehadiran bulanan secara lengkap untuk penggajian.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                        <SelectTrigger className="w-[140px] bg-white h-10 font-medium">
                            <SelectValue placeholder="Pilih Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Harian</SelectItem>
                            <SelectItem value="weekly">Mingguan</SelectItem>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                            <SelectItem value="custom">Rentang Khusus</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    {reportType === "custom" ? (
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 h-10">
                            <Input 
                                type="date" 
                                className="h-8 text-xs border-none w-36 focus-visible:ring-0 shadow-none" 
                                value={customStartDate} 
                                onChange={(e) => setCustomStartDate(e.target.value)} 
                                                    />
                            <span className="text-gray-400 font-bold">-</span>
                            <Input 
                                type="date" 
                                className="h-8 text-xs border-none w-36 focus-visible:ring-0 shadow-none" 
                                value={customEndDate} 
                                onChange={(e) => setCustomEndDate(e.target.value)} 
                                                    />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 h-10">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" onClick={handlePrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-bold px-2 min-w-[180px] text-center text-gray-700">
                                {reportType === 'daily' 
                                    ? format(targetDate, "dd MMM yyyy", { locale: id })
                                    : reportType === 'weekly'
                                    ? `${format(startOfWeek(targetDate, { weekStartsOn: 1 }), "dd MMM")} - ${format(endOfWeek(targetDate, { weekStartsOn: 1 }), "dd MMM")}`
                                    : format(targetDate, "MMM yyyy", { locale: id })
                                }
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100" onClick={handleNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-xl overflow-hidden mb-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-gray-100 bg-white py-4 px-6">
                        <div className="space-y-1">
                            <div className="text-lg font-bold">Laporan Kehadiran</div>
                            <p className="text-sm text-gray-500">
                                Periode: {format(startDate, "EEEE, d MMMM yyyy", { locale: id })} - {format(endDate, "EEEE, d MMMM yyyy", { locale: id })}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input placeholder="Cari nama..." className="pl-9 h-10" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                            </div>
                            <Button variant="outline" className="gap-2 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 h-10 font-bold" onClick={() => handleOpenManualModal()}>
                                <Plus className="h-4 w-4" /> Input Manual
                            </Button>
                            {reportType === "custom" && user?.role === "superadmin" && (
                                <Button 
                                    variant="outline" 
                                    className="gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 h-10 font-bold shadow-sm" 
                                    onClick={handleBulkExport}
                                    disabled={isExporting}
                                >
                                    <FileDown className="h-4 w-4" /> {isExporting ? "Mengekspor..." : "Export Harian Massal"}
                                </Button>
                            )}
                            <Button variant="outline" className="gap-2 h-10 font-bold shadow-sm" onClick={handleExport}>
                                <FileDown className="h-4 w-4" /> Export HTML
                            </Button>
                            <Button variant="outline" className="gap-2 h-10 font-bold shadow-sm bg-red-50 text-red-700 border-red-200 hover:bg-red-100" onClick={handleExportPdf} disabled={isExporting}>
                                <FileDown className="h-4 w-4" /> Export PDF
                            </Button>
                        </div>
                    </div>
                    <div className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b">
                                    <tr>
                                        <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('date')}>TANGGAL <ArrowUpDown className="h-3 w-3 inline ml-1" /></th>
                                        <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('name')}>NAMA TENAGA KERJA <ArrowUpDown className="h-3 w-3 inline ml-1" /></th>
                                        <th className="px-6 py-4 text-center">MASUK</th>
                                        <th className="px-6 py-4 text-center">ISTIRAHAT</th>
                                        <th className="px-6 py-4 text-center">SELESAI</th>
                                        <th className="px-6 py-4 text-center">PULANG</th>
                                        <th className="px-6 py-4">JAM KERJA</th>
                                        <th className="px-6 py-4 text-center">DURASI ISTIRAHAT</th>
                                        <th className="px-6 py-4 text-center">STATUS</th>
                                        <th className="px-6 py-4">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedData.map((row, relativeIndex) => {
                                        const index = startIndex + relativeIndex;
                                        const { netWorkMins: sessionNetMins } = calculateDailyTotal([row]);
                                        const dateStr = safeFormatDate(row.date, "yyyy-MM-dd");
                                        const key = `${dateStr}-${row.userId}`;
                                        const prevRow = index > 0 ? processedData[index - 1] : null;
                                        const isSameDayAndUser = prevRow && safeFormatDate(prevRow.date, "yyyy-MM-dd") === dateStr && prevRow.userId === row.userId;

                                        return (
                                            <Fragment key={row.id}>
                                                <tr className="hover:bg-gray-50/30 transition-colors group">
                                                <td className="px-6 py-4 font-bold text-gray-500 text-[10px]">
                                                    {isSameDayAndUser ? <span className="ml-4 text-gray-300">↳</span> : safeFormatDate(row.date, "EEEE, d MMMM yyyy", { locale: id })}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900 capitalize">
                                                    {isSameDayAndUser ? "" : (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{getUserName(row.userId)}</span>
                                                            {row.shift && row.shift.toLowerCase().trim() !== '-' && row.shift.toLowerCase().trim() !== 'management' ? (
                                                                <span className="text-[10px] font-bold text-primary uppercase tracking-tight">{row.shift}</span>
                                                            ) : (
                                                                <span className="text-[10px] italic text-gray-400 font-medium uppercase tracking-tight">Belum Tercatat</span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400 font-medium">NIK: {users?.find(u => u.id === row.userId)?.nik || users?.find(u => u.id === row.userId)?.username}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-emerald-600">
                                                    {row.checkIn ? safeFormatDate(row.checkIn, "HH:mm") : "-"}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-amber-600">
                                                    {row.breakStart ? safeFormatDate(row.breakStart, "HH:mm") : "-"}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-blue-600">
                                                    {row.breakEnd ? safeFormatDate(row.breakEnd, "HH:mm") : "-"}
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-rose-600">
                                                    {row.checkOut ? safeFormatDate(row.checkOut, "HH:mm") : "-"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!isSameDayAndUser && (
                                                        <div className="font-black text-gray-800">
                                                            {(dailyTotals.get(key)?.mins ?? 0) > 0 ? formatDuration(dailyTotals.get(key)?.mins ?? 0) : "-"}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                                        Sesi: {formatDuration(sessionNetMins)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center text-xs font-medium text-gray-500">
                                                    {row.breakStart && row.breakEnd ? formatDurationFull(calculateDurationSeconds(row.breakStart, row.breakEnd)) : "-"}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider
                                                        ${row.status === 'present' ? 'text-emerald-700' :
                                                            row.status === 'late' ? 'text-amber-700' :
                                                                row.status === 'sick' ? 'text-blue-700' :
                                                                    row.status === 'permission' ? 'text-purple-700' :
                                                                        row.status === 'cuti' ? 'text-teal-700' :
                                                                            'text-gray-600'}`}>
                                                        {row.status === 'present' ? 'Hadir' : row.status === 'late' ? 'Telat' : row.status === 'sick' ? 'Sakit' : row.status === 'permission' ? 'Izin' : row.status === 'cuti' ? 'Cuti' : row.status === 'absent' ? 'Alpha' : row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleOpenManualModal(row)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => setDeleteConfirmId(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                        {((row as any).checkInPhoto || (row as any).checkOutPhoto || (row as any).lateReasonPhoto) && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setSelectedPhotoRecord(row)}><Camera className="h-3.5 w-3.5" /></Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Sub-baris Lembur jika Super Admin & ada data lembur yang SUDAH SETUJU & SUDAH MULAI */}
                                            {user?.role === "superadmin" && (() => {
                                                const ot = allOvertimes?.find(o => o.attendanceId === row.id);
                                                if (!ot || ot.employeeApproval !== "approved" || !ot.initialProofUrl) return null;

                                                const hasFinished = ot.status === "completed" && !!ot.finalProofUrl;

                                                const otStart = ot.startTime ? safeFormatDate(ot.startTime, "HH:mm") : "-";
                                                const otEnd = hasFinished && ot.endTime ? safeFormatDate(ot.endTime, "HH:mm") : "-";

                                                const otDurationMins = (hasFinished && ot.startTime && ot.endTime) 
                                                    ? Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000)
                                                    : 0;
                                                const otDurationStr = (hasFinished && otDurationMins > 0) ? formatDuration(otDurationMins) : "-";

                                                let statusLabel = "SEDANG BERLANGSUNG";
                                                let statusClass = "bg-orange-100 text-orange-800 border-orange-200";

                                                if (ot.isAutoCompleted) {
                                                    statusLabel = "SELESAI OTOMATIS";
                                                    statusClass = "bg-amber-100 text-amber-800 border-amber-300";
                                                } else if (hasFinished) {
                                                    statusLabel = "SELESAI";
                                                    statusClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                                                }

                                                let noteText = ot.description || "Lembur pekerjaan";
                                                if (ot.missedReason) {
                                                    noteText += ` (Alasan Melewatkan: "${ot.missedReason}")`;
                                                }

                                                return (
                                                    <tr key={`ot-${row.id}`} className="bg-orange-50/50 border-b border-orange-100 hover:bg-orange-50 transition-colors">
                                                        <td className="px-6 py-3 font-bold text-orange-600 text-xs text-right">↳</td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">⚡ LEMBUR</span>
                                                                <span className="text-xs text-slate-700 font-semibold">{getUserName(row.userId)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-center font-mono font-bold text-orange-700 text-xs">{otStart}</td>
                                                        <td className="px-6 py-3 text-center text-xs text-slate-300">-</td>
                                                        <td className="px-6 py-3 text-center text-xs text-slate-300">-</td>
                                                        <td className="px-6 py-3 text-center font-mono font-bold text-orange-700 text-xs">{otEnd}</td>
                                                        <td className="px-6 py-3 font-extrabold text-orange-900 text-xs">{otDurationStr}</td>
                                                        <td className="px-6 py-3 text-center text-xs text-slate-300">-</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${statusClass}`}>
                                                                {statusLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-xs text-slate-600 italic truncate max-w-[180px]" title={noteText}>
                                                            {noteText}
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 bg-white px-6 py-4">
                                <div className="text-sm text-gray-500 font-medium">
                                    Menampilkan <span className="font-bold text-gray-800">{startIndex + 1}</span> - <span className="font-bold text-gray-800">{Math.min(startIndex + itemsPerPage, processedData.length)}</span> dari <span className="font-bold text-gray-800">{processedData.length}</span> baris
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 rounded-lg font-bold"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Sebelumnya
                                    </Button>
                                    <div className="text-sm font-bold px-3 text-gray-700 min-w-[120px] text-center">
                                        Halaman {currentPage} dari {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 rounded-lg font-bold"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Selanjutnya
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

            <Dialog open={!!selectedPhotoRecord} onOpenChange={(open) => !open && setSelectedPhotoRecord(null)}>
                <DialogContent className="sm:max-w-md bg-white rounded-xl p-6 overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-blue-600 uppercase">Bukti Foto Absensi</DialogTitle>
                    </DialogHeader>
                    {selectedPhotoRecord && (
                        <div className="space-y-4 mt-2">
                            {[
                                { photo: 'checkInPhoto', label: 'Check-In Masuk' },
                                { photo: 'breakStartPhoto', label: 'Istirahat' },
                                { photo: 'breakEndPhoto', label: 'Selesai Istirahat' },
                                { photo: 'checkOutPhoto', label: 'Check-Out Pulang' },
                                { photo: 'lateReasonPhoto', label: 'Bukti Keterlambatan' }
                            ].map(({ photo, label }) => {
                                const url = (selectedPhotoRecord as any)[photo];
                                if (!url) return null;
                                return (
                                    <div key={photo} className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
                                        <div className="aspect-[4/5] bg-gray-100 rounded-xl overflow-hidden border">
                                            <img src={(url.startsWith('data:') || url.startsWith('http') || url.startsWith('/api/') || url.startsWith('/uploads/')) ? url : (url.length > 20 && !url.includes('/') ? `/api/gdrive-img/${url}` : `/uploads/${url}`)} className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
                <DialogContent className="sm:max-w-lg bg-white rounded-xl p-6 overflow-y-auto max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{editingAttendance ? "Edit Data" : "Input Manual"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Select value={manualEntry.userId} onValueChange={(v) => setManualEntry(prev => ({ ...prev, userId: v }))} disabled={!!editingAttendance}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih tenaga kerja..." /></SelectTrigger>
                            <SelectContent>{users?.filter(u => u.role === 'employee').map(u => (<SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>))}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={manualEntry.date} onChange={(e) => setManualEntry(prev => ({ ...prev, date: e.target.value }))} disabled={!!editingAttendance} /></div>
                            <div className="space-y-2"><Label>Shift</Label>
                                <Select value={manualEntry.shift} onValueChange={(v) => setManualEntry(prev => ({ ...prev, shift: v }))}>
                                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="-">Belum Tercatat (Default)</SelectItem>
                                        {allShifts && allShifts.length > 0 ? (
                                            allShifts.map((s) => (
                                                <SelectItem key={s.id} value={s.name}>
                                                    {s.name} ({s.checkInTime} - {s.checkOutTime})
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <>
                                                <SelectItem value="Shift 1">Shift 1 (07:00 - 17:00)</SelectItem>
                                                <SelectItem value="Shift 2 (Middle)">Shift 2 (Middle) (11:00 - 21:00)</SelectItem>
                                                <SelectItem value="Shift 3">Shift 3 (13:00 - 23:00)</SelectItem>
                                                <SelectItem value="Long Shift">Long Shift (07:00 - 23:00)</SelectItem>
                                                <SelectItem value="Kasir Long Shift">Kasir Long Shift (11:00 - 23:00)</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] text-slate-700 font-semibold block">Masuk (24 Jam)</Label>
                                <TimePicker24h
                                    value={manualEntry.checkIn}
                                    onChange={(val) => setManualEntry(prev => ({ ...prev, checkIn: val }))}
                                    placeholder="Masuk (07:00)"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] text-slate-700 font-semibold block">Pulang (24 Jam)</Label>
                                <TimePicker24h
                                    value={manualEntry.checkOut}
                                    onChange={(val) => setManualEntry(prev => ({ ...prev, checkOut: val }))}
                                    placeholder="Pulang (17:00)"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] text-slate-700 font-semibold block">Mulai Istirahat (24 Jam)</Label>
                                <TimePicker24h
                                    value={manualEntry.breakStart}
                                    onChange={(val) => setManualEntry(prev => ({ ...prev, breakStart: val }))}
                                    placeholder="Mulai Istirahat (12:00)"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[11px] text-slate-700 font-semibold block">Selesai Istirahat (24 Jam)</Label>
                                <TimePicker24h
                                    value={manualEntry.breakEnd}
                                    onChange={(val) => setManualEntry(prev => ({ ...prev, breakEnd: val }))}
                                    placeholder="Selesai Istirahat (13:00)"
                                />
                            </div>
                        </div>
                        <Select value={manualEntry.status} onValueChange={(v) => setManualEntry(prev => ({ ...prev, status: v }))}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="present">Hadir</SelectItem><SelectItem value="late">Telat</SelectItem><SelectItem value="sick">Sakit</SelectItem><SelectItem value="permission">Izin</SelectItem><SelectItem value="cuti">Cuti</SelectItem><SelectItem value="absent">Alpha</SelectItem>
                            </SelectContent>
                        </Select>
                        <Textarea placeholder="Catatan..." value={manualEntry.notes} onChange={(e) => setManualEntry(prev => ({ ...prev, notes: e.target.value }))} />

                        {/* FITUR TAMBAHKAN LEMBUR MANUAL */}
                        <div className="pt-2 border-t space-y-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full border-orange-400 text-orange-700 hover:bg-orange-50 font-bold rounded-xl text-xs gap-1.5 h-10"
                                onClick={() => setShowOvertimeInput(!showOvertimeInput)}
                            >
                                ⚡ {showOvertimeInput ? "Sembunyikan Form Lembur" : "Tambahkan Lembur Manual"}
                            </Button>

                            {showOvertimeInput && (
                                <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-xl space-y-3">
                                    <p className="text-xs font-extrabold text-orange-900 uppercase tracking-wide">Input Data Lembur Manual</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-700 font-semibold block">Mulai Lembur (24 Jam)</Label>
                                            <TimePicker24h
                                                value={manualOvertime.startTime}
                                                onChange={(val) => setManualOvertime(prev => ({ ...prev, startTime: val }))}
                                                placeholder="17:00"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-700 font-semibold block">Selesai Lembur (24 Jam)</Label>
                                            <TimePicker24h
                                                value={manualOvertime.endTime}
                                                onChange={(val) => setManualOvertime(prev => ({ ...prev, endTime: val }))}
                                                placeholder="20:00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[11px] text-slate-700 font-semibold">Deskripsi Pekerjaan Lembur</Label>
                                        <Textarea
                                            value={manualOvertime.description}
                                            onChange={(e) => setManualOvertime(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Contoh: Overtime perbaikan instalasi mesin..."
                                            className="bg-white text-xs h-16 rounded-lg"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-11 font-bold" onClick={() => manualMutation.mutate({ ...manualEntry, userId: parseInt(manualEntry.userId) })} disabled={manualMutation.isPending || !manualEntry.userId}>Simpan Data Absen &amp; Lembur</Button>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent className="sm:max-w-xs bg-white rounded-xl p-6">
                    <DialogHeader><DialogTitle className="text-red-600">Hapus Data?</DialogTitle></DialogHeader>
                    <div className="flex gap-3 pt-4">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmId(null)}>Batal</Button>
                        <Button className="flex-1 bg-red-600 text-white" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}>Hapus</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {isExporting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center text-white p-4">
                    <div className="bg-white text-gray-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">Mengekspor Laporan PDF</h3>
                            <p className="text-xs text-gray-500 mt-1">{exportProgress || "Harap tunggu sebentar..."}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
