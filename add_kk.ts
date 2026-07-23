import { pool } from "./server/db.js";

async function addKKColumns() {
  try {
    console.log("Adding kk_number column...");
    await pool.query("ALTER TABLE users ADD COLUMN kk_number varchar(50)");
    console.log("kk_number column added successfully.");
  } catch (err: any) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("kk_number column already exists, skipping.");
    } else {
      console.error("Error adding kk_number:", err.message);
    }
  }

  try {
    console.log("Adding kk_photo_url column...");
    await pool.query("ALTER TABLE users ADD COLUMN kk_photo_url varchar(512)");
    console.log("kk_photo_url column added successfully.");
  } catch (err: any) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("kk_photo_url column already exists, skipping.");
    } else {
      console.error("Error adding kk_photo_url:", err.message);
    }
  }

  console.log("Database update complete!");
  process.exit(0);
}

addKKColumns();
