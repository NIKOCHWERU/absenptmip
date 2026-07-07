import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subMonths, addMonths, subWeeks, addWeeks } from "date-fns";
import { id } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle, Coffee, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";
import type { Attendance } from "@shared/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AttendanceCalendarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  attendanceData: Attendance[];
  onDateSelect?: (date: Date, record?: Attendance) => void;
  viewMode: 'month' | 'week';
  setViewMode: (mode: 'month' | 'week') => void;
  weekDate: Date;
}

export function AttendanceCalendar({
  currentDate,
  onPrevMonth,
  onNextMonth,
  attendanceData,
  onDateSelect,
  viewMode,
  setViewMode,
  weekDate
}: AttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Month Logic: 1st to last day of current month
  const currentPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const currentPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Week Logic
  const weekStart = startOfWeek(viewMode === 'week' ? weekDate : currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(viewMode === 'week' ? weekDate : currentDate, { weekStartsOn: 1 });

  const days = viewMode === 'month'
    ? eachDayOfInterval({ start: currentPeriodStart, end: currentPeriodEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePrev = () => {
    onPrevMonth(); // Parent handles logic based on viewMode
  };

  const handleNext = () => {
    onNextMonth(); // Parent handles logic based on viewMode
  };

  // Helper to find status for a day
  const getDayStatus = (day: Date) => {
    return attendanceData.find(a => isSameDay(new Date(a.date), day));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'late': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'sick': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'permission': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'absent': return 'bg-red-100 text-red-600 border-red-200';
      default: return 'bg-gray-50 text-gray-400 border-transparent';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'present': return 'Hadir';
      case 'late': return 'Telat';
      case 'sick': return 'Sakit';
      case 'permission': return 'Izin';
      case 'absent': return 'Alpa';
      case 'cuti': return 'Cuti';
      default: return status || '-';
    }
  };

  const handleDateClick = (day: Date, record?: Attendance) => {
    setSelectedDate(day);
    if (onDateSelect) {
      onDateSelect(day, record);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-50">
        {/* Navigation */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-full p-1 border border-gray-100">
          <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8 rounded-full hover:bg-gray-200">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Button>
          <div className="px-2 font-black text-gray-700 min-w-[120px] text-center text-xs uppercase tracking-wider">
            {viewMode === 'month'
              ? format(currentDate, "MMMM yyyy", { locale: id })
              : `${format(weekStart, "dd MMM", { locale: id })} - ${format(weekEnd, "dd MMM yyyy", { locale: id })}`
            }
          </div>
          <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8 rounded-full hover:bg-gray-200">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Button>
        </div>

        {/* View Toggle */}
        <div className="flex bg-primary/5 p-1 rounded-full border border-primary/10">
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5
                    ${viewMode === 'month' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:text-primary-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Bulanan
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5
                    ${viewMode === 'week' ? 'bg-primary text-white shadow-sm' : 'text-primary hover:text-primary-foreground'}`}
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Minggu
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-7 gap-px bg-slate-100`}>
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
          <div key={d} className="bg-gray-50 py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {d}
          </div>
        ))}

        {/* Padding for start of month - only in Month view */}
        {viewMode === 'month' && Array.from({ length: (currentPeriodStart.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-white min-h-[56px]" />
        ))}

        {days.map((day) => {
          const record = getDayStatus(day);
          const hasRecord = !!record;
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          const getDotColor = (status?: string) => {
            switch (status) {
              case 'present': return 'bg-emerald-500';
              case 'late': return 'bg-amber-500';
              case 'sick': return 'bg-blue-500';
              case 'permission': return 'bg-purple-500';
              case 'cuti': return 'bg-teal-500';
              case 'absent': return 'bg-red-500';
              default: return 'bg-gray-400';
            }
          };

          return (
            <div
              key={day.toISOString()}
              onClick={() => handleDateClick(day, record)}
              className={`
                  relative min-h-[56px] py-1.5 flex flex-col items-center justify-center cursor-pointer transition-all group bg-white
                  ${isToday && viewMode === 'month' ? 'ring-1 ring-inset ring-primary bg-primary/5' : ''}
                  ${isSelected ? 'bg-primary/5 ring-2 ring-inset ring-primary z-10' : ''}
                  hover:bg-slate-50
                `}
            >
              <span className={`
                text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all
                ${isToday ? 'bg-primary text-white shadow-md' : 'text-gray-700 group-hover:bg-gray-100'}
                ${isSelected && !isToday ? 'bg-primary/10 text-primary' : ''}
              `}>
                {format(day, 'd')}
              </span>

              {hasRecord ? (
                <div className="flex gap-1 mt-1 justify-center">
                  <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(record.status ?? undefined)}`} />
                </div>
              ) : (
                <div className="h-1.5 mt-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
