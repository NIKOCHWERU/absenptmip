import { db } from "./db.js";
import { attendance, shifts } from "../shared/schema.js";
import { eq, isNull, and, sql } from "drizzle-orm";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Jalankan pengecekan setiap 5 menit
const CHECK_INTERVAL = 5 * 60 * 1000;

export function startAutoCheckoutScheduler() {
  console.log("Starting Auto-Checkout Scheduler...");
  
  setInterval(async () => {
    try {
      const now = new Date();
      // Only process if time is past midnight? We should check all active sessions.
      
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

        // Parse checkOutTime string (e.g. "17:00")
        const [outHourStr, outMinStr] = row.shift.checkOutTime.split(":");
        const outHour = parseInt(outHourStr);
        const outMin = parseInt(outMinStr);
        
        // Buat objek waktu checkout yang mengikat ke WIB (+07:00) untuk menghindari offset timezone VPS
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

        // Tambah 10 menit setelah jam pulang shift
        const autoCheckoutTimeLimit = new Date(shiftEnd.getTime() + 10 * 60 * 1000);

        // Jika waktu sekarang melebihi limit +10 menit setelah jam pulang, lakukan auto-checkout
        if (now >= autoCheckoutTimeLimit) {
          // Waktu checkout dicatat maksimal 10 menit setelah jam pulang shift
          const checkoutRecordedTime = new Date(shiftEnd.getTime() + 10 * 60 * 1000);
          
          const newNotes = row.att.notes 
            ? row.att.notes + "\n(Otomatis absen pulang oleh sistem)"
            : "(Otomatis absen pulang oleh sistem)";

          await db.update(attendance)
            .set({
              checkOut: checkoutRecordedTime,
              notes: newNotes
            })
            .where(eq(attendance.id, row.att.id));
            
          console.log(`Auto-checkout applied for attendance ID ${row.att.id} (User: ${row.att.userId})`);
        }
      }
    } catch (err) {
      console.error("Auto-checkout error:", err);
    }
  }, CHECK_INTERVAL);
}
