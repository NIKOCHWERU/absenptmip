import { db, pool } from "./server/db.js";
import { eq, inArray } from "drizzle-orm";
import { attendance } from "./shared/schema.js";

async function fixDuplicates() {
  console.log("Fetching all attendance records...");
  const records = await db.select().from(attendance);
  console.log(`Found ${records.length} records.`);
  
  const groups = new Map<string, typeof records>();
  
  for (const record of records) {
    if (!record.checkIn) continue;
    
    let dateStr = "";
    if (record.date instanceof Date) {
      dateStr = record.date.toISOString().split('T')[0];
    } else {
      dateStr = String(record.date).split('T')[0];
    }
    
    const checkInDate = new Date(record.checkIn);
    const hh = checkInDate.getHours().toString().padStart(2, '0');
    const mm = checkInDate.getMinutes().toString().padStart(2, '0');
    
    // Group by User, Date, and Check-In time (down to the minute)
    const key = `${record.userId}-${dateStr}-${hh}:${mm}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(record);
  }
  
  const idsToDelete: number[] = [];
  
  for (const [key, group] of groups.entries()) {
    if (group.length > 1) {
      console.log(`Found ${group.length} duplicates for key ${key}`);
      
      // Sort so we keep the one that has break data, or the first one created
      group.sort((a, b) => {
        const aHasBreak = a.breakStart ? 1 : 0;
        const bHasBreak = b.breakStart ? 1 : 0;
        if (aHasBreak !== bHasBreak) return bHasBreak - aHasBreak; 
        
        // If both have or don't have break, keep the one with a checkout if there is one
        const aHasOut = a.checkOut ? 1 : 0;
        const bHasOut = b.checkOut ? 1 : 0;
        if (aHasOut !== bHasOut) return bHasOut - aHasOut;

        return a.id - b.id; // else keep lowest id
      });
      
      // keep group[0], delete the rest
      for (let i = 1; i < group.length; i++) {
        console.log(`  Deleting duplicate record ID: ${group[i].id}`);
        idsToDelete.push(group[i].id);
      }
    }
  }
  
  if (idsToDelete.length > 0) {
    console.log(`Deleting ${idsToDelete.length} duplicate records...`);
    await db.delete(attendance).where(inArray(attendance.id, idsToDelete));
    console.log("Deleted successfully.");
  } else {
    console.log("No duplicates found.");
  }
  
  pool.end();
  process.exit(0);
}

fixDuplicates().catch((err) => {
  console.error(err);
  process.exit(1);
});
