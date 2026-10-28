import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Attendance, Shift } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import React, { useState, useEffect, Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Search, ArrowUpDown, MessageSquare, Plus, Edit2, Trash2, Camera, Image as ImageIcon, FileSpreadsheet, Calendar, Users, Clock, CheckCircle2 } from "lucide-react";
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
import { resolveFileUrl } from "@/lib/utils";

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

const loadJsZip = () => {
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

const loadXlsx = () => {
    return new Promise<any>((resolve, reject) => {
        if ((window as any).XLSX) {
            resolve((window as any).XLSX);
            return;
        }
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        script.onload = () => resolve((window as any).XLSX);
        script.onerror = () => reject(new Error("Gagal memuat script XLSX"));
        document.head.appendChild(script);
    });
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    }, 8000);
};

const renderRecapHtmlToPdfBlob = async ({
    html,
    pdfFileName,
    html2pdfLib,
    splitMode
}: {
    html: string;
    pdfFileName: string;
    html2pdfLib: any;
    splitMode: "split" | "combine";
}): Promise<Blob> => {
    const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
    const styleTags = Array.from(parsedDoc.querySelectorAll('style')).map(s => s.innerHTML).join('\n');
    const reportSections = Array.from(parsedDoc.querySelectorAll('section.report'));

    const savedScrollX = window.scrollX;
    const savedScrollY = window.scrollY;
    window.scrollTo(0, 0);

    // Container mounted directly with explicit A4 landscape inner printable width (277mm ~ 1047px)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '1047px';
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-9999';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.margin = '0';
    container.style.padding = '0';

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-recap-root';
    wrapper.style.width = '1047px';
    wrapper.style.margin = '0';
    wrapper.style.padding = '0';
    wrapper.style.backgroundColor = '#ffffff';

    if (reportSections.length === 0) {
        const laporanEl = parsedDoc.getElementById('laporan');
        wrapper.innerHTML = `<style>${styleTags}</style>${laporanEl ? laporanEl.innerHTML : parsedDoc.body.innerHTML}`;
    } else {
        wrapper.innerHTML = `<style>${styleTags}</style>` + reportSections.map(sec => sec.outerHTML).join('\n');
    }

    container.appendChild(wrapper);
    document.body.appendChild(container);

    try {
        // Tunggu seluruh gambar di dalam container selesai dimuat
        const imgs = Array.from(container.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(res => { img.onload = res; img.onerror = res; });
        }));

        // Margin [6mm, 10mm, 6mm, 10mm] persis seperti @media print CSS pada file referensi
        const opt = {
            margin: [6, 10, 6, 10],
            filename: pdfFileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                letterRendering: true
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'landscape',
                compress: true
            },
            pagebreak: {
                mode: ['css', 'legacy'],
                avoid: ['tr', '.attendance-table tbody tr', '.summary', '.header', '.photo-item']
            }
        };

        const worker = html2pdfLib().set(opt).from(wrapper);
        const blob: Blob = await worker.output('blob');
        return blob;
    } finally {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        window.scrollTo(savedScrollX, savedScrollY);
    }
};

const buildCustomBulkPeriods = (rangeStart: Date, rangeEnd: Date): Array<{ start: Date; end: Date }> => {
    const periods: Array<{ start: Date; end: Date }> = [];
    let curr = startOfDay(new Date(rangeStart));
    const end = startOfDay(new Date(rangeEnd));

    if (curr > end) return periods;

    if (curr.getTime() === end.getTime()) {
        const dayOfWeek = curr.getDay();
        const stepDays = dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1;
        periods.push({
            start: new Date(curr),
            end: addDays(curr, stepDays),
        });
        return periods;
    }

    while (curr < end) {
        const pStart = new Date(curr);
        const dayOfWeek = pStart.getDay();
        // Jika hari Jumat (5), hitung Jumat, Sabtu, Minggu, Senin (+3 hari, misal 9 -> 12)
        // Jika mulai hari Sabtu (6), hitung Sabtu, Minggu, Senin (+2 hari, misal 10 -> 12)
        // Hari lainnya (+1 hari, misal 8 -> 9, 12 -> 13)
        const stepDays = dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1;
        const pEnd = addDays(pStart, stepDays);
        periods.push({
            start: pStart,
            end: pEnd,
        });
        curr = pEnd;
    }

    return periods;
};

const safeFormatDate = (dateVal: any, formatStr: string, options?: any) => {
    try {
        if (!dateVal) return "";
        let d: Date;
        if (typeof dateVal === "string" && dateVal.length === 10 && dateVal.includes("-")) {
            const [y, m, day] = dateVal.split("-").map(Number);
            d = new Date(y, m - 1, day, 12, 0, 0);
        } else {
            d = new Date(dateVal);
        }
        if (isNaN(d.getTime())) return "";
        return format(d, formatStr, { locale: id, ...options });
    } catch (e) {
        return "";
    }
};

const escapeHTML = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
    const [pageSplitMode, setPageSplitMode] = useState<"split" | "combine">("split");
    const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
    const [activeTab, setActiveTab] = useState<"rekap" | "ringkasan">("rekap");
    const [ringkasanStartDate, setRingkasanStartDate] = useState<string>(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [ringkasanEndDate, setRingkasanEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingPdfRingkasan, setIsExportingPdfRingkasan] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");

    // Sinkronisasi tanggal cutoff bulanan dari konfigurasi (default 21 s/d 20)
    useEffect(() => {
        if (config?.cutoffStartDay !== undefined && config?.cutoffEndDay !== undefined) {
            const cStart = Number(config.cutoffStartDay) || 21;
            const cEnd = Number(config.cutoffEndDay) || 20;
            const now = new Date();
            setRingkasanStartDate(format(new Date(now.getFullYear(), now.getMonth() - 1, cStart), 'yyyy-MM-dd'));
            setRingkasanEndDate(format(new Date(now.getFullYear(), now.getMonth(), cEnd), 'yyyy-MM-dd'));
        }
    }, [config?.cutoffStartDay, config?.cutoffEndDay]);

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
        const cStart = Number(config?.cutoffStartDay ?? 21);
        const cEnd = Number(config?.cutoffEndDay ?? 20);
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, cStart);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), cEnd);
    }

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: allResignations } = useQuery<any[]>({
        queryKey: ["/api/admin/resignations"],
    });

    const isAdminUser = (u: any) => {
        if (!u) return false;
        if (u.isAdmin === true) return true;
        const role = (u.role || '').toLowerCase();
        if (role === 'admin' || role === 'superadmin') return true;
        if ((u.username || '').toLowerCase() === 'admin') return true;
        return false;
    };

    const isResignedUser = (u: any) => {
        if (!u) return false;
        const empStatus = (u.employmentStatus || '').toLowerCase();
        if (empStatus === 'resign') return true;
        const st = (u.status || '').toLowerCase();
        if (st === 'resign' || u.isResigned) return true;
        if (allResignations && allResignations.some((r: any) => Number(r.userId) === Number(u.id) && (r.status === 'approved' || !r.status))) return true;
        return false;
    };

    const formatLemburDisplay = (totalMins: number) => {
        if (!totalMins || totalMins <= 0) return "0 Jam";
        const h = Math.floor(totalMins / 60);
        return `${h} Jam`;
    };

    // Helper untuk menyesuaikan perhitungan lembur:
    // 1. Sesuaikan jam penugasan bulat (misal jam 20.00 - 23.00 tapi karyawan absen jam 19.50 tetap dihitung 20.00 - 23.00 = 3 jam)
    // 2. Khusus hari Sabtu dan Minggu (weekend), kurangi 1 jam istirahat
    const normalizeOvertimeDuration = (
        startTimeVal: any,
        endTimeVal: any,
        isWeekend: boolean
    ): number => {
        if (!startTimeVal || !endTimeVal) return 0;
        const start = new Date(startTimeVal);
        const end = new Date(endTimeVal);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;

        let sTime = new Date(start);
        let eTime = new Date(end);

        // Jika karyawan absen masuk lembur lebih awal dari jam bulat penugasan (misal 19.50 -> 20.00):
        if (sTime.getMinutes() >= 35) {
            sTime.setHours(sTime.getHours() + 1, 0, 0, 0);
        } else if (sTime.getMinutes() <= 15) {
            sTime.setMinutes(0, 0, 0);
        }

        // Jika karyawan selesai lembur di sekitar jam pas penugasan (misal 23.05 -> 23.00):
        if (eTime.getMinutes() <= 20) {
            eTime.setMinutes(0, 0, 0);
        } else if (eTime.getMinutes() >= 45) {
            eTime.setHours(eTime.getHours() + 1, 0, 0, 0);
        }

        let diffMins = Math.round((eTime.getTime() - sTime.getTime()) / 60000);
        if (diffMins <= 0) {
            diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
        }

        let grossHours = Math.floor(diffMins / 60);

        // Aturan: khusus lembur akhir pekan (Sabtu & Minggu), potong istirahat 1 jam
        if (isWeekend) {
            return Math.max(0, grossHours - 1);
        }
        return Math.max(0, grossHours);
    };

    const [searchRingkasan, setSearchRingkasan] = useState("");

    const { data: ringkasanAttendanceData, isLoading: isLoadingRingkasan } = useQuery<Attendance[]>({
        queryKey: [`/api/attendance?startDate=${ringkasanStartDate}&endDate=${ringkasanEndDate}`],
        enabled: activeTab === "ringkasan" || isExportingExcel,
    });

    const { data: allAttendance } = useQuery<Attendance[]>({
        queryKey: [`/api/attendance?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`],
    });

    const { data: allOvertimes } = useQuery<any[]>({
        queryKey: ["/api/admin/overtimes"],
        refetchInterval: 3000,
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

    const filteredRecords = (allAttendance || []).filter(att => {
        if (!getUserName(att.userId)) return false;

        const attDateStr = safeFormatDate(att.date, "yyyy-MM-dd");

        const hasOvertime = allOvertimes?.some(o => {
            if (!o) return false;
            if (o.attendanceId === att.id) return true;
            if (o.userId === att.userId) {
                const otDateStr = o.date ? safeFormatDate(o.date, "yyyy-MM-dd") : (o.startTime ? safeFormatDate(o.startTime, "yyyy-MM-dd") : "");
                return otDateStr === attDateStr;
            }
            return false;
        });

        // Tampilkan jika sudah absen (checkIn ada), ATAU izin/sakit/cuti/off, ATAU ada penugasan lembur (termasuk sedang berlangsung)
        const hasStartedAttendance = !!att.checkIn || ['sick', 'permission', 'cuti', 'off'].includes(att.status || '') || hasOvertime;
        if (!hasStartedAttendance) return false;

        const attDate = new Date(att.date);
        const d = new Date(attDate);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    });

    // Inject overtimes that might not have a matching attendance record in allAttendance
    const overtimesWithoutAtt = (allOvertimes || []).filter(ot => {
        if (!ot || ot.employeeApproval === "rejected" || ot.status === "cancelled") return false;
        const otDateStr = ot.date ? safeFormatDate(ot.date, "yyyy-MM-dd") : (ot.startTime ? safeFormatDate(ot.startTime, "yyyy-MM-dd") : "");
        if (!otDateStr) return false;

        const targetUserId = ot.userId || (ot.attendance ? ot.attendance.userId : undefined);
        if (!targetUserId || !getUserName(targetUserId)) return false;

        const alreadyExists = filteredRecords.some(att => 
            att.userId === targetUserId && safeFormatDate(att.date, "yyyy-MM-dd") === otDateStr
        );
        if (alreadyExists) return false;

        const d = new Date(otDateStr);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    }).map(ot => {
        const targetUserId = ot.userId || (ot.attendance ? ot.attendance.userId : undefined);
        const otDateStr = ot.date ? safeFormatDate(ot.date, "yyyy-MM-dd") : (ot.startTime ? safeFormatDate(ot.startTime, "yyyy-MM-dd") : "");
        return {
            id: `ot-synth-${ot.id}`,
            userId: targetUserId,
            date: ot.startTime || ot.date || `${otDateStr}T08:00:00`,
            status: "present",
            checkIn: null,
            checkOut: null,
            isSynthetic: true
        } as any;
    });

    const combinedRecords = [...filteredRecords, ...overtimesWithoutAtt];

    const processedData = combinedRecords
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


    // ========== RINGKASAN BULANAN: Pisah hari kerja reguler (Senin-Jumat) vs lembur ==========
    const ringkasanData = useMemo(() => {
        if (!users) return [];

        const rs = new Date(ringkasanStartDate);
        rs.setHours(0, 0, 0, 0);
        const re = new Date(ringkasanEndDate);
        re.setHours(23, 59, 59, 999);

        const isInRange = (dateVal: any) => {
            if (!dateVal) return false;
            const d = new Date(dateVal);
            return d >= rs && d <= re;
        };

        // Attendance dalam range (prioritaskan ringkasanAttendanceData jika aktif)
        const currentAttSource = ringkasanAttendanceData || allAttendance || [];
        const rangeAtt = currentAttSource.filter(att => isInRange(att.date));

        // Overtimes dalam range
        const rangeOt = (allOvertimes || []).filter(ot => {
            if (!ot || ot.employeeApproval === 'rejected' || ot.status === 'cancelled') return false;
            const dtStr = ot.date ? ot.date : (ot.startTime ? ot.startTime : null);
            if (!dtStr) return false;
            return isInRange(dtStr);
        });

        // Seluruh karyawan aktif (non-admin dan bukan karyawan resign)
        const activeEmployees = (users || [])
            .filter(u => !isAdminUser(u) && !isResignedUser(u))
            .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'));

        return activeEmployees.map(user => {
            const uid = user.id;

            // Attendance records dalam range untuk user ini
            const userAtt = rangeAtt.filter(a => a.userId === uid);

            // Hari kerja reguler: hanya absen di Senin-Jumat (getDay 1 = Senin, ..., 5 = Jumat)
            const regularAtt = userAtt.filter(a => {
                const d = new Date(a.date);
                const day = d.getDay();
                return day >= 1 && day <= 5;
            });

            // Hitung total hadir hari kerja reguler (Senin-Jumat)
            // Menggunakan Set tanggal unik (yyyy-MM-dd) agar 1 hari kerja hanya dihitung 1x meski ada multi sesi
            const presentDates = new Set<string>();
            regularAtt.forEach(a => {
                const isPresent = (a.checkIn || a.status === 'present' || a.status === 'late') &&
                    !['sick', 'permission', 'cuti', 'off', 'absent'].includes(a.status || '');
                if (isPresent) {
                    const dStr = safeFormatDate(a.date, 'yyyy-MM-dd');
                    if (dStr) presentDates.add(dStr);
                }
            });
            const totalHadirHariKerja = presentDates.size;

            // Hitung total jam kerja reguler
            let totalJamKerjaRegMins = 0;
            const processedRegDates = new Set<string>();
            regularAtt.forEach(a => {
                const dStr = safeFormatDate(a.date, 'yyyy-MM-dd');
                if (dStr && !processedRegDates.has(dStr)) {
                    processedRegDates.add(dStr);
                    const dayRecs = regularAtt.filter(r => safeFormatDate(r.date, 'yyyy-MM-dd') === dStr);
                    const { netWorkMins } = calculateDailyTotal(dayRecs);
                    if (netWorkMins > 0) totalJamKerjaRegMins += netWorkMins;
                }
            });

            // Overtime assignments untuk user ini
            const userOt = rangeOt.filter(o => {
                const targetUid = o.userId || (o.attendance?.userId);
                return Number(targetUid) === Number(uid);
            });

            // 1. Akumulasi jam dari seluruh penugasan lembur (overtimes)
            // Sesuai aturan: sesuaikan jam penugasan bulat & kurangi istirahat 1 jam khusus Sabtu/Minggu
            let totalLemburMins = 0;
            const otDatesWithDuration = new Map<string, number>();

            userOt.forEach(ot => {
                if (ot.startTime && ot.endTime) {
                    const otDate = ot.date ? new Date(ot.date) : (ot.startTime ? new Date(ot.startTime) : null);
                    const isWeekendOt = otDate ? (otDate.getDay() === 0 || otDate.getDay() === 6) : false;

                    const sessionHours = normalizeOvertimeDuration(ot.startTime, ot.endTime, isWeekendOt);
                    if (sessionHours > 0) {
                        const roundedMins = sessionHours * 60;
                        totalLemburMins += roundedMins;
                        const otDateStr = ot.date ? safeFormatDate(ot.date, 'yyyy-MM-dd') : safeFormatDate(ot.startTime, 'yyyy-MM-dd');
                        if (otDateStr) {
                            otDatesWithDuration.set(otDateStr, (otDatesWithDuration.get(otDateStr) || 0) + roundedMins);
                        }
                    }
                }
            });

            // 2. Akumulasi jam dari kehadiran di hari Sabtu & Minggu (Weekend)
            // Semua kehadiran di akhir pekan otomatis dihitung lembur, dan dikurangi istirahat 1 jam!
            const weekendAtt = userAtt.filter(a => {
                const d = new Date(a.date);
                const day = d.getDay();
                return day === 0 || day === 6; // 0 = Minggu, 6 = Sabtu
            });

            const processedWeekendDates = new Set<string>();
            weekendAtt.forEach(a => {
                const dStr = safeFormatDate(a.date, 'yyyy-MM-dd');
                if (dStr && !processedWeekendDates.has(dStr)) {
                    processedWeekendDates.add(dStr);
                    const dayRecs = weekendAtt.filter(r => safeFormatDate(r.date, 'yyyy-MM-dd') === dStr);
                    const { netWorkMins } = calculateDailyTotal(dayRecs);
                    const grossWeekendHours = Math.floor(netWorkMins / 60);
                    // Kurangi istirahat 1 jam untuk lembur Sabtu/Minggu
                    const netWeekendHours = Math.max(0, grossWeekendHours - 1);
                    const roundedWeekendMins = netWeekendHours * 60;

                    // Jika hari weekend ini BELUM tercatat durasi lembur di table overtimes, tambahkan durasi absensi ini
                    const existingOtMins = otDatesWithDuration.get(dStr) || 0;
                    if (existingOtMins === 0 && roundedWeekendMins > 0) {
                        totalLemburMins += roundedWeekendMins;
                    } else if (roundedWeekendMins > existingOtMins) {
                        // Jika jam absensi nyata lebih besar dari yang diinput manual, sesuaikan selisihnya
                        totalLemburMins += (roundedWeekendMins - existingOtMins);
                    }
                }
            });

            // Format total jam lembur jadi jam bulat (integer murni)
            const totalLemburHours = Math.floor(totalLemburMins / 60);
            const totalLemburFormatted = totalLemburHours;

            const totalJamKerjaH = Math.floor(totalJamKerjaRegMins / 60);
            const totalJamKerjaM = totalJamKerjaRegMins % 60;
            const totalJamKerjaStr = totalJamKerjaRegMins > 0
                ? (totalJamKerjaM > 0 ? `${totalJamKerjaH}j ${totalJamKerjaM}m` : `${totalJamKerjaH}j`)
                : '-';

            const dept = ((user as any).position || (user as any).department || (user as any).dept || '-').toUpperCase();

            const totalHadirStr = `${totalHadirHariKerja} Hari`;
            const totalLemburStr = formatLemburDisplay(totalLemburMins);

            return {
                userId: uid,
                nik: user.nik || user.username || '-',
                nama: (user.fullName || '').toUpperCase(),
                dept,
                totalHadirHariKerja,
                totalHadirStr,
                totalLemburMins,
                totalLemburHours: totalLemburFormatted,
                totalLemburStr,
                totalJamKerjaRegMins,
                totalJamKerjaStr,
            };
        });
    }, [users, allResignations, allAttendance, ringkasanAttendanceData, allOvertimes, ringkasanStartDate, ringkasanEndDate]);

    const handleExportExcel = async () => {
        if (!ringkasanData || ringkasanData.length === 0) {
            toast({ title: "Tidak ada data", description: "Belum ada data untuk rentang tanggal ini.", variant: "destructive" });
            return;
        }
        setIsExportingExcel(true);
        try {
            const XLSX = await loadXlsx();

            const exportTargetData = selectedEmployeeId === "all"
                ? ringkasanData
                : ringkasanData.filter((r: any) => String(r.userId) === selectedEmployeeId);

            if (exportTargetData.length === 0) {
                toast({ title: "Tidak ada data", description: "Tidak ada data untuk karyawan yang dipilih.", variant: "destructive" });
                setIsExportingExcel(false);
                return;
            }

            const formattedStart = safeFormatDate(ringkasanStartDate, "d MMMM yyyy");
            const formattedEnd = safeFormatDate(ringkasanEndDate, "d MMMM yyyy");
            const titleRow = [`Rekap absensi tanggal ${formattedStart} s/d ${formattedEnd} ${namaPt}`];
            const emptyRow: string[] = [];

            // Header columns exact casing:
            // NO | NAMA | DEPT | Total Hadir Hari Kerja | Total Lembur (Jam)
            const headerRow = ['NO', 'NAMA', 'DEPT', 'Total Hadir Hari Kerja', 'Total Lembur (Jam)'];

            const dataRows = exportTargetData.map((row: any, i: number) => [
                i + 1,
                row.nama,
                row.dept,
                row.totalHadirStr,
                row.totalLemburStr,
            ]);

            const allRows = [titleRow, emptyRow, headerRow, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(allRows);

            // Merge header title across columns A1 to E1
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

            // Set column widths matching the layout
            ws['!cols'] = [
                { wch: 6 },   // NO
                { wch: 36 },  // NAMA
                { wch: 30 },  // DEPT
                { wch: 24 },  // Total Hadir Hari Kerja
                { wch: 26 },  // Total Lembur (Jam)
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');

            const startStr = ringkasanStartDate.replace(/-/g, '');
            const endStr = ringkasanEndDate.replace(/-/g, '');
            const empSuffix = selectedEmployeeId === "all" ? "" : `_${(exportTargetData[0]?.nama || '').replace(/\s+/g, '_')}`;
            const fileName = `REKAP_ABSENSI_${startStr}_to_${endStr}${empSuffix}.xlsx`;

            XLSX.writeFile(wb, fileName);
            toast({
                title: "✅ Export Excel Berhasil",
                description: `File ${fileName} berhasil dibuat dan diunduh.`
            });
        } catch (err: any) {
            toast({
                title: "Gagal Export Excel",
                description: err?.message || "Terjadi kesalahan saat memproses file Excel.",
                variant: "destructive"
            });
        } finally {
            setIsExportingExcel(false);
        }
    };



    const handleExportPdfRingkasan = async () => {
        if (!ringkasanData || ringkasanData.length === 0) {
            toast({ title: "Tidak ada data", description: "Belum ada data untuk rentang tanggal ini.", variant: "destructive" });
            return;
        }

        setIsExportingPdfRingkasan(true);
        try {
            const html2pdfLib = await loadHtml2Pdf();
            const logoDataUrl = await fetchLogoBase64();

            const exportTargetData = selectedEmployeeId === "all"
                ? ringkasanData
                : ringkasanData.filter((r: any) => String(r.userId) === selectedEmployeeId);

            if (exportTargetData.length === 0) {
                toast({ title: "Tidak ada data", description: "Tidak ada data untuk karyawan yang dipilih.", variant: "destructive" });
                setIsExportingPdfRingkasan(false);
                return;
            }

            const formattedStart = safeFormatDate(ringkasanStartDate, "d MMMM yyyy");
            const formattedEnd = safeFormatDate(ringkasanEndDate, "d MMMM yyyy");
            const formattedPrintDate = format(new Date(), "d MMMM yyyy, HH:mm", { locale: id });
            const themeColor = config?.hexPrimary || "#ea580c";

            const periodStart = safeFormatDate(ringkasanStartDate, "dd MMM yyyy", { locale: id }).toUpperCase();
            const periodEnd = safeFormatDate(ringkasanEndDate, "dd MMM yyyy", { locale: id }).toUpperCase();
            const periodStr = `${periodStart} - ${periodEnd}`;
            const empSuffix = selectedEmployeeId === "all" ? "" : ` - ${(exportTargetData[0]?.nama || '').replace(/\s+/g, ' ')}`;
            const pdfFileName = `LAPORAN REKAP ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr}${empSuffix}.pdf`;

            let tableRowsHtml = "";
            exportTargetData.forEach((row: any, i: number) => {
                tableRowsHtml += `
                    <tr>
                        <td class="td-center" style="font-weight: 700; color: #475569;">${i + 1}</td>
                        <td class="td-left td-name">${escapeHTML(row.nama)}</td>
                        <td class="td-center td-dept">${escapeHTML(row.dept)}</td>
                        <td class="td-center td-hadir">${escapeHTML(row.totalHadirStr)}</td>
                        <td class="td-center td-lembur">${escapeHTML(row.totalLemburStr)}</td>
                    </tr>
                `;
            });

            let singleEmpDetailsHtml = "";
            if (selectedEmployeeId !== "all") {
                const rs = new Date(ringkasanStartDate);
                rs.setHours(0, 0, 0, 0);
                const re = new Date(ringkasanEndDate);
                re.setHours(23, 59, 59, 999);
                const isInDateRange = (dateVal: any) => {
                    if (!dateVal) return false;
                    const d = new Date(dateVal);
                    return d >= rs && d <= re;
                };

                const currentAttSource = ringkasanAttendanceData || allAttendance || [];
                const empAtt = currentAttSource
                    .filter(a => String(a.userId) === selectedEmployeeId && isInDateRange(a.date))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const regularRecords = empAtt.filter(a => {
                    const day = new Date(a.date).getDay();
                    return day >= 1 && day <= 5;
                });

                const empOvertimes = (allOvertimes || []).filter(ot => {
                    if (!ot || ot.employeeApproval === 'rejected' || ot.status === 'cancelled') return false;
                    const targetUid = ot.userId || (ot.attendance?.userId);
                    if (String(targetUid) !== selectedEmployeeId) return false;
                    const dtStr = ot.date ? ot.date : (ot.startTime ? ot.startTime : null);
                    return isInDateRange(dtStr);
                });

                const otDates = new Set(
                    empOvertimes.map(ot => {
                        return ot.date ? safeFormatDate(ot.date, 'yyyy-MM-dd') : safeFormatDate(ot.startTime, 'yyyy-MM-dd');
                    }).filter(Boolean)
                );

                // Hanya sertakan absensi weekend yang benar-benar ada jam absen dan belum tercatat di SPL agar tidak dobel
                const weekendRecords = empAtt.filter(a => {
                    const day = new Date(a.date).getDay();
                    const isWeekend = day === 0 || day === 6;
                    if (!isWeekend) return false;
                    const hasClock = !!(a.checkIn || a.checkOut);
                    if (!hasClock) return false;
                    const dStr = safeFormatDate(a.date, 'yyyy-MM-dd');
                    if (dStr && otDates.has(dStr)) return false;
                    return true;
                });

                let regRows = "";
                regularRecords.forEach((r, idx) => {
                    const statusText = r.status === 'present' ? 'Hadir Tepat Waktu' : (r.status === 'late' ? 'Terlambat' : (r.status || 'Hadir'));
                    const statusColor = r.status === 'late' ? '#dc2626' : '#166534';
                    regRows += `
                        <tr>
                            <td class="td-center">${idx + 1}</td>
                            <td class="td-left" style="font-weight: 700;">${safeFormatDate(r.date, "EEEE, d MMM yyyy", { locale: id })}</td>
                            <td class="td-center">${r.checkIn ? safeFormatDate(r.checkIn, "HH:mm") : "-"}</td>
                            <td class="td-center">${r.breakStart ? safeFormatDate(r.breakStart, "HH:mm") : "-"} s/d ${r.breakEnd ? safeFormatDate(r.breakEnd, "HH:mm") : "-"}</td>
                            <td class="td-center">${r.checkOut ? safeFormatDate(r.checkOut, "HH:mm") : "-"}</td>
                            <td class="td-center" style="font-weight: 700; color: ${statusColor};">${escapeHTML(statusText)}</td>
                            <td class="td-left" style="font-size: 6.8pt; color: #64748b;">${escapeHTML(r.lateReason || r.notes || "-")}</td>
                        </tr>
                    `;
                });

                let otRows = "";
                let otIdx = 1;
                weekendRecords.forEach(w => {
                    otRows += `
                        <tr>
                            <td class="td-center">${otIdx++}</td>
                            <td class="td-left" style="font-weight: 700;">${safeFormatDate(w.date, "EEEE, d MMM yyyy", { locale: id })}</td>
                            <td class="td-center">${w.checkIn ? safeFormatDate(w.checkIn, "HH:mm") : "-"}</td>
                            <td class="td-center">${w.checkOut ? safeFormatDate(w.checkOut, "HH:mm") : "-"}</td>
                            <td class="td-left" style="color: #c2410c; font-weight: 700;">Lembur Akhir Pekan (Sabtu/Minggu)</td>
                            <td class="td-center" style="font-weight: 700; color: #166534;">Otomatis Dihitung</td>
                        </tr>
                    `;
                });
                empOvertimes.forEach(ot => {
                    const otDateStr = ot.date ? safeFormatDate(ot.date, "EEEE, d MMM yyyy", { locale: id }) : (ot.startTime ? safeFormatDate(ot.startTime, "EEEE, d MMM yyyy", { locale: id }) : "-");
                    otRows += `
                        <tr>
                            <td class="td-center">${otIdx++}</td>
                            <td class="td-left" style="font-weight: 700;">${otDateStr}</td>
                            <td class="td-center">${ot.startTime ? safeFormatDate(ot.startTime, "HH:mm") : "-"}</td>
                            <td class="td-center">${ot.endTime ? safeFormatDate(ot.endTime, "HH:mm") : "-"}</td>
                            <td class="td-left">${escapeHTML(ot.reason || ot.notes || "Penugasan Lembur")}</td>
                            <td class="td-center" style="font-weight: 700; color: #166534;">Disetujui</td>
                        </tr>
                    `;
                });

                singleEmpDetailsHtml = `
                    <div style="margin-top: 18px; page-break-inside: avoid;">
                        <h4 style="font-size: 8.8pt; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 6px 0; border-left: 3px solid ${themeColor}; padding-left: 6px;">
                            1. Rincian Absensi Hari Kerja Reguler (Senin s/d Jumat)
                        </h4>
                        <table class="recap-table" style="font-size: 7pt; margin-bottom: 12px;">
                            <thead>
                                <tr>
                                    <th style="width: 5%;">NO</th>
                                    <th style="width: 22%;">HARI, TANGGAL</th>
                                    <th style="width: 13%;">MASUK</th>
                                    <th style="width: 18%;">ISTIRAHAT</th>
                                    <th style="width: 13%;">PULANG</th>
                                    <th style="width: 14%;">STATUS</th>
                                    <th style="width: 15%;">KETERANGAN</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${regRows || '<tr><td colspan="7" class="td-center" style="padding: 10px; color: #94a3b8;">Tidak ada catatan kehadiran reguler pada periode ini.</td></tr>'}
                            </tbody>
                        </table>

                        <h4 style="font-size: 8.8pt; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 12px 0 6px 0; border-left: 3px solid #c2410c; padding-left: 6px;">
                            2. Rincian Riwayat Lembur (Weekend &amp; Penugasan Lembur)
                        </h4>
                        <table class="recap-table" style="font-size: 7pt; margin-bottom: 12px;">
                            <thead>
                                <tr>
                                    <th style="width: 5%;">NO</th>
                                    <th style="width: 24%;">HARI, TANGGAL</th>
                                    <th style="width: 14%;">JAM MULAI</th>
                                    <th style="width: 14%;">JAM SELESAI</th>
                                    <th style="width: 28%;">KEPERLUAN / ALASAN LEMBUR</th>
                                    <th style="width: 15%;">STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${otRows || '<tr><td colspan="6" class="td-center" style="padding: 10px; color: #94a3b8;">Tidak ada catatan lembur pada periode ini.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            }

            const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>LAPORAN KEHADIRAN TENAGA KERJA - ${escapeHTML(namaPt)}</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 8mm 10mm 8mm 10mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body, .pdf-recap-root {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8pt;
            width: 1047px !important;
        }
        .report-card {
            width: 100%;
            max-width: 1047px;
            margin: 0 auto;
            padding: 4px 8px;
            background: #ffffff;
        }
        .kop-surat {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 6px;
            border-bottom: 2.5px solid #0f172a;
            position: relative;
        }
        .kop-surat::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: -4px;
            height: 1px;
            background: #64748b;
        }
        .kop-logo-wrapper {
            flex-shrink: 0;
            display: flex;
            align-items: center;
        }
        .kop-logo {
            max-height: 48px;
            max-width: 120px;
            object-fit: contain;
        }
        .company-block {
            text-align: right;
            flex-grow: 1;
            margin-left: 16px;
        }
        .company-name {
            font-size: 14.5pt;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #0f172a;
            text-transform: uppercase;
            margin: 0 0 2px 0;
        }
        .company-address {
            font-size: 8.5pt;
            font-weight: normal;
            color: #334155;
            line-height: 1.3;
            margin: 0;
        }
        .report-header {
            text-align: center;
            margin-top: 14px;
            margin-bottom: 14px;
        }
        .report-title {
            font-size: 11.5pt;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 4px 0;
        }
        .report-period {
            font-size: 9pt;
            font-weight: 600;
            color: #334155;
            margin: 0;
        }
        .recap-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 7.5pt;
            margin-bottom: 12px;
        }
        .recap-table thead {
            display: table-header-group;
        }
        .recap-table thead tr th {
            background: ${themeColor};
            color: #ffffff;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 6.5px 5px;
            border: 1px solid rgba(0, 0, 0, 0.15);
            text-align: center;
            font-size: 7.3pt;
        }
        .recap-table thead tr th.border-r-white {
            border-right: 1px solid rgba(255, 255, 255, 0.35);
        }
        .recap-table tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .recap-table tbody tr:nth-child(even) {
            background: #f8fafc;
        }
        .recap-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            vertical-align: middle;
            color: #1e293b;
            line-height: 1.25;
        }
        .td-center { text-align: center; }
        .td-left { text-align: left; }
        .td-name { font-weight: 700; color: #0f172a; text-transform: uppercase; }
        .td-dept { font-weight: 600; color: #475569; text-transform: uppercase; font-size: 7pt; }
        .td-hadir { font-weight: 800; color: #0f172a; background: rgba(234, 88, 12, 0.05); font-size: 8pt; }
        .td-lembur { font-weight: 800; color: #c2410c; background: #fff7ed; font-size: 8pt; }

    </style>
</head>
<body>
    <div class="pdf-recap-root">
        <div class="report-card">
            <div class="kop-surat">
                <div class="kop-logo-wrapper">
                    ${logoDataUrl ? `<img src="${logoDataUrl}" class="kop-logo" alt="Logo Perusahaan" />` : `<div style="font-size: 16pt; font-weight: 900; color: ${themeColor};">${escapeHTML(singkatanPt)}</div>`}
                </div>
                <div class="company-block">
                    <h1 class="company-name">${escapeHTML(namaPt)}</h1>
                    <p class="company-address">${escapeHTML(alamatPt || "Jl. Raya Dukuh, Industri Anggadita, Karawang Timur")}</p>
                </div>
            </div>

            <div class="report-header">
                <h2 class="report-title">LAPORAN KEHADIRAN TENAGA KERJA</h2>
                <p class="report-period">
                    Periode: <strong>${escapeHTML(formattedStart)}</strong> s/d <strong>${escapeHTML(formattedEnd)}</strong>
                </p>
            </div>

            <table class="recap-table">
                <thead>
                    <tr>
                        <th class="border-r-white" style="width: 5%;">NO</th>
                        <th class="border-r-white" style="width: 33%;">NAMA KARYAWAN</th>
                        <th class="border-r-white" style="width: 24%;">DEPT / JABATAN</th>
                        <th class="border-r-white" style="width: 19%;">TOTAL HADIR HARI KERJA</th>
                        <th style="width: 19%;">TOTAL LEMBUR (JAM)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            ${singleEmpDetailsHtml}
        </div>
    </div>
</body>
</html>`;

            const pdfBlob = await renderRecapHtmlToPdfBlob({
                html,
                pdfFileName,
                html2pdfLib,
                splitMode: "combine"
            });

            triggerBlobDownload(pdfBlob, pdfFileName);
            toast({
                title: "✅ PDF Berhasil Diunduh",
                description: pdfFileName
            });
        } catch (err: any) {
            toast({
                title: "Gagal Export PDF",
                description: err?.message || "Terjadi kesalahan saat memproses file PDF.",
                variant: "destructive"
            });
        } finally {
            setIsExportingPdfRingkasan(false);
        }
    };
    // ========== END RINGKASAN ==========
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

    const buildRecapReportHtml = ({
        docTitle,
        periodStr,
        namaPt,
        singkatanPt,
        alamatPt,
        logoDataUrl,
        usersList,
        processedData,
        startDate,
        endDate,
        imageCache = {},
        isPdf = false,
        pageSplitMode = "split"
    }: {
        docTitle: string;
        periodStr: string;
        namaPt: string;
        singkatanPt: string;
        alamatPt: string;
        logoDataUrl: string;
        usersList: any[];
        processedData: any[];
        startDate: Date;
        endDate: Date;
        imageCache?: Record<string, string>;
        isPdf?: boolean;
        pageSplitMode?: "split" | "combine";
    }) => {
        const escapeHTML = (value: any): string => {
            if (value === null || value === undefined) return "";
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const NAMA_BULAN = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];

        const formatTanggalIndo = (date: Date): string => {
            return `${NAMA_HARI[date.getDay()]}, ${date.getDate()} ${NAMA_BULAN[date.getMonth()]} ${date.getFullYear()}`;
        };

        const formatISO = (date: Date): string => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        };

        const formatTimeDot = (dateVal: any): string => {
            if (!dateVal) return "-";
            try {
                return format(new Date(dateVal), "HH.mm");
            } catch (_) {
                return "-";
            }
        };

        const formatJamKerjaIndo = (minutes: number): string => {
            if (minutes <= 0) return "-";
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            if (h > 0 && m > 0) return `${h} jam ${m} menit`;
            if (h > 0) return `${h} jam 0 menit`;
            return `${m} menit`;
        };

        const normalisasiStatus = (status: string | null | undefined): string => {
            if (!status) return "HADIR";
            const s = String(status).trim().toUpperCase();
            if (s === "PRESENT") return "HADIR";
            if (s === "LATE") return "TELAT";
            if (s === "SICK") return "SAKIT";
            if (s === "PERMISSION") return "IZIN";
            if (s === "CUTI") return "CUTI";
            if (s === "ABSENT") return "ALPHA";
            return s;
        };

        const classStatus = (status: string): string => {
            switch (status) {
                case "HADIR": return "status-hadir";
                case "TELAT": return "status-telat";
                case "SAKIT": return "status-sakit";
                case "IZIN": return "status-izin";
                case "CUTI": return "status-cuti";
                case "ALPHA": return "status-alpha";
                default: return "status-lain";
            }
        };

        const allDates: Date[] = [];
        let curr = new Date(startDate);
        const end = new Date(endDate);
        curr.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        while (curr <= end) {
            allDates.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }

        const uniqueUserIds = Array.from(new Set(processedData.map(r => r.userId)));
        const employeeList = uniqueUserIds
            .map(uid => usersList?.find(u => u.id === uid))
            .filter(Boolean)
            .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'));

        let reportsHtml = "";

        if (employeeList.length === 0) {
            reportsHtml = `
                <div style="max-width:700px; margin:50px auto; padding:30px; background:white; border:1px solid #ddd; text-align:center;">
                    <h2>Belum ada data absensi</h2>
                    <p>Silakan masukkan data absensi untuk periode ini.</p>
                </div>
            `;
        } else {
            employeeList.forEach((emp, empIdx) => {
                const empName = (emp.fullName || '').toUpperCase();
                const empNik = emp.nik || emp.username || '';
                let jumlahHadir = 0;
                let jumlahTelat = 0;
                let jumlahTidakAbsen = 0;
                let jumlahSakit = 0;
                let jumlahIzin = 0;
                let totalMinsEmp = 0;
                let totalOtMinsEmp = 0;

                let isiBaris = "";

                allDates.forEach((dateObj) => {
                    const dateIso = formatISO(dateObj);
                    const dayRecords = processedData.filter(
                        r => r.userId === emp.id && format(new Date(r.date), "yyyy-MM-dd") === dateIso
                    );

                    const empOvertimes = (allOvertimes || []).filter(ot => {
                        if (!ot || ot.status === 'cancelled') return false;
                        const targetUserId = ot.userId || (ot.attendance ? ot.attendance.userId : undefined);
                        if (Number(targetUserId) !== Number(emp.id)) return false;
                        const otDateStr = ot.date ? safeFormatDate(ot.date, "yyyy-MM-dd") : (ot.startTime ? safeFormatDate(ot.startTime, "yyyy-MM-dd") : "");
                        return otDateStr === dateIso;
                    });

                    // Accumulate total overtime minutes for summary
                    empOvertimes.forEach(ot => {
                        if (ot.startTime && ot.endTime) {
                            const mins = Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000);
                            if (mins > 0) {
                                totalOtMinsEmp += mins;
                            }
                        }
                    });

                    let overtimeTextHtml = "";
                    if (empOvertimes.length > 0) {
                        overtimeTextHtml = empOvertimes.map(ot => {
                            const startStr = formatTimeDot(ot.startTime);
                            const endStr = ot.endTime ? formatTimeDot(ot.endTime) : (ot.status === 'ongoing' ? 'Berlangsung' : '-');
                            let durStr = "";
                            if (ot.startTime && ot.endTime) {
                                const mins = Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000);
                                if (mins > 0) {
                                    const h = Math.floor(mins / 60);
                                    const m = mins % 60;
                                    durStr = h > 0 ? (m > 0 ? `${h} jam ${m} menit` : `${h} jam`) : `${m} menit`;
                                }
                            }
                            const descStr = ot.description || ot.finalDescription || "";
                            const statusLabel = ot.employeeApproval === 'approved' ? 'Disetujui' : (ot.employeeApproval === 'rejected' ? 'Izin' : 'Pending');

                            let block = `<div class="lembur-block">`;
                            block += `<div class="lembur-title">Lembur: <strong>${escapeHTML(startStr)} sampai ${escapeHTML(endStr)}</strong> ${durStr ? `<span class="lembur-durasi">(${durStr})</span>` : ''}</div>`;
                            if (descStr) {
                                block += `<div class="lembur-desc">Keterangan: ${escapeHTML(descStr)}</div>`;
                            }
                            block += `<div class="lembur-status">Status Lembur: <strong>${escapeHTML(statusLabel)}</strong></div>`;
                            block += `</div>`;
                            return block;
                        }).join("");
                    }

                    const photoList: { url: string; label: string }[] = [];
                    
                    if (dayRecords.length > 0) {
                        const rec = dayRecords[0];
                        if (rec.checkInPhoto) photoList.push({ url: rec.checkInPhoto, label: "Absen Masuk" });
                        if (rec.breakStartPhoto) photoList.push({ url: rec.breakStartPhoto, label: "Istirahat" });
                        if (rec.breakEndPhoto) photoList.push({ url: rec.breakEndPhoto, label: "Selesai Ist" });
                        if (rec.checkOutPhoto) photoList.push({ url: rec.checkOutPhoto, label: "Absen Pulang" });
                        if ((rec as any).lateReasonPhoto) photoList.push({ url: (rec as any).lateReasonPhoto, label: "Bukti Telat" });
                    }

                    empOvertimes.forEach(ot => {
                        if (ot.initialProofUrl) photoList.push({ url: ot.initialProofUrl, label: "Awal Lembur" });
                        if (ot.finalProofUrl) photoList.push({ url: ot.finalProofUrl, label: "Hasil Lembur" });
                    });

                    let photoCellHtml = "";
                    if (photoList.length > 0) {
                        photoCellHtml = `<div class="photo-grid">` +
                            photoList.map(p => {
                                const rawUrl = p.url;
                                const resolved = resolveFileUrl(rawUrl);
                                const fullUrl = resolved.startsWith('http')
                                    ? resolved
                                    : `${window.location.origin}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
                                const src = imageCache[rawUrl] || imageCache[resolved] || imageCache[fullUrl] || fullUrl;
                                return `
                                    <div class="photo-item">
                                        <img src="${escapeHTML(src)}" class="photo-img" alt="${escapeHTML(p.label)}" loading="eager" />
                                        <span class="photo-label">${escapeHTML(p.label)}</span>
                                    </div>
                                `;
                            }).join("") +
                            `</div>`;
                    } else {
                        photoCellHtml = `<span class="no-photo">-</span>`;
                    }

                    if (dayRecords.length === 0) {
                        jumlahTidakAbsen++;
                        isiBaris += `
                            <tr>
                                <td class="date-column">${formatTanggalIndo(dateObj)}</td>
                                <td>
                                    <div class="tidak-absen">TIDAK ABSEN</div>
                                    ${overtimeTextHtml}
                                </td>
                                <td>${photoCellHtml}</td>
                            </tr>
                        `;
                    } else {
                        const rec = dayRecords[0];
                        const statusNorm = normalisasiStatus(rec.status);
                        const kelas = classStatus(statusNorm);

                        if (statusNorm === "HADIR" || statusNorm === "TELAT") jumlahHadir++;
                        if (statusNorm === "TELAT") jumlahTelat++;
                        if (statusNorm === "SAKIT") jumlahSakit++;
                        if (statusNorm === "IZIN") jumlahIzin++;

                        const masuk = formatTimeDot(rec.checkIn);
                        const pulang = formatTimeDot(rec.checkOut);

                        const istirahatStart = formatTimeDot(rec.breakStart);
                        const istirahatEnd = formatTimeDot(rec.breakEnd);
                        let istirahatText = "";
                        if (istirahatStart !== "-" && istirahatEnd !== "-") {
                            istirahatText = `<strong>${istirahatStart} sampai ${istirahatEnd}</strong>`;
                        } else if (istirahatStart !== "-") {
                            istirahatText = `<strong>${istirahatStart} sampai -</strong>`;
                        }

                        const { netWorkMins } = calculateDailyTotal(dayRecords);
                        if (netWorkMins > 0) {
                            totalMinsEmp += netWorkMins;
                        }
                        const jamKerjaStr = netWorkMins > 0 ? formatJamKerjaIndo(netWorkMins) : "";

                        const lateReasonStr = rec.lateReason || (rec as any).late_reason || "";
                        const notesStr = rec.notes || "";

                        let cellHtml = `
                            <td>
                                <div class="${kelas}">${escapeHTML(statusNorm)}</div>
                        `;

                        if (masuk !== "-" || pulang !== "-") {
                            const pulangDisplay = pulang !== "-" ? pulang : (masuk !== "-" ? '<span style="color:#d97706;font-weight:bold;">Tdk Absen Pulang</span>' : '-');
                            cellHtml += `
                                <div class="jam">Jam: <strong>${escapeHTML(masuk)} sampai </strong>${pulang !== "-" ? `<strong>${escapeHTML(pulang)}</strong>` : '<span style="color:#d97706;font-weight:bold;">Tdk Absen Pulang</span>'}</div>
                            `;
                        }

                        if (istirahatText) {
                            cellHtml += `
                                <div class="jam-istirahat">Istirahat: ${istirahatText}</div>
                            `;
                        }

                        if (jamKerjaStr) {
                            cellHtml += `
                                <div class="jam-kerja">Jam kerja: <strong>${escapeHTML(jamKerjaStr)}</strong></div>
                            `;
                        }

                        if (lateReasonStr) {
                            cellHtml += `
                                <div class="alasan-telat"><strong>Alasan Telat:</strong> ${escapeHTML(lateReasonStr)}</div>
                            `;
                        }

                        if (notesStr) {
                            cellHtml += `
                                <div class="keterangan">${escapeHTML(notesStr)}</div>
                            `;
                        }

                        if (overtimeTextHtml) {
                            cellHtml += overtimeTextHtml;
                        }

                        cellHtml += `</td>`;

                        isiBaris += `
                            <tr>
                                <td class="date-column">${formatTanggalIndo(dateObj)}</td>
                                ${cellHtml}
                                <td>${photoCellHtml}</td>
                            </tr>
                        `;
                    }
                });

                const totalHours = Math.floor(totalMinsEmp / 60);
                const totalMinsRem = totalMinsEmp % 60;
                const totalJamKerjaStr = totalMinsEmp > 0 ? `${totalHours} jam ${totalMinsRem} menit` : "-";

                const totalOtHours = Math.floor(totalOtMinsEmp / 60);
                const totalJamLemburStr = totalOtHours > 0 ? `${totalOtHours} Jam` : "-";

                reportsHtml += `
                    <section class="report">
                        <div class="letterhead">
                            ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Logo" />` : ''}
                            <div class="company-block">
                                <h1>${escapeHTML(namaPt)}</h1>
                                ${alamatPt ? `<p class="alamat">${escapeHTML(alamatPt)}</p>` : `<p class="alamat">Sistem Manajemen Kehadiran Digital</p>`}
                            </div>
                        </div>
                        <hr class="hr-thick" />
                        <hr class="hr-thin" />

                        <header class="header">
                            <div class="header-left">
                                <div class="company">${escapeHTML(singkatanPt)}</div>
                                <h1 class="title">LAPORAN KEHADIRAN TENAGA KERJA</h1>
                                <p class="period">Periode ${escapeHTML(periodStr)}</p>
                            </div>
                            <div class="header-right">
                                <h2 class="employee-name">${escapeHTML(empName)}</h2>
                                ${empNik ? `<div class="employee-nik">NIK: ${escapeHTML(empNik)}</div>` : ''}
                                <div class="report-number">No. ${empIdx + 1}</div>
                            </div>
                        </header>

                        <div class="summary">
                            <div class="summary-item">
                                <span class="summary-label">Hadir</span>
                                <span class="summary-value">${jumlahHadir} hari</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Telat</span>
                                <span class="summary-value">${jumlahTelat} hari</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Tidak Absen</span>
                                <span class="summary-value">${jumlahTidakAbsen} hari</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Sakit</span>
                                <span class="summary-value">${jumlahSakit} hari</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Izin</span>
                                <span class="summary-value">${jumlahIzin} hari</span>
                            </div>
                            <div class="summary-item summary-item-highlight">
                                <span class="summary-label">Total Jam Kerja</span>
                                <span class="summary-value summary-value-work">${totalJamKerjaStr}</span>
                            </div>
                            <div class="summary-item summary-item-overtime">
                                <span class="summary-label">Total Jam Lembur</span>
                                <span class="summary-value summary-value-overtime">${totalJamLemburStr}</span>
                            </div>
                        </div>

                        <table class="attendance-table">
                            <thead>
                                <tr>
                                    <th style="width: 18%;">TANGGAL</th>
                                    <th style="width: 44%;">KEHADIRAN & LEMBUR</th>
                                    <th style="width: 38%;">BUKTI FOTO ( ABSEN & LEMBUR )</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${isiBaris}
                            </tbody>
                        </table>
                    </section>
                `;
            });
        }

        return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(docTitle)}</title>
    <style>
        @page { size: A4 landscape; margin: 6mm 10mm 6mm 10mm; }
        * { box-sizing: border-box; }
        ${isPdf ? `.pdf-recap-root { margin: 0 !important; padding: 0 !important; background: #ffffff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 6.5pt; width: 1047px !important; }` : 'html, body { margin: 0; padding: 0; }\n        body { background: #eeeeee; color: #0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; }'}
        .report { 
            width: 100%; 
            max-width: ${isPdf ? "1047px" : "1050px"}; 
            margin: ${isPdf ? "0 0 6mm 0" : "10px auto 30px auto"}; 
            padding: ${isPdf ? "2mm 4mm 4mm 4mm" : "10px 14px"}; 
            background: #ffffff; 
            page-break-after: ${pageSplitMode === "split" ? "always" : "auto"}; 
            page-break-inside: avoid; 
            break-inside: avoid; 
            border-bottom: ${pageSplitMode === "combine" ? "3px double #94a3b8" : "none"};
            padding-bottom: ${pageSplitMode === "combine" ? (isPdf ? "16px" : "35px") : (isPdf ? "4mm" : "10px")};
        }
        .report:last-child { 
            page-break-after: auto; 
            border-bottom: none;
            padding-bottom: ${isPdf ? "6px" : "10px"};
        }
        .letterhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; min-height: 36px; }
        .logo-img { height: 36px; max-width: 110px; object-fit: contain; flex-shrink: 0; }
        .company-block { text-align: right; flex-grow: 1; margin-left: 12px; }
        .company-block h1 { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 1px; letter-spacing: 0.5px; }
        .company-block .alamat { font-size: 8.5px; font-weight: normal; color: #334155; line-height: 1.2; margin-top: 1px; }
        .hr-thick { border: none; border-top: 2px solid #0f172a; margin: 3px 0 1px; }
        .hr-thin { border: none; border-top: 1px solid #cbd5e1; margin-bottom: 6px; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 6px; page-break-inside: avoid; }
        .header-left { text-align: left; }
        .header-right { text-align: right; }
        .company { margin-bottom: 1px; font-size: 7pt; font-weight: bold; letter-spacing: 1px; color: #475569; }
        .title { margin: 0; font-size: 9.5pt; font-weight: 800; color: #0f172a; }
        .period { margin: 1px 0 0; color: #475569; font-size: 7pt; }
        .employee-name { margin: 0 0 1px; font-size: 10.5pt; font-weight: 800; text-transform: uppercase; color: #0f172a; }
        .employee-nik { font-size: 7pt; color: #475569; margin-bottom: 1px; }
        .report-number { color: #64748b; font-size: 6.5pt; }
        .summary { display: flex; width: 100%; margin-bottom: 6px; border: 1px solid #cbd5e1; background: #f8fafc; page-break-inside: avoid; }
        .summary-item { flex: 1; padding: 2.5px 4px; border-right: 1px solid #cbd5e1; text-align: center; }
        .summary-item:last-child { border-right: none; }
        .summary-item-highlight { background: #f0fdf4; }
        .summary-item-overtime { background: #fff7ed; }
        .summary-label { display: block; margin-bottom: 1px; color: #64748b; font-size: 6pt; text-transform: uppercase; }
        .summary-value { font-size: 8pt; font-weight: bold; color: #0f172a; }
        .summary-value-work { color: #166534; font-weight: 800; }
        .summary-value-overtime { color: #c2410c; font-weight: 800; }
        .attendance-table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; break-inside: auto; }
        .attendance-table thead { display: table-header-group; }
        .attendance-table tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; break-inside: avoid-page !important; }
        .attendance-table th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 3px 4px; text-align: left; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; page-break-inside: avoid; }
        .attendance-table td { border: 1px solid #cbd5e1; padding: 2px 4px; vertical-align: middle; font-size: 6.5pt; line-height: 1.2; page-break-inside: avoid !important; break-inside: avoid !important; }
        .attendance-table tbody tr:nth-child(even) { background: #f8fafc; }
        .date-column { font-weight: bold; }
        .status-hadir { color: #166534; font-weight: bold; }
        .status-telat { color: #9a3412; font-weight: bold; }
        .status-sakit { color: #1d4ed8; font-weight: bold; }
        .status-izin { color: #7c3aed; font-weight: bold; }
        .status-cuti { color: #0f766e; font-weight: bold; }
        .status-alpha { color: #991b1b; font-weight: bold; }
        .status-lain { color: #374151; font-weight: bold; }
        .tidak-absen { color: #991b1b; font-weight: bold; letter-spacing: .4px; margin-bottom: 2px; }
        .jam { color: #334155; margin-top: 1px; }
        .jam-istirahat { color: #d97706; margin-top: 1px; font-weight: 500; }
        .jam-kerja { color: #475569; margin-top: 1px; }
        .alasan-telat { color: #dc2626; margin-top: 1px; font-size: 6pt; }
        .keterangan { color: #64748b; margin-top: 1px; font-size: 6pt; }
        .lembur-block { border-top: 1px dashed #cbd5e1; margin-top: 3px; padding-top: 2px; }
        .lembur-title { color: #c2410c; font-size: 6.2pt; }
        .lembur-durasi { color: #15803d; font-weight: bold; margin-left: 2px; }
        .lembur-desc { color: #475569; font-size: 6pt; font-style: italic; }
        .lembur-status { color: #64748b; font-size: 5.8pt; }
        .photo-grid { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; page-break-inside: avoid !important; break-inside: avoid !important; }
        .photo-item { display: flex; flex-direction: column; align-items: center; border: 1px solid #cbd5e1; border-radius: 3px; padding: 2px; background: #ffffff; width: 54px; page-break-inside: avoid !important; break-inside: avoid !important; }
        .photo-img { width: 48px; height: 44px; object-fit: cover; border-radius: 2px; }
        .photo-label { font-size: 5.2pt; font-weight: bold; color: #334155; margin-top: 1.5px; text-transform: uppercase; text-align: center; line-height: 1; white-space: nowrap; }
        .no-photo { color: #94a3b8; font-size: 6.5pt; text-align: center; display: block; }
        .print-container { position: fixed; top: 15px; right: 15px; z-index: 9999; }
        .print-button { border: none; padding: 10px 18px; background: #111827; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .print-button:hover { background: #374151; }
        .footer { margin-top: 8px; font-size: 7pt; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 3px; text-align: center; }
        @media screen { ${isPdf ? '' : 'body { padding: 12px; } .report { box-shadow: 0 2px 10px rgba(0, 0, 0, .12); }'} }
        @media print {
            @page { size: A4 landscape; margin: 6mm 10mm 6mm 10mm; }
            body { background: white; padding: 0; margin: 0; font-size: 6.5pt; }
            .print-container, .footer { display: none !important; }
            .report { 
                width: 100% !important; 
                max-width: none !important; 
                min-height: auto !important; 
                margin: 0 0 10mm 0 !important; 
                padding: 2mm 4mm 6mm 4mm !important; 
                box-shadow: none !important; 
                page-break-after: ${pageSplitMode === "split" ? "always !important" : "auto !important"}; 
                page-break-inside: avoid !important; 
                break-inside: avoid !important; 
                border-bottom: ${pageSplitMode === "combine" ? "2px dashed #0f172a !important" : "none !important"}; 
            }
            .report:last-child { 
                border-bottom: none !important; 
                padding-bottom: 2mm !important; 
                margin-bottom: 0 !important; 
            }
            .attendance-table { page-break-inside: auto !important; break-inside: auto !important; }
            .attendance-table thead { display: table-header-group !important; }
            .attendance-table tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; break-inside: avoid-page !important; }
            .attendance-table th { padding: 2px 4px !important; font-size: 6.5pt !important; }
            .attendance-table td { padding: 1.5px 4px !important; font-size: 6pt !important; line-height: 1.15 !important; page-break-inside: avoid !important; break-inside: avoid !important; }
            .photo-grid { page-break-inside: avoid !important; break-inside: avoid !important; }
            .photo-item { width: 48px !important; padding: 1.5px !important; page-break-inside: avoid !important; break-inside: avoid !important; }
            .photo-img { width: 43px !important; height: 40px !important; }
            .photo-label { font-size: 4.8pt !important; }
        }
    </style>
</head>
<body>
    ${!isPdf ? `<div class="print-container"><button class="print-button" onclick="window.print()">Cetak / Simpan PDF</button></div>` : ''}
    <div id="laporan" class="pdf-recap-root">${reportsHtml}</div>
    <div class="footer">Dokumen ini dicetak secara otomatis oleh Sistem Absensi ${escapeHTML(namaPt.toUpperCase())} &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB</div>
    ${!isPdf ? `<script>window.onload = function() { setTimeout(function() { window.print(); }, 600); };</script>` : ''}
</body>
</html>`;
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
        setIsExporting(true);
        setExportProgress("Memuat logo & gambar absensi...");
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
            } catch (_) { }

            const imageCache: Record<string, string> = {};
            const uniquePhotoUrls = new Set<string>();
            processedData.forEach(r => {
                if (r.checkInPhoto) uniquePhotoUrls.add(r.checkInPhoto);
                if (r.breakStartPhoto) uniquePhotoUrls.add(r.breakStartPhoto);
                if (r.breakEndPhoto) uniquePhotoUrls.add(r.breakEndPhoto);
                if (r.checkOutPhoto) uniquePhotoUrls.add(r.checkOutPhoto);
                if ((r as any).lateReasonPhoto) uniquePhotoUrls.add((r as any).lateReasonPhoto);
            });
            (allOvertimes || []).forEach(ot => {
                if (ot.initialProofUrl) uniquePhotoUrls.add(ot.initialProofUrl);
                if (ot.finalProofUrl) uniquePhotoUrls.add(ot.finalProofUrl);
            });

const compressBlobToThumbnailBase64 = (blob: Blob, maxW = 160, maxH = 140, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxW) {
                    height = Math.round((height * maxW) / width);
                    width = maxW;
                }
            } else {
                if (height > maxH) {
                    width = Math.round((width * maxH) / height);
                    height = maxH;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
        };
        img.src = url;
    });
};

            const urlArray = Array.from(uniquePhotoUrls);
            
            // Function to fetch single image as lightweight base64 thumbnail with retries and absolute url fallback
            const fetchSingleImageBase64 = async (rawUrl: string, retries = 2) => {
                if (!rawUrl) return;
                if (rawUrl.startsWith('data:')) {
                    imageCache[rawUrl] = rawUrl;
                    return;
                }

                const resolved = resolveFileUrl(rawUrl);
                if (!resolved) return;

                const fullUrl = resolved.startsWith('http')
                    ? resolved
                    : `${window.location.origin}${resolved.startsWith('/') ? '' : '/'}${resolved}`;

                if (imageCache[rawUrl]) return;

                for (let i = 0; i <= retries; i++) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 6000);
                        const res = await fetch(fullUrl, { signal: controller.signal });
                        clearTimeout(timeoutId);

                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const blob = await res.blob();
                        const b64 = await compressBlobToThumbnailBase64(blob, 160, 140, 0.75);
                        if (b64 && b64.startsWith('data:image')) {
                            imageCache[rawUrl] = b64;
                            imageCache[resolved] = b64;
                            imageCache[fullUrl] = b64;
                            return;
                        }
                    } catch (e) {
                        console.warn(`Preload image attempt ${i + 1} failed for ${fullUrl}:`, e);
                        if (i === retries) {
                            imageCache[rawUrl] = fullUrl;
                            imageCache[resolved] = fullUrl;
                        } else {
                            await new Promise(r => setTimeout(r, 400));
                        }
                    }
                }
            };

            // Download in chunks of 8 parallel requests to avoid overwhelming the server
            const chunkSize = 8;
            for (let i = 0; i < urlArray.length; i += chunkSize) {
                const chunk = urlArray.slice(i, i + chunkSize);
                setExportProgress(`Memuat gambar absensi (${Math.min(i + chunkSize, urlArray.length)}/${urlArray.length})...`);
                await Promise.all(chunk.map(url => fetchSingleImageBase64(url)));
            }

            setExportProgress("Menyusun berkas HTML...");
            const html = buildRecapReportHtml({
                docTitle: fileName,
                periodStr,
                namaPt,
                singkatanPt,
                alamatPt,
                logoDataUrl,
                usersList: users || [],
                processedData,
                startDate,
                endDate,
                imageCache,
                isPdf: false
            });

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

            toast({ title: "✅ Rekap HTML Berhasil Diunduh", description: "Seluruh foto absensi & lembur telah dimuat penuh." });
        } catch (e: any) {
            toast({ title: "Gagal Export HTML", description: e.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
            setExportProgress("");
        }
    };

    const fetchLogoBase64 = async (): Promise<string> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const logoToUse = config?.logoUrl || '/icon-192.png';
            const logoRes = await fetch(logoToUse, { signal: controller.signal });
            clearTimeout(timeoutId);
            const logoBlob = await logoRes.blob();
            return await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(logoBlob);
            });
        } catch (_) {
            return '';
        }
    };

    const compressBlobToThumbnailBase64 = (blob: Blob, maxW = 160, maxH = 140, quality = 0.75): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxW) {
                        height = Math.round((height * maxW) / width);
                        width = maxW;
                    }
                } else {
                    if (height > maxH) {
                        width = Math.round((width * maxH) / height);
                        height = maxH;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, width);
                canvas.height = Math.max(1, height);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(blob);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve('');
            };
            img.src = url;
        });
    };

    const preloadAttendanceImages = async (
        records: Attendance[],
        onProgress?: (loaded: number, total: number) => void
    ): Promise<Record<string, string>> => {
        const imageCache: Record<string, string> = {};
        const uniquePhotoUrls = new Set<string>();
        records.forEach(r => {
            if (r.checkInPhoto) uniquePhotoUrls.add(r.checkInPhoto);
            if (r.breakStartPhoto) uniquePhotoUrls.add(r.breakStartPhoto);
            if (r.breakEndPhoto) uniquePhotoUrls.add(r.breakEndPhoto);
            if (r.checkOutPhoto) uniquePhotoUrls.add(r.checkOutPhoto);
            if ((r as any).lateReasonPhoto) uniquePhotoUrls.add((r as any).lateReasonPhoto);
        });
        (allOvertimes || []).forEach(ot => {
            if (ot.initialProofUrl) uniquePhotoUrls.add(ot.initialProofUrl);
            if (ot.finalProofUrl) uniquePhotoUrls.add(ot.finalProofUrl);
        });

        const urlArray = Array.from(uniquePhotoUrls);

        const fetchSingleImageBase64 = async (rawUrl: string, retries = 2) => {
            if (!rawUrl) return;
            if (rawUrl.startsWith('data:')) {
                imageCache[rawUrl] = rawUrl;
                return;
            }

            const resolved = resolveFileUrl(rawUrl);
            if (!resolved) return;

            const fullUrl = resolved.startsWith('http')
                ? resolved
                : `${window.location.origin}${resolved.startsWith('/') ? '' : '/'}${resolved}`;

            if (imageCache[rawUrl]) return;

            for (let i = 0; i <= retries; i++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);
                    const res = await fetch(fullUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const b64 = await compressBlobToThumbnailBase64(blob, 160, 140, 0.75);
                    if (b64 && b64.startsWith('data:image')) {
                        imageCache[rawUrl] = b64;
                        imageCache[resolved] = b64;
                        imageCache[fullUrl] = b64;
                        return;
                    }
                } catch (e) {
                    console.warn(`Preload image attempt ${i + 1} failed for ${fullUrl}:`, e);
                    if (i === retries) {
                        imageCache[rawUrl] = fullUrl;
                        imageCache[resolved] = fullUrl;
                    } else {
                        await new Promise(r => setTimeout(r, 400));
                    }
                }
            }
        };

        const chunkSize = 8;
        for (let i = 0; i < urlArray.length; i += chunkSize) {
            const chunk = urlArray.slice(i, i + chunkSize);
            if (onProgress) {
                onProgress(Math.min(i + chunkSize, urlArray.length), urlArray.length);
            }
            await Promise.all(chunk.map(url => fetchSingleImageBase64(url)));
        }

        return imageCache;
    };

    const handleExportHtmlRekap = async () => {
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

        const fileName = `LAPORAN REKAP ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr}.html`;
        setIsExporting(true);
        setExportProgress("Memuat logo & gambar absensi...");
        try {
            const logoDataUrl = await fetchLogoBase64();
            const imageCache = await preloadAttendanceImages(processedData, (loaded, total) => {
                setExportProgress(`Memuat gambar absensi (${loaded}/${total})...`);
            });

            setExportProgress("Menyusun dokumen HTML...");
            const html = buildRecapReportHtml({
                docTitle: fileName,
                periodStr,
                namaPt,
                singkatanPt,
                alamatPt,
                logoDataUrl,
                usersList: users || [],
                processedData,
                startDate,
                endDate,
                imageCache,
                isPdf: false,
                pageSplitMode
            });

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

            toast({ title: "✅ HTML Rekap Berhasil Diunduh", description: fileName });
        } catch (e: any) {
            toast({ title: "Gagal Export HTML Rekap", description: e.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
            setExportProgress("");
        }
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

        const pdfFileName = `LAPORAN REKAP ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr}.pdf`;
        setIsExporting(true);
        setExportProgress("Memuat logo & gambar absensi untuk PDF...");
        try {
            const html2pdfLib = await loadHtml2Pdf();
            const logoDataUrl = await fetchLogoBase64();
            const imageCache = await preloadAttendanceImages(processedData, (loaded, total) => {
                setExportProgress(`Memuat gambar absensi (${loaded}/${total})...`);
            });

            setExportProgress("Menyusun dokumen PDF...");
            const html = buildRecapReportHtml({
                docTitle: pdfFileName,
                periodStr,
                namaPt,
                singkatanPt,
                alamatPt,
                logoDataUrl,
                usersList: users || [],
                processedData,
                startDate,
                endDate,
                imageCache,
                isPdf: true,
                pageSplitMode
            });

            const pdfBlob = await renderRecapHtmlToPdfBlob({
                html,
                pdfFileName,
                html2pdfLib,
                splitMode: pageSplitMode
            });

            triggerBlobDownload(pdfBlob, pdfFileName);
            toast({ title: "✅ PDF Berhasil Diunduh", description: pdfFileName });
        } catch (e: any) {
            toast({ title: "Gagal Export PDF", description: e.message, variant: "destructive" });
        } finally {
            setIsExporting(false);
            setExportProgress("");
        }
    };

    const handleBulkExport = async () => {
        const periods = buildCustomBulkPeriods(startDate, endDate);

        if (periods.length === 0) {
            toast({
                title: "Info",
                description: "Rentang tanggal tidak valid. Pastikan tanggal mulai tidak melebihi tanggal akhir.",
            });
            return;
        }

        setIsExporting(true);
        setExportProgress("Menyiapkan engine PDF & ZIP...");

        let html2pdfLib: any;
        let JSZip: any;
        try {
            html2pdfLib = await loadHtml2Pdf();
            JSZip = await loadJsZip();
        } catch (err) {
            toast({
                title: "Error",
                description: "Gagal memuat engine pembuat PDF atau ZIP.",
                variant: "destructive"
            });
            setIsExporting(false);
            setExportProgress("");
            return;
        }

        const periodLabels = periods.map(
            p => `${format(p.start, "d")}-${format(p.end, "d")} ${format(p.end, "MMM", { locale: id }).toUpperCase()}`
        ).join(", ");

        toast({
            title: "Export Rekap Harian Massal Dimulai",
            description: `Memproses ${periods.length} periode (${periodLabels}) menjadi PDF...`,
        });

        try {
            const firstStart = periods[0].start;
            const lastEnd = periods[periods.length - 1].end;

            let sourceAttendance: Attendance[] = allAttendance || [];
            if (isBefore(firstStart, startOfDay(startDate)) || isAfter(endOfDay(lastEnd), endOfDay(endDate))) {
                setExportProgress("Mengambil data absensi lengkap untuk seluruh sub-periode...");
                try {
                    const res = await fetch(
                        `/api/attendance?startDate=${format(firstStart, 'yyyy-MM-dd')}&endDate=${format(lastEnd, 'yyyy-MM-dd')}`
                    );
                    if (res.ok) {
                        sourceAttendance = await res.json();
                    }
                } catch (_) {
                    // Gunakan allAttendance yang sudah ada jika gagal fetch tambahan
                }
            }

            const allRangeRecords = sourceAttendance.filter(att => {
                if (!getUserName(att.userId)) return false;
                const name = (getUserName(att.userId) || '').toLowerCase();
                if (!name.includes(searchName.toLowerCase())) return false;
                const d = startOfDay(new Date(att.date));
                const s = startOfDay(firstStart);
                const e = endOfDay(lastEnd);
                return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
            });

            setExportProgress("Memuat logo & mengompresi foto absensi...");
            const logoDataUrl = await fetchLogoBase64();
            const imageCache = await preloadAttendanceImages(allRangeRecords, (loaded, total) => {
                setExportProgress(`Memuat gambar absensi (${loaded}/${total})...`);
            });

            const zip = new JSZip();

            for (let i = 0; i < periods.length; i++) {
                const { start: pStart, end: pEnd } = periods[i];
                const periodStr = `${format(pStart, "dd MMM yyyy", { locale: id })} - ${format(pEnd, "dd MMM yyyy", { locale: id })}`.toUpperCase();
                const shortRange = `${format(pStart, "d")} - ${format(pEnd, "d")}`;
                const docTitle = `LAPORAN REKAP ABSENSI TENAGA KERJA ${singkatanPt} - ${periodStr}`;
                const pdfFileName = `${docTitle}.pdf`;
                const htmlFileName = `${docTitle}.html`;

                setExportProgress(`Menyusun PDF (${i + 1}/${periods.length}): ${shortRange} (${periodStr})...`);

                const periodRecords = allRangeRecords
                    .filter(row => {
                        const d = startOfDay(new Date(row.date));
                        const s = startOfDay(pStart);
                        const e = endOfDay(pEnd);
                        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
                    })
                    .sort((a, b) => {
                        const nameA = (getUserName(a.userId) || '').toLowerCase();
                        const nameB = (getUserName(b.userId) || '').toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;
                        return new Date(a.date).getTime() - new Date(b.date).getTime();
                    });

                const pdfHtml = buildRecapReportHtml({
                    docTitle,
                    periodStr,
                    namaPt,
                    singkatanPt,
                    alamatPt,
                    logoDataUrl,
                    usersList: users || [],
                    processedData: periodRecords,
                    startDate: pStart,
                    endDate: pEnd,
                    imageCache,
                    isPdf: true,
                    pageSplitMode
                });

                const printableHtml = buildRecapReportHtml({
                    docTitle,
                    periodStr,
                    namaPt,
                    singkatanPt,
                    alamatPt,
                    logoDataUrl,
                    usersList: users || [],
                    processedData: periodRecords,
                    startDate: pStart,
                    endDate: pEnd,
                    imageCache,
                    isPdf: false,
                    pageSplitMode
                });

                try {
                    const pdfBlob = await renderRecapHtmlToPdfBlob({
                        html: pdfHtml,
                        pdfFileName,
                        html2pdfLib,
                        splitMode: pageSplitMode
                    });

                    // Simpan ke dalam bundel ZIP beserta versi HTML siap cetak
                    zip.file(pdfFileName, pdfBlob);
                    zip.file(`HTML_SIAP_CETAK/${htmlFileName}`, printableHtml);
                } catch (e) {
                    console.error("Gagal membuat PDF untuk periode", periodStr, e);
                }

                await new Promise(resolve => setTimeout(resolve, 250));
            }

            setExportProgress("Mengemas seluruh PDF ke dalam 1 file ZIP...");
            const zipContent = await zip.generateAsync({ type: "blob" });
            const startStr = format(firstStart, "yyyyMMdd");
            const endStr = format(lastEnd, "yyyyMMdd");
            const zipFileName = `REKAP_ABSENSI_MASSAL_${startStr}_to_${endStr}.zip`;
            triggerBlobDownload(zipContent, zipFileName);

            toast({
                title: "✅ Export Harian Massal Selesai",
                description: `${periods.length} laporan PDF (${periodLabels}) berhasil dikemas dalam ${zipFileName}.`,
            });
        } catch (err: any) {
            console.error("Gagal melakukan export massal", err);
            toast({
                title: "Error Export Massal",
                description: err?.message || "Terjadi kesalahan saat mengekspor laporan.",
                variant: "destructive"
            });
        } finally {
            setIsExporting(false);
            setExportProgress("");
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

            {/* TAB SELECTOR */}
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 pt-2 rounded-t-xl shadow-sm">
                <button
                    onClick={() => setActiveTab('rekap')}
                    className={`flex items-center gap-2 py-3 px-5 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'rekap'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <Calendar className="h-4 w-4" />
                    Laporan Detail Kehadiran & Sesi
                </button>
                <button
                    onClick={() => setActiveTab('ringkasan')}
                    className={`flex items-center gap-2 py-3 px-5 font-bold text-sm border-b-2 transition-all ${
                        activeTab === 'ringkasan'
                            ? 'border-emerald-600 text-emerald-700 bg-emerald-50/70 rounded-t-lg'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Rekap Ringkasan Bulanan (Excel Format)
                </button>
            </div>

            {/* TAB 1: DETAIL KEHADIRAN */}
            {activeTab === 'rekap' && (
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
                            <Select value={pageSplitMode} onValueChange={(val: any) => setPageSplitMode(val)}>
                                <SelectTrigger className="w-[170px] bg-white h-10 font-medium">
                                    <SelectValue placeholder="Tata Letak Halaman" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="split">Pisah Per Karyawan</SelectItem>
                                    <SelectItem value="combine">Gabung Halaman</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 h-10 font-bold" onClick={() => handleOpenManualModal()}>
                                <Plus className="h-4 w-4" /> Input Manual
                            </Button>
                            {reportType === "custom" && (
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
                            <Button 
                                variant="outline" 
                                className="gap-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 h-10 font-bold shadow-sm" 
                                onClick={handleExportHtmlRekap}
                                disabled={isExporting}
                            >
                                <FileDown className="h-4 w-4" /> {isExporting ? "Mengekspor..." : "Export HTML Rekap"}
                            </Button>
                            <Button 
                                variant="outline" 
                                className="gap-2 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 h-10 font-bold shadow-sm" 
                                onClick={handleExportPdf} 
                                disabled={isExporting}
                            >
                                <FileDown className="h-4 w-4" /> {isExporting ? "Mengekspor..." : "Export PDF Rekap"}
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
                                                    {isSameDayAndUser ? <span className="ml-4 text-gray-300">↳</span> : (
                                                        <div className="flex flex-col gap-1">
                                                            <span>{safeFormatDate(row.date, "EEEE, d MMMM yyyy", { locale: id })}</span>
                                                            {(new Date(row.date).getDay() === 0 || new Date(row.date).getDay() === 6) && (
                                                                <span className="inline-block bg-orange-100 text-orange-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-orange-200 w-fit">
                                                                    ⚡ WEEKEND / LEMBUR
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
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
                                                <td className="px-6 py-4 text-center">
                                                    {row.checkOut ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={`font-mono font-bold ${row.notes && /lupa absen pulang/i.test(row.notes) ? 'text-gray-500' : 'text-rose-600'}`}>
                                                                {safeFormatDate(row.checkOut, "HH:mm")}
                                                            </span>
                                                            {row.notes && /lupa absen pulang/i.test(row.notes) && (
                                                                <span className="text-[8px] font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-1.5 py-0.5 leading-tight">
                                                                    Lupa Absen Pulang
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : row.checkIn ? (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 leading-tight whitespace-normal text-center block">
                                                            Belum Absen Pulang
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!isSameDayAndUser && (
                                                        <div className="font-black text-gray-800">
                                                            {(dailyTotals.get(key)?.mins ?? 0) > 0 ? (
                                                                <>
                                                                    <span>{formatDuration(dailyTotals.get(key)?.mins ?? 0)}</span>
                                                                    {(new Date(row.date).getDay() === 0 || new Date(row.date).getDay() === 6) && (
                                                                        <span className="text-[9px] block text-orange-600 font-semibold">(Dihitung Lembur)</span>
                                                                    )}
                                                                </>
                                                            ) : "-"}
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

                                            {/* Sub-baris Lembur jika ada data lembur yang Disetujui, Berlangsung, atau Selesai */}
                                            {(() => {
                                                const rowDateStr = safeFormatDate(row.date, "yyyy-MM-dd");
                                                const matchedOvertimes = (allOvertimes || []).filter(o => {
                                                    if (!o || o.employeeApproval === "rejected" || o.status === "cancelled") return false;
                                                    if (o.attendanceId === row.id) return true;
                                                    if (o.userId === row.userId) {
                                                        const otDateStr = o.date ? safeFormatDate(o.date, "yyyy-MM-dd") : (o.startTime ? safeFormatDate(o.startTime, "yyyy-MM-dd") : "");
                                                        return otDateStr === rowDateStr;
                                                    }
                                                    return false;
                                                });

                                                if (matchedOvertimes.length === 0) return null;

                                                // Sort descending by id to pick the newest active assignment
                                                matchedOvertimes.sort((a, b) => (b.id || 0) - (a.id || 0));
                                                const ot = matchedOvertimes[0];

                                                const isPendingApproval = ot.employeeApproval === "pending" || (!ot.employeeApproval && ot.status === "pending");
                                                const isOngoing = ot.status === "ongoing";
                                                const isApprovedNotStarted = ot.employeeApproval === "approved" && ot.status !== "completed" && ot.status !== "ongoing";
                                                const hasFinished = ot.status === "completed";

                                                const otStart = ot.startTime ? safeFormatDate(ot.startTime, "HH:mm") : "-";
                                                const otEnd = hasFinished && ot.endTime ? safeFormatDate(ot.endTime, "HH:mm") : (isOngoing ? "Berlangsung" : "-");

                                                const otDurationMins = (hasFinished && ot.startTime && ot.endTime) 
                                                    ? Math.round((new Date(ot.endTime).getTime() - new Date(ot.startTime).getTime()) / 60000)
                                                    : 0;
                                                const otDurationStr = (hasFinished && otDurationMins > 0) ? `${Math.floor(otDurationMins / 60)} Jam` : (isOngoing ? "Sedang Lembur" : "-");

                                                let statusLabel = "MENUNGGU KONFIRMASI";
                                                let statusClass = "bg-yellow-100 text-yellow-800 border-yellow-200 animate-pulse";

                                                if (isOngoing) {
                                                    statusLabel = "SEDANG BERLANGSUNG";
                                                    statusClass = "bg-blue-100 text-blue-800 border-blue-200 animate-pulse";
                                                } else if (isApprovedNotStarted) {
                                                    statusLabel = "DISETUJUI (BELUM MULAI)";
                                                    statusClass = "bg-orange-100 text-orange-800 border-orange-200";
                                                } else if (ot.isAutoCompleted) {
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
                                                    <tr key={`ot-${row.id}`} className="bg-orange-50/60 border-b border-orange-100 hover:bg-orange-50 transition-colors">
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
            )}

            {/* TAB 2: REKAP RINGKASAN BULANAN (EXCEL FORMAT) */}
            {activeTab === 'ringkasan' && (
                <div className="space-y-6">
                    {/* Control Card Ringkasan */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                                    Rekap Ringkasan Bulanan EXCEL
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Laporan ringkasan absensi kerja reguler (Senin–Jumat) &amp; jam lembur sesuai periode bulanan.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Date Range Picker */}
                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-600 px-1">Periode:</span>
                                    <Input
                                        type="date"
                                        className="h-8 text-xs border border-gray-200 bg-white rounded w-36 shadow-none"
                                        value={ringkasanStartDate}
                                        onChange={(e) => setRingkasanStartDate(e.target.value)}
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <Input
                                        type="date"
                                        className="h-8 text-xs border border-gray-200 bg-white rounded w-36 shadow-none"
                                        value={ringkasanEndDate}
                                        onChange={(e) => setRingkasanEndDate(e.target.value)}
                                    />
                                </div>

                                {/* Pilih Karyawan Dropdown */}
                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-600 px-1">Karyawan:</span>
                                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                        <SelectTrigger className="w-[210px] h-8 text-xs bg-white border-gray-200">
                                            <SelectValue placeholder="Pilih Karyawan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua Karyawan</SelectItem>
                                            {(users || [])
                                                .filter(u => !isAdminUser(u) && !isResignedUser(u))
                                                .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'id'))
                                                .map((emp) => (
                                                    <SelectItem key={emp.id} value={String(emp.id)}>
                                                        {emp.fullName} ({emp.nik || emp.username || "-"})
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Export PDF Button */}
                                <Button
                                    onClick={handleExportPdfRingkasan}
                                    disabled={isExportingPdfRingkasan || isExportingExcel}
                                    className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 shadow-sm"
                                >
                                    <FileDown className="h-4 w-4" />
                                    {isExportingPdfRingkasan ? "Mengekspor PDF..." : "Export PDF Rekap"}
                                </Button>

                                {/* Export Excel Button */}
                                <Button
                                    onClick={handleExportExcel}
                                    disabled={isExportingExcel || isExportingPdfRingkasan}
                                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-sm"
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {isExportingExcel ? "Mengekspor Excel..." : "Export ke Excel (.xlsx)"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* KONDISI 1: JIKA SEMUA KARYAWAN DIPILIH */}
                    {selectedEmployeeId === "all" ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Header Banner Judul Rekap */}
                            <div className="bg-primary/5 border-b border-primary/20 px-6 py-4 text-center">
                                <h3 className="text-sm font-black uppercase tracking-wider text-primary">
                                    Rekap absensi tanggal {safeFormatDate(ringkasanStartDate, "d MMMM yyyy")} s/d {safeFormatDate(ringkasanEndDate, "d MMMM yyyy")} {namaPt}
                                </h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse text-left">
                                    <thead>
                                        {/* Header Styled with Application Primary Theme */}
                                        <tr className="bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider">
                                            <th className="border-r border-primary-foreground/20 px-4 py-3.5 text-center w-16">
                                                NO
                                            </th>
                                            <th className="border-r border-primary-foreground/20 px-6 py-3.5 text-center">
                                                NAMA
                                            </th>
                                            <th className="border-r border-primary-foreground/20 px-6 py-3.5 text-center">
                                                DEPT
                                            </th>
                                            <th className="border-r border-primary-foreground/20 px-6 py-3.5 text-center w-48">
                                                Total Hadir<br />Hari Kerja
                                            </th>
                                            <th className="px-6 py-3.5 text-center w-48">
                                                Total Lembur<br />(Jam)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {ringkasanData.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-gray-400 border border-slate-200 italic">
                                                    Belum ada data absensi untuk periode yang dipilih.
                                                </td>
                                            </tr>
                                        ) : (
                                            ringkasanData.map((row: any, i: number) => (
                                                <tr key={row.userId} className="hover:bg-slate-50 transition-colors">
                                                    <td className="border-r border-slate-200 px-4 py-2.5 text-center font-bold text-slate-700 text-xs">
                                                        {i + 1}
                                                    </td>
                                                    <td className="border-r border-slate-200 px-6 py-2.5 text-center font-bold text-slate-900 text-xs tracking-tight uppercase">
                                                        {row.nama}
                                                    </td>
                                                    <td className="border-r border-slate-200 px-6 py-2.5 text-center font-semibold text-slate-700 text-xs uppercase">
                                                        {row.dept}
                                                    </td>
                                                    <td className="border-r border-slate-200 px-6 py-2.5 text-center font-black text-slate-900 text-sm bg-primary/5">
                                                        {row.totalHadirStr}
                                                    </td>
                                                    <td className="px-6 py-2.5 text-center font-black text-amber-700 text-sm bg-amber-50/50">
                                                        {row.totalLemburStr}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* KONDISI 2: JIKA 1 KARYAWAN SPESIFIK DIPILIH */
                        (() => {
                            const selectedEmp = (users || []).find(u => String(u.id) === selectedEmployeeId);
                            const summaryItem = ringkasanData.find((r: any) => String(r.userId) === selectedEmployeeId) || {
                                nama: (selectedEmp?.fullName || '').toUpperCase(),
                                dept: ((selectedEmp as any)?.position || (selectedEmp as any)?.department || '-').toUpperCase(),
                                totalHadirHariKerja: 0,
                                totalHadirStr: "0 Hari",
                                totalLemburHours: 0,
                                totalLemburStr: "0 Jam",
                            };

                            const rs = new Date(ringkasanStartDate);
                            rs.setHours(0, 0, 0, 0);
                            const re = new Date(ringkasanEndDate);
                            re.setHours(23, 59, 59, 999);

                            const isInDateRange = (dateVal: any) => {
                                if (!dateVal) return false;
                                const d = new Date(dateVal);
                                return d >= rs && d <= re;
                            };

                            // Riwayat absensi karyawan terpilih
                            const currentAttSource = ringkasanAttendanceData || allAttendance || [];
                            const empAtt = currentAttSource
                                .filter(a => String(a.userId) === selectedEmployeeId && isInDateRange(a.date))
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                            // Tabel 1: Absensi Biasa (Senin - Jumat)
                            const regularRecords = empAtt.filter(a => {
                                const day = new Date(a.date).getDay();
                                return day >= 1 && day <= 5;
                            });

                            // Tabel 2: Riwayat Lembur
                            // B. Overtime assignments (SPL) dalam rentang tanggal
                            const empOvertimes = (allOvertimes || []).filter(ot => {
                                if (!ot || ot.employeeApproval === 'rejected' || ot.status === 'cancelled') return false;
                                const targetUid = ot.userId || (ot.attendance?.userId);
                                if (String(targetUid) !== selectedEmployeeId) return false;
                                const dtStr = ot.date ? ot.date : (ot.startTime ? ot.startTime : null);
                                return isInDateRange(dtStr);
                            });

                            const otDates = new Set(
                                empOvertimes.map(ot => {
                                    return ot.date ? safeFormatDate(ot.date, 'yyyy-MM-dd') : safeFormatDate(ot.startTime, 'yyyy-MM-dd');
                                }).filter(Boolean)
                            );

                            // A. Weekend attendance: hanya yang ada jam masuk/pulang nyata,
                            // dan abaikan jika tanggal tersebut sudah tercatat di penugasan SPL agar tidak dobel baris
                            const weekendRecords = empAtt.filter(a => {
                                const day = new Date(a.date).getDay();
                                const isWeekend = day === 0 || day === 6;
                                if (!isWeekend) return false;
                                const hasClock = !!(a.checkIn || a.checkOut);
                                if (!hasClock) return false;
                                const dStr = safeFormatDate(a.date, 'yyyy-MM-dd');
                                if (dStr && otDates.has(dStr)) return false;
                                return true;
                            });

                            return (
                                <div className="space-y-6">
                                    {/* 1. KARTU INFORMASI KARYAWAN SESUAI PERMINTAAN */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nama Karyawan</p>
                                                <p className="text-lg font-black text-gray-900 mt-1 uppercase">{selectedEmp?.fullName || "-"}</p>
                                                <p className="text-[11px] font-semibold text-primary font-mono mt-0.5">
                                                    NIK: {selectedEmp?.nik || selectedEmp?.username || "-"} | Divisi: {summaryItem.dept}
                                                </p>
                                            </div>
                                            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                <Users className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hari Kerja (Senin–Jumat)</p>
                                                <p className="text-2xl font-black text-gray-900 mt-1">
                                                    {summaryItem.totalHadirStr}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Senin s/d Jumat Sesuai Shift</p>
                                            </div>
                                            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <Calendar className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Jam Lembur</p>
                                                <p className="text-2xl font-black text-amber-600 mt-1">
                                                    {summaryItem.totalLemburStr}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">Sabtu, Minggu &amp; Penugasan Lembur</p>
                                            </div>
                                            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                                <Clock className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. TABEL REKAP RINGKASAN SATU KARYAWAN (WARNA TEMA APLIKASI) */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <table className="w-full text-sm border-collapse text-left">
                                            <thead>
                                                <tr className="bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider">
                                                    <th className="border-r border-primary-foreground/20 px-6 py-3 text-center">NAMA</th>
                                                    <th className="border-r border-primary-foreground/20 px-6 py-3 text-center">DEPT</th>
                                                    <th className="border-r border-primary-foreground/20 px-6 py-3 text-center w-52">
                                                        Total Hadir Hari Kerja
                                                    </th>
                                                    <th className="px-6 py-3 text-center w-52">
                                                        Total Lembur (Jam)
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="font-bold text-slate-900 bg-white">
                                                    <td className="border-r border-slate-200 px-6 py-3.5 text-center uppercase tracking-tight">
                                                        {summaryItem.nama}
                                                    </td>
                                                    <td className="border-r border-slate-200 px-6 py-3.5 text-center uppercase text-slate-700">
                                                        {summaryItem.dept}
                                                    </td>
                                                    <td className="border-r border-slate-200 px-6 py-3.5 text-center font-black text-base text-primary bg-primary/5">
                                                        {summaryItem.totalHadirStr}
                                                    </td>
                                                    <td className="px-6 py-3.5 text-center font-black text-base text-amber-700 bg-amber-50/50">
                                                        {summaryItem.totalLemburStr}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* 3. TABEL A: RINCIAN ABSENSI BIASA (SENIN - JUMAT) */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
                                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-primary" />
                                                    Daftar Absen Biasa (Hari Kerja Reguler Senin s/d Jumat)
                                                </h3>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Total {regularRecords.length} sesi absensi hari kerja reguler tercatat
                                                </p>
                                            </div>
                                            <span className="text-xs font-black px-2.5 py-1 rounded bg-primary/10 text-primary">
                                                {summaryItem.totalHadirHariKerja} Hari Masuk
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left whitespace-nowrap">
                                                <thead className="bg-primary/5 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3">TANGGAL</th>
                                                        <th className="px-4 py-3">SHIFT</th>
                                                        <th className="px-4 py-3 text-center">MASUK</th>
                                                        <th className="px-4 py-3 text-center">ISTIRAHAT</th>
                                                        <th className="px-4 py-3 text-center">SELESAI</th>
                                                        <th className="px-4 py-3 text-center">PULANG</th>
                                                        <th className="px-4 py-3 text-center">JAM KERJA</th>
                                                        <th className="px-4 py-3 text-center">STATUS</th>
                                                        <th className="px-4 py-3 text-center">BUKTI FOTO ABSEN &amp; TELAT</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {regularRecords.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={9} className="text-center py-6 text-gray-400 italic">
                                                                Tidak ada catatan absensi biasa pada periode ini.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        regularRecords.map((r: any) => {
                                                            const { netWorkMins } = calculateDailyTotal([r]);
                                                            return (
                                                                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-4 py-3 font-bold text-slate-800">
                                                                        {safeFormatDate(r.date, "EEEE, d MMM yyyy", { locale: id })}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-semibold text-primary">
                                                                        {r.shift && r.shift !== '-' ? r.shift : "Reguler"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-mono font-bold text-emerald-600">
                                                                        {r.checkIn ? safeFormatDate(r.checkIn, "HH:mm") : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-mono text-amber-600">
                                                                        {r.breakStart ? safeFormatDate(r.breakStart, "HH:mm") : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-mono text-blue-600">
                                                                        {r.breakEnd ? safeFormatDate(r.breakEnd, "HH:mm") : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-mono font-bold text-rose-600">
                                                                        {r.checkOut ? safeFormatDate(r.checkOut, "HH:mm") : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center font-bold text-slate-800">
                                                                        {netWorkMins > 0 ? formatDuration(netWorkMins) : "-"}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                                            r.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                                                                            r.status === 'late' ? 'bg-amber-100 text-amber-800' :
                                                                            r.status === 'sick' ? 'bg-blue-100 text-blue-800' :
                                                                            r.status === 'permission' ? 'bg-purple-100 text-purple-800' :
                                                                            'bg-gray-100 text-gray-700'
                                                                        }`}>
                                                                            {r.status === 'present' ? 'Hadir' : r.status === 'late' ? 'Telat' : r.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            {r.checkInPhoto && (
                                                                                <button onClick={() => setSelectedPhotoRecord(r)} title="Foto Masuk" className="relative group">
                                                                                    <img src={resolveFileUrl(r.checkInPhoto)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    <span className="text-[8px] block font-bold text-gray-400">Masuk</span>
                                                                                </button>
                                                                            )}
                                                                            {r.breakStartPhoto && (
                                                                                <button onClick={() => setSelectedPhotoRecord(r)} title="Foto Istirahat" className="relative group">
                                                                                    <img src={resolveFileUrl(r.breakStartPhoto)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    <span className="text-[8px] block font-bold text-gray-400">Ist</span>
                                                                                </button>
                                                                            )}
                                                                            {r.checkOutPhoto && (
                                                                                <button onClick={() => setSelectedPhotoRecord(r)} title="Foto Pulang" className="relative group">
                                                                                    <img src={resolveFileUrl(r.checkOutPhoto)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    <span className="text-[8px] block font-bold text-gray-400">Pulang</span>
                                                                                </button>
                                                                            )}
                                                                            {r.lateReasonPhoto && (
                                                                                <button onClick={() => setSelectedPhotoRecord(r)} title="Bukti Telat" className="relative group">
                                                                                    <img src={resolveFileUrl(r.lateReasonPhoto)} className="w-8 h-8 rounded border border-rose-300 object-cover hover:scale-110 transition-transform" />
                                                                                    <span className="text-[8px] block font-bold text-rose-600">Telat</span>
                                                                                </button>
                                                                            )}
                                                                            {!r.checkInPhoto && !r.checkOutPhoto && !r.lateReasonPhoto && (
                                                                                <span className="text-gray-300 text-xs">-</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* 4. TABEL B: RINCIAN LEMBUR (WEEKEND & HARI KERJA) */}
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
                                        <div className="bg-amber-50/60 border-b border-amber-200 px-6 py-3.5 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-black text-amber-950 text-sm flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-amber-600" />
                                                    Daftar Lembur (Akhir Pekan &amp; Penugasan Lembur)
                                                </h3>
                                                <p className="text-[11px] text-amber-800/80 mt-0.5">
                                                    Mencakup kehadiran Sabtu &amp; Minggu (otomatis dihitung jam lembur) serta penugasan lembur hari kerja
                                                </p>
                                            </div>
                                            <span className="text-xs font-black px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                                Total {summaryItem.totalLemburHours} Jam Lembur
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left whitespace-nowrap">
                                                <thead className="bg-amber-50 text-amber-900 font-bold uppercase tracking-wider text-[10px] border-b border-amber-200">
                                                    <tr>
                                                        <th className="px-4 py-3">TANGGAL</th>
                                                        <th className="px-4 py-3">KATEGORI LEMBUR</th>
                                                        <th className="px-4 py-3 text-center">MULAI</th>
                                                        <th className="px-4 py-3 text-center">SELESAI</th>
                                                        <th className="px-4 py-3 text-center">DURASI</th>
                                                        <th className="px-4 py-3">KETERANGAN / TUGAS</th>
                                                        <th className="px-4 py-3 text-center">STATUS</th>
                                                        <th className="px-4 py-3 text-center">BUKTI FOTO LEMBUR</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {weekendRecords.length === 0 && empOvertimes.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={8} className="text-center py-6 text-gray-400 italic">
                                                                Tidak ada catatan lembur pada periode ini.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <>
                                                            {/* Baris Lembur dari Kehadiran Weekend (Sabtu/Minggu) */}
                                                            {weekendRecords.map((w: any) => {
                                                                const { netWorkMins } = calculateDailyTotal([w]);
                                                                const grossWeekendHours = Math.floor(netWorkMins / 60);
                                                                const netWeekendHours = Math.max(0, grossWeekendHours - 1);

                                                                return (
                                                                    <tr key={`weekend-${w.id}`} className="bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
                                                                        <td className="px-4 py-3 font-bold text-slate-800">
                                                                            {safeFormatDate(w.date, "EEEE, d MMM yyyy", { locale: id })}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-300">
                                                                                ⚡ Weekend (Sabtu/Minggu)
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-700">
                                                                            {w.checkIn ? safeFormatDate(w.checkIn, "HH:mm") : "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-700">
                                                                            {w.checkOut ? safeFormatDate(w.checkOut, "HH:mm") : "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-black text-amber-900">
                                                                            {netWorkMins > 0 ? `${netWeekendHours} Jam` : "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-600 italic">
                                                                            {w.notes || "Absensi kerja akhir pekan"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded">
                                                                                Selesai
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                {w.checkInPhoto && (
                                                                                    <button onClick={() => setSelectedPhotoRecord(w)} title="Foto Masuk Weekend">
                                                                                        <img src={resolveFileUrl(w.checkInPhoto)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    </button>
                                                                                )}
                                                                                {w.checkOutPhoto && (
                                                                                    <button onClick={() => setSelectedPhotoRecord(w)} title="Foto Pulang Weekend">
                                                                                        <img src={resolveFileUrl(w.checkOutPhoto)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    </button>
                                                                                )}
                                                                                {!w.checkInPhoto && !w.checkOutPhoto && (
                                                                                    <span className="text-gray-300">-</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}

                                                            {/* Baris Lembur dari Penugasan Lembur (Overtime Record) */}
                                                            {empOvertimes.map((ot: any) => {
                                                                const otDate = ot.date ? new Date(ot.date) : (ot.startTime ? new Date(ot.startTime) : null);
                                                                const isWeekendOt = otDate ? (otDate.getDay() === 0 || otDate.getDay() === 6) : false;
                                                                const otHours = normalizeOvertimeDuration(ot.startTime, ot.endTime, isWeekendOt);
                                                                const otDateStr = ot.date ? safeFormatDate(ot.date, "yyyy-MM-dd") : (ot.startTime ? safeFormatDate(ot.startTime, "yyyy-MM-dd") : "");
                                                                const matchingAtt = empAtt.find(a => safeFormatDate(a.date, 'yyyy-MM-dd') === otDateStr);
                                                                const photo1 = ot.initialProofUrl || matchingAtt?.checkInPhoto;
                                                                const photo2 = ot.finalProofUrl || matchingAtt?.checkOutPhoto;

                                                                return (
                                                                    <tr key={`ot-${ot.id}`} className="hover:bg-amber-50/30 transition-colors">
                                                                        <td className="px-4 py-3 font-bold text-slate-800">
                                                                            {ot.date ? safeFormatDate(ot.date, "EEEE, d MMM yyyy", { locale: id }) : (ot.startTime ? safeFormatDate(ot.startTime, "EEEE, d MMM yyyy", { locale: id }) : "-")}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <span className="bg-orange-100 text-orange-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-orange-200">
                                                                                Penugasan Lembur (SPL)
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-mono font-bold text-orange-700">
                                                                            {ot.startTime ? safeFormatDate(ot.startTime, "HH:mm") : "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-mono font-bold text-orange-700">
                                                                            {ot.endTime ? safeFormatDate(ot.endTime, "HH:mm") : (ot.status === 'ongoing' ? 'Berlangsung' : '-')}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center font-black text-orange-900">
                                                                            {otHours > 0 ? `${otHours} Jam` : "-"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-slate-600 italic">
                                                                            {ot.description || ot.finalDescription || "Pekerjaan lembur"}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                                                                ot.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                                                ot.status === 'ongoing' ? 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse' :
                                                                                'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                                            }`}>
                                                                                {ot.status === 'completed' ? 'Selesai' : ot.status === 'ongoing' ? 'Berlangsung' : 'Disetujui'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                {photo1 && (
                                                                                    <a href={resolveFileUrl(photo1)} target="_blank" rel="noopener noreferrer" title="Bukti Awal / Masuk Lembur">
                                                                                        <img src={resolveFileUrl(photo1)} className="w-8 h-8 rounded border object-cover hover:scale-110 transition-transform" />
                                                                                    </a>
                                                                                )}
                                                                                {photo2 && (
                                                                                    <a href={resolveFileUrl(photo2)} target="_blank" rel="noopener noreferrer" title="Bukti Selesai / Pulang Lembur">
                                                                                        <img src={resolveFileUrl(photo2)} className="w-8 h-8 rounded border border-emerald-300 object-cover hover:scale-110 transition-transform" />
                                                                                    </a>
                                                                                )}
                                                                                {!photo1 && !photo2 && (
                                                                                    <span className="text-gray-300">-</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
            )}
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
