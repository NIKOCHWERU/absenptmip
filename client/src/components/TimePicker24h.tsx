import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePicker24hProps {
  value: string; // Format "HH:mm" (e.g. "22:02" or "17:00")
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function TimePicker24h({ value, onChange, className, placeholder = "22:02" }: TimePicker24hProps) {
  const [open, setOpen] = useState(false);

  // Parse current value
  const parts = (value || "17:00").split(":");
  const selectedHour = (parts[0] || "17").padStart(2, "0");
  const selectedMinute = (parts[1] || "00").padStart(2, "0");

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Auto scroll to selected hour and minute when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const hElem = hourRef.current?.querySelector(`[data-hour="${selectedHour}"]`);
        if (hElem) hElem.scrollIntoView({ block: "center", behavior: "smooth" });

        const mElem = minuteRef.current?.querySelector(`[data-minute="${selectedMinute}"]`);
        if (mElem) mElem.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
    }
  }, [open, selectedHour, selectedMinute]);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  const handleSelectHour = (h: string) => {
    onChange(`${h}:${selectedMinute}`);
  };

  const handleSelectMinute = (m: string) => {
    onChange(`${selectedHour}:${m}`);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 4) val = val.substring(0, 4);
    let h = val.substring(0, 2);
    let m = val.substring(2, 4);
    if (h.length === 2 && parseInt(h) > 23) h = "23";
    if (m.length === 2 && parseInt(m) > 59) m = "59";
    let formatted = h;
    if (val.length >= 2) formatted += (val.length > 2 || e.target.value.includes(":")) ? ":" + m : "";
    onChange(formatted);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 border rounded-xl bg-white hover:bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-mono font-bold text-gray-800 shadow-sm w-full h-10 cursor-pointer",
            className
          )}
        >
          <span className="text-xs font-mono font-bold tracking-wider">
            {value || placeholder} <span className="text-[10px] text-gray-400 font-sans font-normal ml-0.5">WIB</span>
          </span>
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-3 rounded-2xl shadow-xl border border-gray-100 bg-white" align="start">
        {/* Header Display */}
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-gray-700">Pilih Waktu (24 Jam)</span>
          </div>
          <span className="text-xs font-mono font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
            {selectedHour}:{selectedMinute}
          </span>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-2 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">
          <div>Jam (00-23)</div>
          <div>Menit (00-59)</div>
        </div>

        {/* 2 Columns: Hours (00-23) & Minutes (00-59) */}
        <div className="grid grid-cols-2 gap-2 h-48 border border-gray-100 rounded-xl p-1 bg-gray-50/50 overflow-hidden">
          {/* Hours Column */}
          <div ref={hourRef} className="overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {hours.map((h) => {
              const isSelected = h === selectedHour;
              return (
                <button
                  key={h}
                  type="button"
                  data-hour={h}
                  onClick={() => handleSelectHour(h)}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center block",
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm scale-95"
                      : "text-gray-700 hover:bg-white hover:text-blue-600"
                  )}
                >
                  {h}
                </button>
              );
            })}
          </div>

          {/* Minutes Column */}
          <div ref={minuteRef} className="overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {minutes.map((m) => {
              const isSelected = m === selectedMinute;
              return (
                <button
                  key={m}
                  type="button"
                  data-minute={m}
                  onClick={() => handleSelectMinute(m)}
                  className={cn(
                    "w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all text-center block",
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm scale-95"
                      : "text-gray-700 hover:bg-white hover:text-blue-600"
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Manual Input & Confirm Button */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
          <input
            type="text"
            placeholder="22:02"
            maxLength={5}
            value={value}
            onChange={handleDirectInput}
            className="w-20 h-9 rounded-xl border border-gray-200 text-center text-xs font-mono font-bold focus:border-blue-600 focus:outline-none bg-gray-50"
            title="Ketik langsung (contoh 22:02)"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1 shadow-sm"
          >
            <Check className="w-3.5 h-3.5" /> Selesai
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
