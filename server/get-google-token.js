import http from 'http';
import readline from 'readline';
import { google } from 'googleapis';
import dotenv from 'dotenv';

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

function extractCode(input) {
    if (!input) return null;
    let cleanStr = input.trim();
    if (cleanStr.includes('code=')) {
        try {
            const urlObj = new URL(cleanStr.startsWith('http') ? cleanStr : `http://localhost:3333${cleanStr}`);
            const codeParam = urlObj.searchParams.get('code');
            if (codeParam) return codeParam;
        } catch (_) {
            const match = cleanStr.match(/code=([^&]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
    }
    return cleanStr;
}

async function processCode(rawCode) {
    const code = extractCode(rawCode);
    if (!code) {
        console.error('❌ Kode otorisasi tidak valid.');
        return false;
    }
    try {
        console.log('\n⏳ Menukar kode otorisasi dengan token Google Drive...');
        const { tokens } = await oauth2Client.getToken(code);
        console.log('\n==================================================');
        console.log('✅ BERHASIL! Salin baris di bawah ini ke file .env Anda:');
        console.log('==================================================\n');
        console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n==================================================\n');
        return true;
    } catch (err) {
        console.error('❌ Gagal mendapatkan token:', err.message);
        return false;
    }
}

const inputArg = process.argv[2];
if (inputArg) {
    processCode(inputArg).then(() => process.exit(0));
} else {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });

    console.log('\n==================================================');
    console.log('🌐 Buka URL ini di browser Anda untuk otorisasi:');
    console.log('==================================================\n');
    console.log(authUrl);
    console.log('\n==================================================');
    console.log('📌 Salin URL dari address bar browser setelah me-redirect (atau kode-nya), lalu tempel di bawah:');
    console.log('==================================================\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Masukkan Kode / URL Redirect di sini: ', async (answer) => {
        rl.close();
        await processCode(answer);
        process.exit(0);
    });

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://localhost:3333`);
        const code = url.searchParams.get('code');
        if (code) {
            res.end('<h2>✅ Otorisasi berhasil! Periksa terminal VPS Anda.</h2>');
            await processCode(code);
            setTimeout(() => process.exit(0), 1000);
        } else {
            res.end('<h2>❌ Tidak ada kode.</h2>');
        }
    });

    server.listen(3333, () => {}).on('error', () => {});
}
