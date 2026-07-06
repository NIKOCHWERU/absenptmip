/**
 * Script helper untuk generate Google OAuth2 Refresh Token secara otomatis.
 * Cara pakai:
 *   PORT=3008 node server/get-google-token.js
 */

import http from 'http';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: GOOGLE_DRIVE_CLIENT_ID dan GOOGLE_DRIVE_CLIENT_SECRET harus diisi di .env terlebih dahulu!');
    process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Memaksa Google mengeluarkan refresh_token
});

console.log('\n🌐 Buka URL ini di browser Anda untuk otorisasi:\n');
console.log(authUrl);
console.log('\n⏳ Menunggu respon callback dari Google di port 3333...\n');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3333`);
    const code = url.searchParams.get('code');

    if (!code) {
        res.end('<h2>❌ Otorisasi gagal. Silakan coba kembali.</h2>');
        return;
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n==================================================');
        console.log('✅ BERHASIL! Salin baris di bawah ini ke file .env Anda:');
        console.log('==================================================\n');
        console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n==================================================\n');

        res.end(`
      <html><body style="font-family:sans-serif;padding:40px;line-height:1.6;">
        <h2 style="color: #2e7d32;">✅ Google Drive Refresh Token Berhasil Dibuat!</h2>
        <p>Salin baris berikut dan masukkan ke file <code>.env</code> di VPS Anda:</p>
        <pre style="background:#f5f5f5;padding:15px;border-radius:8px;word-break:break-all;font-size:16px;border:1px solid #ddd;">GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}</pre>
        <p>Setelah selesai, Anda bisa menutup tab browser ini.</p>
      </body></html>
    `);

        setTimeout(() => {
            server.close();
            console.log('👋 Server ditutup. Proses selesai!');
            process.exit(0);
        }, 2000);
    } catch (err) {
        console.error('❌ Gagal mendapatkan token:', err.message);
        res.end('<h2>❌ Error: ' + err.message + '</h2>');
    }
});

server.listen(3333, () => {
    console.log('🚀 Local callback server running on http://localhost:3333');
});
