import { db } from "./server/db.js";
import { users } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Menghapus semua data karyawan...");
  await db.delete(users).where(eq(users.role, "employee"));
  console.log("Semua data karyawan berhasil dihapus.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Terjadi kesalahan:", err);
  process.exit(1);
});
