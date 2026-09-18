/**
 * Script untuk generate Google Drive Refresh Token baru
 *
 * Cara pakai:
 * 1. Jalankan: node scripts/generate-gdrive-token.mjs
 *    (CLIENT_ID & CLIENT_SECRET dibaca otomatis dari .env)
 * 2. Buka URL yang muncul di browser, login akun Google
 * 3. Paste kode yang didapat, tekan Enter
 * 4. Copy GOOGLE_DRIVE_REFRESH_TOKEN yang tampil → update .env di VPS
 */

import { google } from "googleapis";
import readline from "readline";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manual (tanpa package dotenv)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
} catch {}

const CLIENT_ID     = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ GOOGLE_DRIVE_CLIENT_ID atau GOOGLE_DRIVE_CLIENT_SECRET tidak ditemukan di .env");
  process.exit(1);
}

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive"],
  prompt: "consent",
});

console.log("\n========================================");
console.log("  Google Drive Refresh Token Generator");
console.log("========================================\n");
console.log("Buka URL berikut di browser:\n");
console.log("  " + authUrl);
console.log("\nLogin akun Google → salin KODE yang tampil\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste kode di sini lalu Enter: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log("\n✅ BERHASIL!\n");
    console.log("Salin baris berikut ke file .env di VPS:\n");
    console.log("GOOGLE_DRIVE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\nLalu restart: pm2 restart absensi-ptmip\n");
    if (!tokens.refresh_token) {
      console.warn("⚠️  refresh_token kosong — cabut akses dulu di:");
      console.warn("   https://myaccount.google.com/permissions\n");
      console.warn("   lalu jalankan script ini lagi.\n");
    }
  } catch (err) {
    console.error("\n❌ Gagal:", err.message, "\n");
  }
});
