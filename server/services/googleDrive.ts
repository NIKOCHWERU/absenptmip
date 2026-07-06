import { google } from 'googleapis';
import { Stream } from 'stream';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

export const isDriveConfigured = !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && ROOT_FOLDER_ID);

if (!isDriveConfigured) {
    console.warn("⚠️  Google Drive credentials not fully configured. Using local file storage fallback.");
} else {
    console.log("✅ Google Drive credentials detected. Drive upload enabled.");
}

const oauth2Client = isDriveConfigured
    ? new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URL || "http://localhost:5000/auth/google/callback"
      )
    : null;

if (oauth2Client && REFRESH_TOKEN) {
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            console.log('🔄 Google OAuth2: New refresh token received and active.');
        }
        console.log('🔑 Google OAuth2: Access token refreshed automatically.');
    });
}

const drive = oauth2Client ? google.drive({ version: 'v3', auth: oauth2Client }) : null;

// Cache subfolder IDs to avoid repeated lookups
const subfolderCache: Record<string, string> = {};

// Get or create a subfolder inside ROOT_FOLDER_ID
async function getOrCreateSubfolder(folderName: 'Absensi' | 'Dokumen' | 'Pengaduan'): Promise<string> {
    if (subfolderCache[folderName]) return subfolderCache[folderName];
    if (!drive || !ROOT_FOLDER_ID) throw new Error("Drive not configured");

    // Search for existing subfolder
    const res = await drive.files.list({
        q: `'${ROOT_FOLDER_ID}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1,
    });

    if (res.data.files && res.data.files.length > 0) {
        const folderId = res.data.files[0].id!;
        subfolderCache[folderName] = folderId;
        return folderId;
    }

    // Create the subfolder
    const created = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [ROOT_FOLDER_ID],
        },
        fields: 'id',
    });

    const folderId = created.data.id!;
    console.log(`📁 Google Drive: Created subfolder "${folderName}" (${folderId})`);
    subfolderCache[folderName] = folderId;
    return folderId;
}

// Ensure access token is valid before uploading
async function ensureValidToken(): Promise<void> {
    if (!oauth2Client) return;
    try {
        const tokenInfo = await oauth2Client.getAccessToken();
        if (!tokenInfo.token) {
            throw new Error("Failed to get access token");
        }
    } catch (error: any) {
        console.error("❌ Google OAuth2 token error:", error.message);
        throw new Error("Google Drive authentication failed. The refresh token may be expired.");
    }
}

// Build readable filename based on action type
export function buildDriveFilename(
    fullName: string,
    actionType: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut' | 'lateReason' | 'complaint' | 'document' | 'profile',
    docLabel?: string // e.g. "KTP", "NPWP", "BPJS", "Profil"
): string {
    const cleanName = fullName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const now = new Date();
    // Jakarta time (UTC+7)
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const date = wib.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = wib.toISOString().split('T')[1].substring(0, 8).replace(/:/g, '-'); // HH-MM-SS

    const actionMap: Record<string, string> = {
        clockIn: 'AbsenMasuk',
        breakStart: 'MulaiIstirahat',
        breakEnd: 'SelesaiIstirahat',
        clockOut: 'AbsenPulang',
        lateReason: 'AlasanTerlambat',
        complaint: 'Pengaduan',
        document: docLabel ? `Dokumen_${docLabel}` : 'Dokumen',
        profile: 'FotoProfil',
    };

    const action = actionMap[actionType] || actionType;
    return `${cleanName}_${date}_${action}_${timeStr}.jpg`;
}

export type DriveFolder = 'Absensi' | 'Dokumen' | 'Pengaduan';

export async function uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: DriveFolder = 'Dokumen'
): Promise<{ fileId: string; viewUrl: string }> {
    if (!isDriveConfigured || !drive) {
        throw new Error("Google Drive is not configured");
    }

    await ensureValidToken();

    const folderId = await getOrCreateSubfolder(folder);

    const bufferStream = new Stream.PassThrough();
    bufferStream.end(fileBuffer);

    try {
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId],
                mimeType: mimeType,
            },
            media: {
                mimeType: mimeType,
                body: bufferStream,
            },
            fields: 'id, webViewLink',
        });

        // Make file public
        await drive.permissions.create({
            fileId: response.data.id!,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        console.log(`✅ Google Drive [${folder}]: ${fileName}`);

        return {
            fileId: response.data.id!,
            viewUrl: response.data.webViewLink || ""
        };
    } catch (error: any) {
        const statusCode = error?.response?.status;
        const errorMsg = error?.response?.data?.error || error?.message || "Unknown error";

        if (statusCode === 401) {
            console.error("❌ Google Drive: 401 Unauthorized — refresh token may be expired.");
        } else {
            console.error(`❌ Google Drive Upload Error [${statusCode}]:`, errorMsg);
        }

        throw new Error("Failed to upload file to Google Drive");
    }
}

export async function listFiles(): Promise<{ id: string; name: string; webViewLink?: string }[]> {
    if (!isDriveConfigured || !drive) {
        throw new Error("Google Drive is not configured");
    }
    await ensureValidToken();
    try {
        const response = await drive.files.list({
            q: `'${ROOT_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, webViewLink)',
            pageSize: 1000
        });
        return (response.data.files || []) as any;
    } catch (error: any) {
        console.error("❌ Google Drive List Error:", error.message);
        throw new Error("Failed to list files from Google Drive");
    }
}
