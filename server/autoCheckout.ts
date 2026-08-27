import { db } from "./db.js";
import { attendance, shifts, overtimes } from "../shared/schema.js";
import { eq, isNull, and, sql } from "drizzle-orm";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Jalankan pengecekan setiap 1 menit agar tepat waktu pada +10 menit setelah shift
const CHECK_INTERVAL = 1 * 60 * 1000;

export function startAutoCheckoutScheduler() {
  console.log("Starting Auto-Checkout Scheduler (Frequency: 1 min, Limit: Shift End + 10 mins)...");
  
  setInterval(async () => {
    try {
      const now = new Date();
      
      // Ambil absensi yang belum checkout dan memiliki shift
      const activeSessions = await db.select({
        att: attendance,
        shift: shifts,
      }).from(attendance)
        .leftJoin(shifts, eq(attendance.shiftId, shifts.id))
        .where(
          and(
            isNull(attendance.checkOut),
            sql`${attendance.shiftId} IS NOT NULL`
          )
        );

      for (const row of activeSessions) {
        if (!row.shift || !row.shift.checkOutTime) continue;

        const checkInTime = row.att.checkIn ? new Date(row.att.checkIn) : null;
        if (!checkInTime) continue;

        // Parse checkOutTime string (misal: "17:00")
        const [outHourStr, outMinStr] = row.shift.checkOutTime.split(":");
        const outHour = parseInt(outHourStr);
        const outMin = parseInt(outMinStr);
        
        // Buat objek waktu checkout shift dalam WIB (+07:00)
        const year = checkInTime.getFullYear();
        const month = checkInTime.getMonth();
        const dateNum = checkInTime.getDate();
        const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}T${String(outHour).padStart(2, '0')}:${String(outMin).padStart(2, '0')}:00+07:00`;
        const shiftEnd = new Date(isoString);

        // Jika shift malam (pulang pagi hari berikutnya)
        const [inHourStr] = row.shift.checkInTime.split(":");
        if (parseInt(inHourStr) > outHour) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }

        // Tepat 10 menit setelah jam pulang shift (misal: Shift 17.00 -> 17.10)
        const autoCheckoutTimeLimit = new Date(shiftEnd.getTime() + 10 * 60 * 1000);

        // Jika waktu sekarang sudah mencapai atau melebihi limit +10 menit setelah jam pulang shift
        if (now >= autoCheckoutTimeLimit) {
          // Pengecekan: Jika karyawan memiliki agenda lembur aktif hari ini, jangan auto checkout shift reguler
          const activeOt = await db.select()
            .from(overtimes)
            .where(
              and(
                eq(overtimes.attendanceId, row.att.id),
                sql`${overtimes.status} != 'cancelled'`
              )
            );

          if (activeOt.length > 0) {
            // Karyawan sedang lembur, abaikan auto-checkout shift reguler
            continue;
          }

          // Waktu checkout otomatis dicatat tepat 10 menit setelah jam pulang shift (misal: 17:10 WIB)
          const checkoutRecordedTime = new Date(shiftEnd.getTime() + 10 * 60 * 1000);
          
          // Hitung waktu tepat WIB (+07:00) independen dari timezone OS server
          const wibMs = checkoutRecordedTime.getTime() + (7 * 60 * 60 * 1000);
          const wibDate = new Date(wibMs);
          const wibHours = String(wibDate.getUTCHours()).padStart(2, '0');
          const wibMins = String(wibDate.getUTCMinutes()).padStart(2, '0');
          const timeLabel = `${wibHours}:${wibMins}`;
          
          const newNotes = row.att.notes 
            ? row.att.notes + `\n(Otomatis absen pulang oleh sistem pada jam ${timeLabel})`
            : `(Otomatis absen pulang oleh sistem pada jam ${timeLabel})`;

          await db.update(attendance)
            .set({
              checkOut: checkoutRecordedTime,
              notes: newNotes
            })
            .where(eq(attendance.id, row.att.id));
            
          console.log(`Auto-checkout applied for attendance ID ${row.att.id} (User: ${row.att.userId}) at ${timeLabel}`);
        }
      }
    } catch (err) {
      console.error("Auto-checkout error:", err);
    }
  }, CHECK_INTERVAL);
}
