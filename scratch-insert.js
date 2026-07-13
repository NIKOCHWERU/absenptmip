const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const functionCode = `
async function autoCloseExpiredSessions(userId: number) {
  try {
    const activeSessions = await db
      .select({
         attendance: attendance,
         shift: shifts
      })
      .from(attendance)
      .leftJoin(shifts, eq(attendance.shiftId, shifts.id))
      .where(and(
        eq(attendance.userId, userId),
        isNotNull(attendance.checkIn),
        isNull(attendance.checkOut)
      ));

    if (activeSessions.length === 0) return;

    const now = new Date();

    for (const row of activeSessions) {
      const session = row.attendance;
      const shift = row.shift;
      
      const checkOutTimeStr = shift?.checkOutTime || "17:00";
      const [hh, mm] = checkOutTimeStr.split(":").map(Number);
      
      let year, month, dateNum;
      if (typeof session.date === 'string') {
        const parts = session.date.split("-");
        year = Number(parts[0]);
        month = Number(parts[1]) - 1;
        dateNum = Number(parts[2]);
      } else {
        year = session.date.getFullYear();
        month = session.date.getMonth();
        dateNum = session.date.getDate();
      }

      const checkOutDate = new Date(year, month, dateNum, hh, mm, 0, 0);

      const checkInTimeStr = shift?.checkInTime || "08:00";
      const [inHh] = checkInTimeStr.split(":").map(Number);
      if (hh < inHh) {
         checkOutDate.setDate(checkOutDate.getDate() + 1);
      }

      // Deadline is + 1 hr
      const deadlineDate = new Date(checkOutDate.getTime() + 60 * 60 * 1000);

      if (now > deadlineDate) {
        const newNotes = session.notes ? \`\${session.notes} (Otomatis absen pulang oleh sistem)\` : "(Otomatis absen pulang oleh sistem)";
        await db.update(attendance)
          .set({
            checkOut: checkOutDate, 
            notes: newNotes,
          })
          .where(eq(attendance.id, session.id));
      }
    }
  } catch (e) {
    console.error("Auto close expired sessions error:", e);
  }
}
`;

// Insert after function getAdminDate
file = file.replace('export function getAdminDate(): string {', functionCode + '\nexport function getAdminDate(): string {');

// Inject into endpoints
// clock-in
file = file.replace('app.post("/api/attendance/clock-in", isAuthenticated, upload.fields([{ name: "photo", maxCount: 1 }, { name: "lateReasonPhoto", maxCount: 1 }]), async (req: Request, res: Response) => {', 
  'app.post("/api/attendance/clock-in", isAuthenticated, upload.fields([{ name: "photo", maxCount: 1 }, { name: "lateReasonPhoto", maxCount: 1 }]), async (req: Request, res: Response) => {\n    await autoCloseExpiredSessions((req.user as any).id);');

// clock-out
file = file.replace('app.post("/api/attendance/clock-out", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {',
  'app.post("/api/attendance/clock-out", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {\n    await autoCloseExpiredSessions((req.user as any).id);');

// today
file = file.replace('app.get("/api/attendance/today", isAuthenticated, async (req: Request, res: Response) => {',
  'app.get("/api/attendance/today", isAuthenticated, async (req: Request, res: Response) => {\n    await autoCloseExpiredSessions((req.user as any).id);');

// history
file = file.replace('app.get("/api/attendance/history", isAuthenticated, async (req: Request, res: Response) => {',
  'app.get("/api/attendance/history", isAuthenticated, async (req: Request, res: Response) => {\n    await autoCloseExpiredSessions((req.user as any).id);');

fs.writeFileSync('server/routes.ts', file);
