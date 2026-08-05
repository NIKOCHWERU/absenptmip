import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import webpush from "web-push";
import { db, pool } from "./db.js";
import { users, shifts, attendance, leaveRequests, complaints, complaintPhotos, resignations, mutations, warningLetters, systemConfigs, activityLogs, announcements, pushSubscriptions, overtimes } from "../shared/schema.js";
import { eq, and, or, gte, lte, desc, sql, isNotNull, isNull, inArray } from "drizzle-orm";

import { isAuthenticated, isAdmin, isSuperAdmin, hashPassword } from "./auth.js";

// Configure web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@absensikaryawan.com',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn("VAPID keys are missing. Web Push will not work.");
}

// Setup storage folder
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const cacheDir = path.resolve(uploadDir, "gdrive-cache");
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

import { uploadFile, isDriveConfigured, buildDriveFilename, DriveFolder, downloadFileStream } from "./services/googleDrive.js";

async function processSingleUpload(
  file: Express.Multer.File | undefined,
  actionType: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut' | 'lateReason' | 'complaint' | 'document' | 'profile' | 'overtimeSPL' | 'overtimeInitial' | 'overtimeFinal',
  fullName: string,
  docLabel?: string, // e.g. 'KTP', 'NPWP', 'BPJS', 'Profil'
  base64Data?: string | null
): Promise<string | null> {
  let fileBuffer: Buffer;
  let mimeType: string;
  let filename: string;
  let localPath: string;
  let tempFilePath: string | null = null;

  if (file) {
    fileBuffer = fs.readFileSync(file.path);
    mimeType = file.mimetype;
    filename = file.filename;
    localPath = `/api/images/${filename}`;
    tempFilePath = file.path;
  } else if (base64Data && base64Data.startsWith('data:image')) {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      fileBuffer = Buffer.from(matches[2], 'base64');
      const ext = mimeType.split('/')[1] || 'jpg';
      filename = `attendance-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      localPath = `/api/images/${filename}`;
      // Save locally first
      const fullLocalPath = path.join(uploadDir, filename);
      fs.writeFileSync(fullLocalPath, fileBuffer);
    } else {
      return null;
    }
  } else {
    return null;
  }

  let targetFolder: DriveFolder = 'Absensi';
  if (actionType === 'document' || actionType === 'profile') {
    targetFolder = 'Dokumen';
  } else if (actionType === 'complaint') {
    targetFolder = 'Pengaduan';
  } else if (actionType === 'overtimeSPL' || actionType === 'overtimeInitial' || actionType === 'overtimeFinal') {
    targetFolder = 'Lembur';
  }
  const driveFolder: DriveFolder = targetFolder;

  if (isDriveConfigured) {
    try {
      const driveFilename = buildDriveFilename(fullName, actionType, docLabel);
      const result = await uploadFile(fileBuffer, driveFilename, mimeType, driveFolder);
      // Clean up local temp file after successful Drive upload
      if (tempFilePath) {
        try { fs.unlinkSync(tempFilePath); } catch (_) { /* ignore */ }
      } else {
        try { fs.unlinkSync(path.join(uploadDir, filename)); } catch (_) { /* ignore */ }
      }
      // Return only the Drive file ID (raw) — client will resolve it
      return result.fileId;
    } catch (err: any) {
      console.error("GDrive upload failed, using local storage:", err.message);
      return localPath;
    }
  }
  return localPath;
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

async function autoCloseExpiredSessions(userId: number) {
  // Pulang Otomatis dinonaktifkan total (Karyawan wajib absen pulang secara manual)
  return;
}

export function getAdminDate(): string {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const hours = jakartaTime.getHours();
  const minutes = jakartaTime.getMinutes();
  // Reset sesi harian setelah jam 04.30 Pagi WIB
  if (hours < 4 || (hours === 4 && minutes < 30)) {
    jakartaTime.setDate(jakartaTime.getDate() - 1);
  }
  const y = jakartaTime.getFullYear();
  const m = String(jakartaTime.getMonth() + 1).padStart(2, '0');
  const d = String(jakartaTime.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function registerRoutes(app: Express) {
  
  // Dynamic Manifest serving for PWA
  app.get("/manifest.json", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const dbConfigs = await db.select().from(systemConfigs);
      const configMap = new Map(dbConfigs.map(c => [c.key, c.value]));
      
      const name = configMap.get("namaPt") || process.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI";
      const shortName = configMap.get("singkatanPt") || process.env.VITE_SINGKATAN_PT || "PT MIP";
      const description = configMap.get("deskripsiPwa") || "Sistem Absensi Karyawan Digital";
      const logo = configMap.get("logoUrl") || "/icon-192.png";

      res.json({
        name: `Absensi ${shortName}`,
        short_name: `Absensi ${shortName}`,
        description,
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: logo,
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: logo,
            sizes: "512x512",
            type: "image/png"
          }
        ]
      });
    } catch (e) {
      res.json({
        name: process.env.VITE_NAMA_PT || "PT MEKANO INDUSTRIAL PRESISI",
        short_name: process.env.VITE_SINGKATAN_PT || "PT MIP",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      });
    }
  });
  
  // Image retrieval and proxy (with CORS headers)
  app.get("/api/images/:id", (req: Request, res: Response) => {
    const filename = req.params.id as string;
    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(uploadDir, safeFilename);

    if (fs.existsSync(filePath)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "image/jpeg");
      return res.sendFile(filePath);
    }
    
    // Check inside cache folder too
    const cachePath = path.join(cacheDir, safeFilename);
    if (fs.existsSync(cachePath)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "image/jpeg");
      return res.sendFile(cachePath);
    }

    return res.status(404).json({ message: "Gambar tidak ditemukan" });
  });

  // Serves images without extension suffix in the URL (Bypasses Nginx static caching/hijacking rules)
  app.get("/api/images-static/:id", (req: Request, res: Response) => {
    const safeId = path.basename(req.params.id);
    try {
      const files = fs.readdirSync(uploadDir);
      const matchingFile = files.find(f => f.startsWith(safeId));

      if (matchingFile) {
        const filePath = path.join(uploadDir, matchingFile);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        
        const ext = path.extname(matchingFile).toLowerCase();
        if (ext === ".png") res.setHeader("Content-Type", "image/png");
        else if (ext === ".gif") res.setHeader("Content-Type", "image/gif");
        else if (ext === ".webp") res.setHeader("Content-Type", "image/webp");
        else res.setHeader("Content-Type", "image/jpeg");

        return res.sendFile(filePath);
      }
    } catch (err) {
      // ignore
    }
    return res.status(404).json({ message: "Gambar tidak ditemukan" });
  });

  // Client Upload endpoint for direct AJAX/fetch
  app.post("/api/upload-direct", upload.single("photo"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    }
    const type = (req.query.type as any) || "document";
    const user = req.user ? ((req.user as any).fullName || (req.user as any).username) : "guest";
    const url = await processSingleUpload(req.file, type, user);
    res.json({ url, filename: req.file.filename });
  });

  // Dedicated local-only upload endpoint for Company Logo (bypasses Google Drive)
  app.post("/api/admin/upload-logo", isAuthenticated, isSuperAdmin, upload.single("logo"), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file logo yang diunggah" });
    }
    const ext = path.extname(req.file.filename);
    const idWithoutExt = path.basename(req.file.filename, ext);
    res.json({ url: `/api/images-static/${idWithoutExt}`, filename: req.file.filename });
  });

  // Google Drive proxy thumbnail endpoint
  app.get("/api/gdrive-img/:id", async (req: Request, res: Response) => {
    const fileId = req.params.id;
    if (!fileId || fileId.includes("/") || fileId.includes("\\")) {
      return res.status(400).json({ message: "ID File tidak valid" });
    }

    const safeFileId = path.basename(fileId);
    const cachePath = path.join(cacheDir, `${safeFileId}.jpg`);

    // 1. If local cache exists, serve it immediately
    if (fs.existsSync(cachePath)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", "image/jpeg");
      return res.sendFile(cachePath);
    }

    // 2. Fetch from Google Drive API using authenticated client if configured
    if (isDriveConfigured) {
      try {
        const stream = await downloadFileStream(safeFileId);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Content-Type", "image/jpeg"); // Assume jpeg for simplicity
        
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          fs.writeFile(cachePath, buffer, (err) => {
            if (err) console.error("Cache write error:", err);
          });
          res.send(buffer);
        });
        stream.on('error', (err: any) => {
          console.error("GDrive stream error:", err);
          res.status(500).json({ message: "Gagal memproses gambar Drive" });
        });
      } catch (err: any) {
        console.error("GDrive download error:", err.message);
        res.status(404).json({ message: "Gambar tidak ditemukan di Drive" });
      }
      return;
    }

    // 3. Fallback to public thumbnail API if not configured
    const driveUrl = `https://drive.google.com/thumbnail?id=${safeFileId}&sz=w800`;

    import("https").then((https) => {
      const handleRequest = (url: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          return res.status(500).json({ message: "Terlalu banyak redirect" });
        }

        const mod = https;
        mod.get(url, (proxyRes) => {
          // Follow redirects
          if ((proxyRes.statusCode === 301 || proxyRes.statusCode === 302) && proxyRes.headers.location) {
            return handleRequest(proxyRes.headers.location, redirectCount + 1);
          }

          if (proxyRes.statusCode !== 200) {
             return res.status(proxyRes.statusCode || 404).json({ message: "Gambar tidak ditemukan di Drive" });
          }

          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Content-Type", proxyRes.headers["content-type"] || "image/jpeg");

          const chunks: any[] = [];
          proxyRes.on("data", (chunk) => {
            chunks.push(chunk);
          });

          proxyRes.on("end", () => {
            const buffer = Buffer.concat(chunks);
            fs.writeFile(cachePath, buffer, (err) => {
              if (err) console.error("Cache write error:", err);
            });
            res.send(buffer);
          });
        }).on("error", (err) => {
          console.error("GDrive proxy error:", err);
          return res.status(500).json({ message: "Gagal memproses gambar Drive" });
        });
      };

      handleRequest(driveUrl);
    });
  });

  // Dynamic application configuration endpoint
  app.get("/api/config", async (req: Request, res: Response) => {
    try {
      const dbConfigs = await db.select().from(systemConfigs);
      const configMap: Record<string, string> = {};
      dbConfigs.forEach(cfg => {
        configMap[cfg.key] = cfg.value;
      });

      res.json({
        namaPt: configMap["namaPt"] ?? process.env.VITE_NAMA_PT ?? "PT ABCD",
        singkatanPt: configMap["singkatanPt"] ?? process.env.VITE_SINGKATAN_PT ?? "PT ABC",
        deskripsiPwa: configMap["deskripsiPwa"] ?? process.env.VITE_DESKRIPSI_PWA ?? "Aplikasi Absensi Tenaga Kerja",
        alamatPt: configMap["alamatPt"] ?? "",
        logoUrl: configMap["logoUrl"] ?? process.env.VITE_LOGO_FILE ?? "/logo_elok_buah.jpg",
        logoInisial: configMap["logoInisial"] ?? process.env.VITE_LOGO_INISIAL ?? "",
        rekapPrefix: configMap["rekapPrefix"] ?? process.env.VITE_REKAP_FILE_PREFIX ?? "REKAP_ABSENSI",
        themePrimary: configMap["themePrimary"] ?? process.env.VITE_THEME_PRIMARY_HSL ?? "24 95% 53%",
        themeSecondary: configMap["themeSecondary"] ?? process.env.VITE_THEME_SECONDARY_HSL ?? "24 95% 43%",
        themeAccent: configMap["themeAccent"] ?? process.env.VITE_THEME_ACCENT_HSL ?? "24 95% 93%",
        themeBackground: configMap["themeBackground"] ?? process.env.VITE_THEME_BACKGROUND_HSL ?? "0 0% 100%",
        themeSidebarAccent: configMap["themeSidebarAccent"] ?? process.env.VITE_THEME_SIDEBAR_ACCENT_HSL ?? "24 95% 97%",
        features: {
          leave: (configMap["feature_leave"] ?? process.env.FEATURE_LEAVE) !== "false",
          recap: (configMap["feature_recap"] ?? process.env.FEATURE_RECAP) !== "false",
          complaint: (configMap["feature_complaint"] ?? process.env.FEATURE_COMPLAINT) !== "false",
          info: (configMap["feature_info"] ?? process.env.FEATURE_INFO) !== "false",
          mutation: (configMap["feature_mutation"] ?? process.env.FEATURE_MUTATION) !== "false",
          warningLetter: (configMap["feature_warningLetter"] ?? process.env.FEATURE_WARNING_LETTER) !== "false",
          shift: (configMap["feature_shift"] ?? process.env.FEATURE_SHIFT) !== "false",
          resignation: (configMap["feature_resignation"] ?? process.env.FEATURE_RESIGNATION) !== "false",
          break: (configMap["feature_break"] ?? process.env.FEATURE_BREAK) !== "false",
        },
        isDriveConfigured
      });
    } catch (err) {
      console.error("Failed to load config:", err);
      res.json({
        namaPt: process.env.VITE_NAMA_PT || "PT ABCD",
        singkatanPt: process.env.VITE_SINGKATAN_PT || "PT ABC",
        deskripsiPwa: process.env.VITE_DESKRIPSI_PWA || "Aplikasi Absensi Tenaga Kerja",
        alamatPt: process.env.VITE_ALAMAT_PT || "",
        logoUrl: process.env.VITE_LOGO_FILE || "/logo_elok_buah.jpg",
        logoInisial: process.env.VITE_LOGO_INISIAL || "",
        rekapPrefix: process.env.VITE_REKAP_FILE_PREFIX || "REKAP_ABSENSI",
        features: {
          leave: process.env.FEATURE_LEAVE !== "false",
          recap: process.env.FEATURE_RECAP !== "false",
          complaint: process.env.FEATURE_COMPLAINT !== "false",
          info: process.env.FEATURE_INFO !== "false",
          mutation: process.env.FEATURE_MUTATION !== "false",
          warningLetter: process.env.FEATURE_WARNING_LETTER !== "false",
          shift: process.env.FEATURE_SHIFT !== "false",
          resignation: process.env.FEATURE_RESIGNATION !== "false",
          break: process.env.FEATURE_BREAK !== "false",
        },
        isDriveConfigured
      });
    }
  });

  // Admin endpoint to save configuration
  app.post("/api/admin/config", isAuthenticated, isSuperAdmin, async (req: Request, res: Response) => {
    try {
      const {
        namaPt, singkatanPt, deskripsiPwa, alamatPt, logoUrl, logoInisial, rekapPrefix,
        themePrimary, themeSecondary, themeAccent, themeBackground, themeSidebarAccent,
        features
      } = req.body;

      const configsToSave: { key: string; value: string }[] = [];
      if (namaPt !== undefined) configsToSave.push({ key: "namaPt", value: String(namaPt) });
      if (singkatanPt !== undefined) configsToSave.push({ key: "singkatanPt", value: String(singkatanPt) });
      if (deskripsiPwa !== undefined) configsToSave.push({ key: "deskripsiPwa", value: String(deskripsiPwa) });
      if (alamatPt !== undefined) configsToSave.push({ key: "alamatPt", value: String(alamatPt) });
      if (logoUrl !== undefined) configsToSave.push({ key: "logoUrl", value: String(logoUrl) });
      if (logoInisial !== undefined) configsToSave.push({ key: "logoInisial", value: String(logoInisial) });
      if (rekapPrefix !== undefined) configsToSave.push({ key: "rekapPrefix", value: String(rekapPrefix) });
      if (themePrimary !== undefined) configsToSave.push({ key: "themePrimary", value: String(themePrimary) });
      if (themeSecondary !== undefined) configsToSave.push({ key: "themeSecondary", value: String(themeSecondary) });
      if (themeAccent !== undefined) configsToSave.push({ key: "themeAccent", value: String(themeAccent) });
      if (themeBackground !== undefined) configsToSave.push({ key: "themeBackground", value: String(themeBackground) });
      if (themeSidebarAccent !== undefined) configsToSave.push({ key: "themeSidebarAccent", value: String(themeSidebarAccent) });

      if (features && typeof features === "object") {
        Object.entries(features).forEach(([key, value]) => {
          configsToSave.push({ key: `feature_${key}`, value: value ? "true" : "false" });
        });
      }

      const conn = await pool.getConnection();
      try {
        for (const cfg of configsToSave) {
          await conn.query(
            "INSERT INTO system_configs (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [cfg.key, cfg.value]
          );
        }
        // Log to Activity Logs
        await db.insert(activityLogs).values({
          userId: (req.user as any).id,
          action: "MENGUBAH_SISTEM_KONFIG",
          details: "Memperbarui konfigurasi sistem/tema warna perusahaan",
        });
      } finally {
        conn.release();
      }

      res.json({ message: "Konfigurasi sistem berhasil diperbarui" });
    } catch (err: any) {
      console.error("Failed to save config:", err);
      res.status(500).json({ message: "Gagal memperbarui konfigurasi: " + err.message });
    }
  });

  // 1. Complete Employee Registration
  app.post(
    "/api/register",
    upload.fields([
      { name: "ktpPhoto", maxCount: 1 },
      { name: "bpjsPhoto", maxCount: 1 },
      { name: "npwpPhoto", maxCount: 1 },
      { name: "photo", maxCount: 1 },
      { name: "kkPhoto", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const {
        username, // The NIK is passed as username for login purposes
        password,
        fullName,
        nik,
        email,
        phoneNumber,
        birthPlace,
        birthDate,
        gender,
        religion,
        address,
        npwp,
        bpjs,
        bankAccount,
        branch,
        position,
        employmentStatus,
        joinDate,
        kkNumber,
      } = req.body;

      if (!username || !password || !fullName || !nik) {
        return res.status(400).json({ message: "Data utama tidak lengkap" });
      }

      try {
        const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (existingUser) {
          return res.status(400).json({ message: "Username/NIK sudah terdaftar" });
        }

        const hashedPassword = await hashPassword(password);
        
        const insertData: any = {
          username,
          nik,
          password: hashedPassword,
          fullName,
          email,
          phoneNumber,
          birthPlace,
          birthDate: birthDate || null,
          gender,
          religion,
          address,
          npwp,
          bpjs,
          bankAccount,
          branch,
          position,
          employmentStatus,
          joinDate,
          kkNumber,
          role: "employee",
          registrationStatus: "pending", // Directly to pending because they complete it upfront
        };

        insertData.ktpPhotoUrl = files?.ktpPhoto?.[0] ? await processSingleUpload(files.ktpPhoto[0], "document", fullName, "KTP") : null;
        insertData.bpjsPhotoUrl = files?.bpjsPhoto?.[0] ? await processSingleUpload(files.bpjsPhoto[0], "document", fullName, "BPJS") : null;
        insertData.npwpPhotoUrl = files?.npwpPhoto?.[0] ? await processSingleUpload(files.npwpPhoto[0], "document", fullName, "NPWP") : null;
        insertData.photoUrl = files?.photo?.[0] ? await processSingleUpload(files.photo[0], "profile", fullName, "Profil") : null;
        insertData.kkPhotoUrl = files?.kkPhoto?.[0] ? await processSingleUpload(files.kkPhoto[0], "document", fullName, "KK") : null;

        await (db.insert(users) as any).values(insertData);

        res.status(201).json({ message: "Registrasi berhasil, akun sedang dievaluasi HRD." });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 2. Submit Registration Data for already-logged-in employees (incomplete status)
  app.post(
    "/api/register-data",
    isAuthenticated,
    upload.fields([
      { name: "ktpPhoto", maxCount: 1 },
      { name: "profilePhoto", maxCount: 1 },
      { name: "bpjsPhoto", maxCount: 1 },
      { name: "npwpPhoto", maxCount: 1 },
      { name: "kkPhoto", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any).id;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const username = (req.user as any).username || String(userId);

        const {
          fullName,
          nik,
          email,
          phoneNumber,
          birthPlace,
          birthDate,
          gender,
          religion,
          address,
          npwp,
          bpjs,
          branch,
          position,
          employmentStatus,
          joinDate,
          kkNumber,
        } = req.body;

        // Normalise birthDate to yyyy-MM-dd (strip ISO timestamp if present)
        let normBirthDate: string | null = null;
        if (birthDate) {
          const raw = String(birthDate);
          if (raw.includes("T")) {
            normBirthDate = raw.split("T")[0];
          } else {
            normBirthDate = raw;
          }
        }

        const updates: any = {
          registrationStatus: "pending",
        };

        if (fullName) updates.fullName = fullName;
        if (nik) updates.nik = nik;
        if (email) updates.email = email;
        if (phoneNumber) updates.phoneNumber = phoneNumber;
        if (birthPlace) updates.birthPlace = birthPlace;
        if (normBirthDate) updates.birthDate = normBirthDate;
        if (gender) updates.gender = gender;
        if (religion) updates.religion = religion;
        if (address) updates.address = address;
        if (npwp) updates.npwp = npwp;
        if (bpjs) updates.bpjs = bpjs;
        if (branch) updates.branch = branch;
        if (position) updates.position = position;
        if (employmentStatus) updates.employmentStatus = employmentStatus;
        if (joinDate) updates.joinDate = joinDate;
        if (kkNumber) updates.kkNumber = kkNumber;

        const uploadName = fullName || (req.user as any).fullName || (req.user as any).username;

        // Upload documents
        if (files?.ktpPhoto?.[0]) {
          updates.ktpPhotoUrl = await processSingleUpload(files.ktpPhoto[0], "document", uploadName, "KTP");
        }
        if (files?.profilePhoto?.[0]) {
          updates.photoUrl = await processSingleUpload(files.profilePhoto[0], "profile", uploadName, "Profil");
        }
        if (files?.bpjsPhoto?.[0]) {
          updates.bpjsPhotoUrl = await processSingleUpload(files.bpjsPhoto[0], "document", uploadName, "BPJS");
        }
        if (files?.npwpPhoto?.[0]) {
          updates.npwpPhotoUrl = await processSingleUpload(files.npwpPhoto[0], "document", uploadName, "NPWP");
        }
        if (files?.kkPhoto?.[0]) {
          updates.kkPhotoUrl = await processSingleUpload(files.kkPhoto[0], "document", uploadName, "KK");
        }

        await db.update(users).set(updates).where(eq(users.id, userId));

        res.json({ message: "Data pendaftaran berhasil dikirim, menunggu verifikasi admin." });
      } catch (err: any) {
        console.error("register-data error:", err);
        res.status(500).json({ message: err.message || "Terjadi kesalahan saat menyimpan data." });
      }
    }
  );

  app.patch("/api/profile", isAuthenticated, upload.none(), async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { phoneNumber, email, branch, npwp, bpjs, religion, photoUrl, npwpPhotoUrl, bpjsPhotoUrl } = req.body;

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      const updates: any = {};
      const logDetails: string[] = [];

      if (phoneNumber !== undefined && phoneNumber !== currentUser.phoneNumber) {
        updates.phoneNumber = phoneNumber;
        logDetails.push(`No. HP: dari "${currentUser.phoneNumber || 'Belum Diisi'}" menjadi "${phoneNumber}"`);
      }
      if (email !== undefined && email !== currentUser.email) {
        updates.email = email;
        logDetails.push(`Email: dari "${currentUser.email || 'Belum Diisi'}" menjadi "${email}"`);
      }
      if (branch !== undefined && branch !== currentUser.branch) {
        updates.branch = branch;
        logDetails.push(`Cabang: dari "${currentUser.branch || 'Belum Diisi'}" menjadi "${branch}"`);
      }
      if (npwp !== undefined && npwp !== currentUser.npwp) {
        updates.npwp = npwp;
        logDetails.push(`NPWP: dari "${currentUser.npwp || 'Belum Diisi'}" menjadi "${npwp}"`);
      }
      if (bpjs !== undefined && bpjs !== currentUser.bpjs) {
        updates.bpjs = bpjs;
        logDetails.push(`BPJS: dari "${currentUser.bpjs || 'Belum Diisi'}" menjadi "${bpjs}"`);
      }
      if (religion !== undefined && religion !== currentUser.religion) {
        updates.religion = religion;
        logDetails.push(`Agama: dari "${currentUser.religion || 'Belum Diisi'}" menjadi "${religion}"`);
      }
      if (photoUrl !== undefined && photoUrl !== currentUser.photoUrl) {
        updates.photoUrl = photoUrl;
        logDetails.push("Mengubah foto profil");
      }
      if (npwpPhotoUrl !== undefined && npwpPhotoUrl !== currentUser.npwpPhotoUrl) {
        updates.npwpPhotoUrl = npwpPhotoUrl;
        logDetails.push("Mengubah foto NPWP");
      }
      if (bpjsPhotoUrl !== undefined && bpjsPhotoUrl !== currentUser.bpjsPhotoUrl) {
        updates.bpjsPhotoUrl = bpjsPhotoUrl;
        logDetails.push("Mengubah foto BPJS");
      }

      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        
        // Log to Activity Logs
        await db.insert(activityLogs).values({
          userId,
          action: "MENGUBAH_PROFIL",
          details: logDetails.join(", "),
        });
      }

      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      res.json(updatedUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update Admin Profile (Full Name, Username, Email, Phone Number, and optional Password)
  app.patch("/api/admin/profile", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { fullName, username, email, phoneNumber, password } = req.body;

      if (!fullName || !username) {
        return res.status(400).json({ message: "Nama Lengkap dan Username wajib diisi" });
      }

      // Check if username is already taken by another user
      const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUser.length > 0 && existingUser[0].id !== userId) {
        return res.status(400).json({ message: "Username sudah digunakan oleh akun lain" });
      }

      const updates: any = {
        fullName,
        username,
        email: email || null,
        phoneNumber: phoneNumber || null,
      };

      if (password) {
        updates.password = await hashPassword(password);
      }

      await db.update(users).set(updates).where(eq(users.id, userId));

      // Log activity
      await db.insert(activityLogs).values({
        userId,
        action: "MENGUBAH_PROFIL_ADMIN",
        details: `Mengubah profil admin: Nama=${fullName}, Username=${username}`,
      });

      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      // Update session user object if possible (passport.js login)
      req.login(updatedUser, (err) => {
        if (err) console.error("Session update error:", err);
      });

      res.json(updatedUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. Attendance Clock-in (Absen Masuk)
  app.post(
    "/api/attendance/clock-in",
    isAuthenticated,
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "lateReasonPhoto", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      await autoCloseExpiredSessions((req.user as any).id);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const userId = (req.user as any).id;
      
      const {
        shiftId,
        latitude,
        longitude,
        accuracy,
        mocked,
        address,
        location,
        lateReason,
      } = req.body;

      const activeAddress = location || address;

      if (!shiftId) {
        return res.status(400).json({ message: "Shift ID diperlukan" });
      }

      try {
        let shiftRecord: any = null;
        if (Number(shiftId) < 0) {
          // It's a system default shift (e.g. -1 for 08:00 - 17:00)
          shiftRecord = {
            id: Number(shiftId),
            name: "Shift Reguler",
            checkInTime: "08:00",
            checkOutTime: "17:00",
            description: "Shift Reguler Default"
          };
        } else {
          const [found] = await db.select().from(shifts).where(eq(shifts.id, Number(shiftId))).limit(1);
          shiftRecord = found;
        }

        if (!shiftRecord) {
          return res.status(400).json({ message: "Shift tidak valid" });
        }

        const adminDate = getAdminDate();

        // 1. Fake GPS detection
        const acc = Number(accuracy);
        const isFake = (acc === 0 || acc === 1 || mocked === "true" || mocked === true);

        // 2. Session calculation — exclude phantom absent records that have no checkIn
        const existingSessions = await db
          .select()
          .from(attendance)
          .where(and(
            eq(attendance.userId, userId),
            sql`DATE(${attendance.date}) = ${adminDate}`,
            isNotNull(attendance.checkIn)
          ));

        const openSessions = existingSessions.filter(s => s.checkOut === null);
        if (openSessions.length > 0) {
          return res.status(400).json({ message: "Anda masih memiliki sesi absen yang aktif. Harap absen pulang terlebih dahulu sebelum absen masuk lagi." });
        }

        const nextSessionNum = existingSessions.length + 1;
        if (nextSessionNum > 5) {
          return res.status(400).json({ message: "Batas absensi harian (5 sesi) telah tercapai." });
        }

        // 3. Check for Lateness (Only on Session 1)
        let statusValue: "present" | "late" = "present";
        if (nextSessionNum === 1) {
          const utc = new Date();
          const wib = new Date(utc.getTime() + 7 * 60 * 60 * 1000);
          const currentMinutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
          
          const [shiftHour, shiftMin] = shiftRecord.checkInTime.split(":").map(Number);
          const shiftMinutes = shiftHour * 60 + shiftMin;

          // Circular time difference to handle overnight shifts (e.g., 00:00)
          let diff = currentMinutes - shiftMinutes;
          
          if (diff < -12 * 60) {
            diff += 24 * 60; // Clocked in late after midnight for previous day's shift
          }

          if (diff > 0) {
            statusValue = "late";
            if (!lateReason) {
              return res.status(400).json({ message: "Anda terlambat! Harap masukkan alasan keterlambatan." });
            }
          }
        }

        const fullName = (req.user as any).fullName || (req.user as any).username;
        const checkInPhoto = await processSingleUpload(files?.photo?.[0], "clockIn", fullName, undefined, req.body.checkInPhoto);
        const lateReasonPhoto = await processSingleUpload(files?.lateReasonPhoto?.[0], "lateReason", fullName, undefined, req.body.lateReasonPhoto);

        const newAttendance = {
          userId,
          date: adminDate,
          checkIn: new Date(),
          checkInPhoto,
          checkInLocation: activeAddress || `Lat: ${latitude || 'UND'}, Lng: ${longitude || 'UND'}`,
          shiftId: Number(shiftId),
          shift: shiftRecord.name,
          sessionNumber: nextSessionNum,
          status: statusValue,
          lateReason: statusValue === "late" ? lateReason : null,
          lateReasonPhoto,
          isFakeGps: isFake,
        };

        await db.insert(attendance).values(newAttendance);
        res.json({ message: "Absen masuk berhasil", data: newAttendance });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );

  // 4. Start Break (Mulai Istirahat)
  app.post("/api/attendance/break-start", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    await autoCloseExpiredSessions((req.user as any).id);
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location, checkInPhoto } = req.body;
    const activeAddress = location || address;

    try {
      // Find latest attendance session for today
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            or(
              sql`DATE(${attendance.date}) = ${adminDate}`,
              isNull(attendance.checkOut)
            )
          )
        )
        .orderBy(desc(attendance.sessionNumber));

      if (todaySessions.length === 0) {
        return res.status(400).json({ message: "Anda belum melakukan absen masuk hari ini" });
      }

      const activeSession = todaySessions[0];
      if (activeSession.breakStart) {
        return res.status(400).json({ message: "Istirahat sudah dimulai pada sesi ini" });
      }

      const fullName = (req.user as any).fullName || (req.user as any).username;
      const breakStartPhoto = await processSingleUpload(req.file, "breakStart", fullName, undefined, checkInPhoto);
      await db
        .update(attendance)
        .set({
          breakStart: new Date(),
          breakStartPhoto,
          breakStartLocation: activeAddress || "Lokasi Istirahat",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Mulai istirahat berhasil" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 5. End Break (Selesai Istirahat)
  app.post("/api/attendance/break-end", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    await autoCloseExpiredSessions((req.user as any).id);
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location, checkInPhoto } = req.body;
    const activeAddress = location || address;

    try {
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            or(
              sql`DATE(${attendance.date}) = ${adminDate}`,
              isNull(attendance.checkOut)
            )
          )
        )
        .orderBy(desc(attendance.sessionNumber));

      if (todaySessions.length === 0) {
        return res.status(400).json({ message: "Anda belum masuk hari ini" });
      }

      const activeSession = todaySessions[0];
      if (!activeSession.breakStart) {
        return res.status(400).json({ message: "Istirahat belum dimulai" });
      }
      if (activeSession.breakEnd) {
        return res.status(400).json({ message: "Istirahat sudah diakhiri pada sesi ini" });
      }

      const fullName = (req.user as any).fullName || (req.user as any).username;
      const breakEndPhoto = await processSingleUpload(req.file, "breakEnd", fullName, undefined, checkInPhoto);
      await db
        .update(attendance)
        .set({
          breakEnd: new Date(),
          breakEndPhoto,
          breakEndLocation: activeAddress || "Lokasi Selesai Istirahat",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Istirahat selesai" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 6. Clock-out (Absen Pulang)
  app.post("/api/attendance/clock-out", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    await autoCloseExpiredSessions((req.user as any).id);
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();
    const { address, location, checkInPhoto } = req.body;
    const activeAddress = location || address;

    try {
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            or(
              sql`DATE(${attendance.date}) = ${adminDate}`,
              isNull(attendance.checkOut)
            )
          )
        )
        .orderBy(desc(attendance.sessionNumber));

      if (todaySessions.length === 0) {
        return res.status(400).json({ message: "Anda belum masuk hari ini" });
      }

      const activeSession = todaySessions[0];
      if (activeSession.checkOut) {
        return res.status(400).json({ message: "Sesi absensi aktif sudah melakukan checkout" });
      }

      const fullName = (req.user as any).fullName || (req.user as any).username;
      const checkOutPhoto = await processSingleUpload(req.file, "clockOut", fullName, undefined, checkInPhoto);
      await db
        .update(attendance)
        .set({
          checkOut: new Date(),
          checkOutPhoto,
          checkOutLocation: activeAddress || "Lokasi Checkout",
        })
        .where(eq(attendance.id, activeSession.id));

      res.json({ message: "Absen pulang berhasil" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 7. Permit (Pengajuan Izin)
  app.post("/api/attendance/permit", isAuthenticated, upload.single("photo"), async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { notes, type, checkInPhoto, location } = req.body;
    const adminDate = getAdminDate();
    const labelType = type === 'sick' ? 'Sakit' : type === 'off' ? 'Libur' : 'Izin';

    try {
      // Get all sessions today to find the active one
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            or(
              sql`DATE(${attendance.date}) = ${adminDate}`,
              isNull(attendance.checkOut)
            )
          )
        )
        .orderBy(attendance.sessionNumber);

      const activeSession = todaySessions.find(s => !s.checkOut);

      const fullName = (req.user as any).fullName || (req.user as any).username;
      const photoFileId = await processSingleUpload(req.file, "clockIn", fullName, undefined, checkInPhoto);
      const now = new Date();

      if (activeSession) {
        const wasOnBreak = !!(activeSession.breakStart && !activeSession.breakEnd);
        const wasWorking = !!activeSession.checkIn;
        const stateLabel = wasOnBreak ? '(saat istirahat)' : wasWorking ? '(saat bekerja)' : '';
        const contextNote = notes
          ? `[${labelType} ${stateLabel}] ${notes}`
          : `${labelType} ${stateLabel} - sesi dihentikan, dapat dilanjutkan kembali`;

        const updatePayload: any = {
          status: type,
          notes: contextNote,
          checkOut: now,
          checkOutPhoto: photoFileId || activeSession.checkOutPhoto,
          permitExitAt: now,
        };

        if (wasOnBreak) {
          updatePayload.breakEnd = now;
        }

        await db.update(attendance).set(updatePayload).where(eq(attendance.id, activeSession.id));
        
        const [updated] = await db.select().from(attendance).where(eq(attendance.id, activeSession.id)).limit(1);
        return res.json(updated);
      }

      // No active session — permit submitted before starting work
      const contextNote = notes
        ? `[${labelType} sebelum kerja] ${notes}`
        : `${labelType} - tidak masuk kerja`;

      const newAttendance = {
        userId,
        date: adminDate,
        status: type,
        notes: contextNote,
        checkInPhoto: photoFileId,
        checkInLocation: location || null,
        checkIn: now,
        checkOut: now,
        sessionNumber: todaySessions.length + 1,
      };

      await db.insert(attendance).values(newAttendance);
      res.json(newAttendance);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 8. Resume (Lanjut Kerja)
  app.post("/api/attendance/resume", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();

    try {
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.userId, userId), sql`DATE(${attendance.date}) = ${adminDate}`))
        .orderBy(attendance.sessionNumber);

      if (todaySessions.length === 0) {
        return res.status(400).json({ message: "Tidak ada riwayat kehadiran hari ini" });
      }

      const activeSession = todaySessions.find(s => !s.checkOut);
      if (activeSession) {
        return res.status(400).json({ message: "Masih ada sesi aktif. Silakan pulang dulu sebelum lanjut kerja." });
      }

      const nextSessionNumber = todaySessions.length + 1;
      if (nextSessionNumber > 5) {
        return res.status(400).json({ message: "Batas harian 5 sesi tercapai." });
      }

      const now = new Date();
      const lastSession = todaySessions[todaySessions.length - 1];
      const shiftId = lastSession.shiftId;
      const shiftName = lastSession.shift || 'Karyawan';

      const newAttendance = {
        userId,
        date: adminDate,
        checkIn: now,
        status: "present" as any,
        shiftId: shiftId ? Number(shiftId) : null,
        shift: shiftName,
        sessionNumber: nextSessionNumber,
        notes: `Sesi ke-${nextSessionNumber}`
      };

      await db.insert(attendance).values(newAttendance);
      res.json(newAttendance);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/fix-duplicates", async (req: Request, res: Response) => {
    try {
      const records = await db.select().from(attendance);
      const groups = new Map<string, typeof records>();
      for (const record of records) {
        if (!record.checkIn) continue;
        const dateStr = record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0];
        const checkInDate = new Date(record.checkIn);
        const hh = checkInDate.getHours().toString().padStart(2, '0');
        const mm = checkInDate.getMinutes().toString().padStart(2, '0');
        const key = `${record.userId}-${dateStr}-${hh}:${mm}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(record);
      }
      
      const idsToDelete: number[] = [];
      for (const [key, group] of groups.entries()) {
        if (group.length > 1) {
          group.sort((a, b) => {
            const aHasBreak = a.breakStart ? 1 : 0;
            const bHasBreak = b.breakStart ? 1 : 0;
            if (aHasBreak !== bHasBreak) return bHasBreak - aHasBreak;
            const aHasOut = a.checkOut ? 1 : 0;
            const bHasOut = b.checkOut ? 1 : 0;
            if (aHasOut !== bHasOut) return bHasOut - aHasOut;
            return a.id - b.id;
          });
          for (let i = 1; i < group.length; i++) {
            idsToDelete.push(group[i].id);
          }
        }
      }
      
      if (idsToDelete.length > 0) {
        await db.delete(attendance).where(inArray(attendance.id, idsToDelete));
      }
      res.json({ message: "Deduplication complete", deletedCount: idsToDelete.length, idsToDelete });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/fix-checkout-16", async (req: Request, res: Response) => {
    try {
      const records = await db.select().from(attendance);
      let updatedCount = 0;
      const updatedIds: number[] = [];
      
      for (const record of records) {
        if (!record.checkOut || !record.notes?.includes("Otomatis absen pulang oleh sistem")) continue;
        
        const outDate = new Date(record.checkOut);
        const wibHours = (outDate.getUTCHours() + 7) % 24;
        
        // Target: 1 jam setelah shift selesai.
        // Shift 17:00 -> seharusnya 18:00. Jika 16:00 (bug TZ) +2 jam. Jika 17:00 (sudah fix TZ) +1 jam.
        // Shift 22:00 -> seharusnya 23:00. Jika 21:00 (bug TZ) +2 jam. Jika 22:00 (sudah fix TZ) +1 jam.
        let hoursToAdd = 0;
        if (wibHours === 16 || wibHours === 21) {
          hoursToAdd = 2;
        } else if (wibHours === 17 || wibHours === 22) {
          hoursToAdd = 1;
        }

        if (hoursToAdd > 0) {
          outDate.setUTCHours(outDate.getUTCHours() + hoursToAdd);
          await db.update(attendance).set({ checkOut: outDate }).where(eq(attendance.id, record.id));
          updatedCount++;
          updatedIds.push(record.id);
        }
      }
      
      res.json({ message: "Fix checkout shift+1hr complete", updatedCount, updatedIds });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper untuk mengirim Push Notification ke user spesifik
  async function sendPushToUser(userId: number, payload: { title: string; body: string; url?: string }) {
    try {
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      for (const sub of subs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        webpush.sendNotification(pushSubscription, JSON.stringify(payload)).catch((err) => {
          console.error("WebPush send error:", err);
        });
      }
    } catch (err) {
      console.error("sendPushToUser error:", err);
    }
  }

  // 7. Overtime Endpoints (Untuk Seluruh Karyawan / Super Admin)
  app.post("/api/attendance/overtime/start", isAuthenticated, upload.fields([{ name: "splPhoto" }, { name: "initialProofPhoto" }]), async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) return res.status(404).json({ message: "User not found" });

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const description = req.body.description;

      const adminDate = getAdminDate();
      const todaySessions = await db.select()
        .from(attendance)
        .where(and(
          eq(attendance.userId, userId),
          eq(attendance.date, adminDate)
        ))
        .orderBy(desc(attendance.sessionNumber));

      if (todaySessions.length === 0) {
        return res.status(400).json({ message: "Anda belum absen masuk hari ini" });
      }

      const activeSession = todaySessions[0];
      
      // If haven't checked out normally, check them out at shift end time
      if (!activeSession.checkOut) {
        const userShift = await db.select().from(shifts).where(eq(shifts.id, activeSession.shiftId!)).limit(1);
        const shiftEndStr = userShift.length > 0 ? userShift[0].checkOutTime : "17:00";
        const [hh, mm] = shiftEndStr.split(":").map(Number);
        
        let year, month, dateNum;
        if (typeof activeSession.date === 'string') {
          const parts = (activeSession.date as string).split("-");
          year = Number(parts[0]); month = Number(parts[1]) - 1; dateNum = Number(parts[2]);
        } else {
          const d = activeSession.date as Date;
          year = d.getFullYear(); month = d.getMonth(); dateNum = d.getDate();
        }
        
        const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`;
        let checkOutDate = new Date(isoString);
        await db.update(attendance).set({ checkOut: checkOutDate }).where(eq(attendance.id, activeSession.id));
      }

      // Check if overtime already started
      const existingOvertimes = await db.select().from(overtimes).where(and(eq(overtimes.attendanceId, activeSession.id), eq(overtimes.status, "ongoing")));
      if (existingOvertimes.length > 0) {
        // Update existing pending/ongoing overtime
        const splUrl = files?.splPhoto?.[0] ? await processSingleUpload(files.splPhoto[0], "overtimeSPL", user[0].fullName) : existingOvertimes[0].splDocumentUrl;
        const initialProofUrl = files?.initialProofPhoto?.[0] ? await processSingleUpload(files.initialProofPhoto[0], "overtimeInitial", user[0].fullName) : existingOvertimes[0].initialProofUrl;

        await db.update(overtimes).set({
          startTime: new Date(),
          description: description || existingOvertimes[0].description,
          splDocumentUrl: splUrl,
          initialProofUrl: initialProofUrl,
          status: "ongoing",
          employeeApproval: "approved"
        }).where(eq(overtimes.id, existingOvertimes[0].id));

        return res.json({ message: "Lembur berhasil dimulai" });
      }

      const splUrl = files?.splPhoto?.[0] ? await processSingleUpload(files.splPhoto[0], "overtimeSPL", user[0].fullName) : null;
      const initialProofUrl = files?.initialProofPhoto?.[0] ? await processSingleUpload(files.initialProofPhoto[0], "overtimeInitial", user[0].fullName) : null;

      await db.insert(overtimes).values({
        attendanceId: activeSession.id,
        startTime: new Date(),
        description: description,
        splDocumentUrl: splUrl,
        initialProofUrl: initialProofUrl,
        status: "ongoing",
        employeeApproval: "approved"
      });

      res.json({ message: "Lembur berhasil dimulai" });
    } catch (e: any) {
      console.error("Overtime start error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/attendance/overtime/end", isAuthenticated, upload.fields([{ name: "finalProofPhoto" }]), async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) return res.status(404).json({ message: "User not found" });

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const finalDescription = req.body.finalDescription;
      
      const adminDate = getAdminDate();
      const todaySessions = await db.select()
        .from(attendance)
        .where(and(eq(attendance.userId, userId), eq(attendance.date, adminDate)))
        .orderBy(desc(attendance.sessionNumber));

      if (todaySessions.length === 0) return res.status(400).json({ message: "Sesi tidak ditemukan" });

      const activeSession = todaySessions[0];
      const activeOvertimes = await db.select().from(overtimes).where(and(eq(overtimes.attendanceId, activeSession.id), eq(overtimes.status, "ongoing"))).limit(1);
      
      if (activeOvertimes.length === 0) {
         return res.status(400).json({ message: "Tidak ada lembur yang sedang berjalan" });
      }

      const finalProofUrl = files?.finalProofPhoto?.[0] ? await processSingleUpload(files.finalProofPhoto[0], "overtimeFinal", user[0].fullName) : null;

      await db.update(overtimes).set({
        endTime: new Date(),
        finalProofUrl: finalProofUrl,
        finalDescription: finalDescription,
        status: "completed"
      }).where(eq(overtimes.id, activeOvertimes[0].id));

      res.json({ message: "Lembur berhasil diakhiri" });
    } catch(e: any) {
      console.error("Overtime end error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/attendance/overtime/today", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;

      // Fetch latest active/pending/approved/ongoing overtime for this user
      const userOvertimes = await db
        .select({
          id: overtimes.id,
          attendanceId: overtimes.attendanceId,
          startTime: overtimes.startTime,
          endTime: overtimes.endTime,
          splDocumentUrl: overtimes.splDocumentUrl,
          initialProofUrl: overtimes.initialProofUrl,
          finalProofUrl: overtimes.finalProofUrl,
          description: overtimes.description,
          finalDescription: overtimes.finalDescription,
          status: overtimes.status,
          employeeApproval: overtimes.employeeApproval,
          rejectionReason: overtimes.rejectionReason,
          splNumber: overtimes.splNumber,
          assignedBy: overtimes.assignedBy,
          createdAt: overtimes.createdAt,
        })
        .from(overtimes)
        .innerJoin(attendance, eq(overtimes.attendanceId, attendance.id))
        .where(
          and(
            eq(attendance.userId, userId),
            ne(overtimes.status, "cancelled")
          )
        )
        .orderBy(desc(overtimes.id))
        .limit(1);

      if (userOvertimes.length > 0) {
        return res.json(userOvertimes[0]);
      }

      return res.json(null);
    } catch (e: any) {
      console.error("Fetch overtime today error:", e);
      return res.json(null);
    }
  });

  // Respon Persetujuan / Izin Tidak Lembur Karyawan
  app.post("/api/attendance/overtime/respond", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { overtimeId, action, rejectionReason, rejectionProofUrl } = req.body;
      if (!overtimeId || !action) {
        return res.status(400).json({ message: "overtimeId dan action wajib diisi" });
      }
      const ot = await db.select().from(overtimes).where(eq(overtimes.id, Number(overtimeId))).limit(1);
      if (ot.length === 0) return res.status(404).json({ message: "Data lembur tidak ditemukan" });

      if (action === "approve") {
        await db.update(overtimes).set({
          employeeApproval: "approved"
        }).where(eq(overtimes.id, Number(overtimeId)));
        return res.json({ message: "Penugasan lembur telah disetujui (Terima Tugas). Silakan klik Mulai Lembur saat siap." });
      } else if (action === "reject") {
        await db.update(overtimes).set({
          employeeApproval: "rejected",
          rejectionReason: rejectionReason || "Karyawan mengajukan izin tidak lembur",
          rejectionProofUrl: rejectionProofUrl || null,
          status: "cancelled"
        }).where(eq(overtimes.id, Number(overtimeId)));
        return res.json({ message: "Permohonan izin tidak lembur telah dikirim" });
      }
      res.status(400).json({ message: "Aksi tidak valid" });
    } catch (e: any) {
      console.error("Overtime respond error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint untuk mengambil Surat Perintah Lembur (SPL) Karyawan
  app.get("/api/employee/overtimes/my-spl", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userSpls = await db.select({
        id: overtimes.id,
        attendanceId: overtimes.attendanceId,
        startTime: overtimes.startTime,
        endTime: overtimes.endTime,
        splDocumentUrl: overtimes.splDocumentUrl,
        description: overtimes.description,
        status: overtimes.status,
        employeeApproval: overtimes.employeeApproval,
        rejectionReason: overtimes.rejectionReason,
        splNumber: overtimes.splNumber,
        createdAt: overtimes.createdAt,
        date: attendance.date
      })
      .from(overtimes)
      .innerJoin(attendance, eq(overtimes.attendanceId, attendance.id))
      .where(eq(attendance.userId, userId))
      .orderBy(desc(overtimes.createdAt));

      res.json(userSpls);
    } catch (e: any) {
      console.error("Fetch my SPL error:", e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Endpoint Admin Fetch All Overtimes (Daftar Lembur Real)
  app.get("/api/admin/overtimes", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const allOvertimes = await db.select({
        id: overtimes.id,
        attendanceId: overtimes.attendanceId,
        startTime: overtimes.startTime,
        endTime: overtimes.endTime,
        splDocumentUrl: overtimes.splDocumentUrl,
        initialProofUrl: overtimes.initialProofUrl,
        finalProofUrl: overtimes.finalProofUrl,
        description: overtimes.description,
        finalDescription: overtimes.finalDescription,
        status: overtimes.status,
        employeeApproval: overtimes.employeeApproval,
        rejectionReason: overtimes.rejectionReason,
        splNumber: overtimes.splNumber,
        assignedBy: overtimes.assignedBy,
        createdAt: overtimes.createdAt,
        userId: attendance.userId,
        date: attendance.date,
        fullName: users.fullName,
        nik: users.nik,
        position: users.position,
        branch: users.branch
      })
      .from(overtimes)
      .innerJoin(attendance, eq(overtimes.attendanceId, attendance.id))
      .innerJoin(users, eq(attendance.userId, users.id))
      .orderBy(desc(overtimes.createdAt));

      res.json(allOvertimes);
    } catch (e: any) {
      console.error("Fetch all overtimes error:", e);
      res.json([]);
    }
  });

  // Endpoint Admin Penugasan Lembur Baru (SPL)
  app.post("/api/admin/overtimes/assign", isAuthenticated, isAdmin, upload.single("splFile"), async (req: Request, res: Response) => {
    try {
      const { userId, date, startTime, endTime, description } = req.body;
      if (!userId || !date || !startTime) {
        return res.status(400).json({ message: "Karyawan, Tanggal, dan Jam Mulai Wajib Diisi" });
      }
      const targetUser = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
      if (!targetUser.length) return res.status(404).json({ message: "User tidak ditemukan" });

      let attRecord = await db.select().from(attendance).where(and(eq(attendance.userId, Number(userId)), eq(attendance.date, date))).limit(1);
      let attendanceId: number;
      if (attRecord.length === 0) {
        const [newAtt]: any = await db.insert(attendance).values({
          userId: Number(userId),
          date: date,
          status: "present",
          checkIn: null,
          notes: "Penugasan Lembur SPL"
        });
        attendanceId = newAtt.insertId;
        if (!attendanceId) {
          const [createdAtt] = await db.select().from(attendance).where(and(eq(attendance.userId, Number(userId)), eq(attendance.date, date))).limit(1);
          attendanceId = createdAtt.id;
        }
      } else {
        attendanceId = attRecord[0].id;
      }

      let splUrl = null;
      if (req.file) {
        splUrl = await processSingleUpload(req.file, "overtimeSPL", targetUser[0].fullName);
      }

      const startDateObj = new Date(`${date}T${startTime}:00+07:00`);
      let endDateObj: Date | null = null;
      if (endTime) {
        let tempEnd = new Date(`${date}T${endTime}:00+07:00`);
        if (tempEnd < startDateObj) {
          // End time is on the next day (e.g. 23:00 to 02:00 next day)
          tempEnd.setDate(tempEnd.getDate() + 1);
        }
        endDateObj = tempEnd;
      }
      const splNum = `SPL/MIP/${date.replace(/-/g, '')}/${Math.floor(1000 + Math.random() * 9000)}`;

      const [newOt] = await (db.insert(overtimes) as any).values({
        attendanceId: attendanceId,
        startTime: startDateObj,
        endTime: endDateObj,
        description: description || "Surat Perintah Lembur (SPL)",
        splDocumentUrl: splUrl,
        status: "pending",
        employeeApproval: "pending",
        splNumber: splNum,
        assignedBy: req.session.userId!
      });

      sendPushToUser(Number(userId), {
        title: "⚡ SURAT PERINTAH LEMBUR (SPL)",
        body: `Anda menerima Surat Perintah Lembur (SPL) tanggal ${date} jam ${startTime}. Silakan buka aplikasi untuk menyetujui.`,
        url: "/dashboard"
      });

      res.json({ message: "Penugasan Lembur (SPL) berhasil dikirim", id: newOt.insertId });
    } catch (e: any) {
      console.error("Assign overtime error:", e);
      res.status(500).json({ message: e.message || "Internal server error" });
    }
  });

  // API Tambah & Edit Lembur Manual oleh Admin
  app.post("/api/admin/overtimes/manual", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const { attendanceId, startTime, endTime, description, finalDescription, status } = req.body;
      if (!attendanceId || !startTime) {
        return res.status(400).json({ message: "Attendance ID dan Jam Mulai Wajib Diisi" });
      }
      const [newOt] = await (db.insert(overtimes) as any).values({
        attendanceId: Number(attendanceId),
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        description: description || "Lembur Manual Admin",
        finalDescription: finalDescription || null,
        status: status || (endTime ? "completed" : "ongoing"),
        employeeApproval: "approved"
      });
      res.json({ message: "Lembur manual berhasil ditambahkan", id: newOt.insertId });
    } catch (e: any) {
      console.error("Manual overtime error:", e);
      res.status(500).json({ message: e.message || "Internal server error" });
    }
  });

  app.put("/api/admin/overtimes/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { startTime, endTime, description, finalDescription, status } = req.body;
      const updateData: any = {};
      if (startTime) updateData.startTime = new Date(startTime);
      if (endTime !== undefined) updateData.endTime = endTime ? new Date(endTime) : null;
      if (description !== undefined) updateData.description = description;
      if (finalDescription !== undefined) updateData.finalDescription = finalDescription;
      if (status) updateData.status = status;

      await db.update(overtimes).set(updateData).where(eq(overtimes.id, id));
      res.json({ message: "Data lembur berhasil diperbarui" });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal server error" });
    }
  });

  app.delete("/api/admin/overtimes/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db.delete(overtimes).where(eq(overtimes.id, id));
      res.json({ message: "Data lembur berhasil dihapus" });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal server error" });
    }
  });

  app.get("/api/attendance/today", isAuthenticated, async (req: Request, res: Response) => {
    await autoCloseExpiredSessions((req.user as any).id);
    const userId = (req.user as any).id;
    const adminDate = getAdminDate();

    try {
      const todaySessions = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, userId),
            isNotNull(attendance.checkIn),
            or(
              sql`DATE(${attendance.date}) = ${adminDate}`,
              isNull(attendance.checkOut)
            )
          )
        )
        .orderBy(attendance.sessionNumber);

      res.json(todaySessions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 8. Get Personal Attendance History
  app.get("/api/attendance/history", isAuthenticated, async (req: Request, res: Response) => {
    await autoCloseExpiredSessions((req.user as any).id);
    const userId = (req.user as any).id;
    try {
      const list = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.userId, userId), isNotNull(attendance.checkIn)))
        .orderBy(desc(attendance.date), desc(attendance.sessionNumber));

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 9. Employee Leave Requests
  app.get("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      const list = await db
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.userId, userId))
        .orderBy(desc(leaveRequests.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/leave-requests", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { startDate, endDate, selectedDates, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const datesStr = Array.isArray(selectedDates) ? selectedDates.join(",") : (selectedDates || startDate);
      await db.insert(leaveRequests).values({
        userId,
        startDate,
        endDate,
        selectedDates: datesStr,
        reason,
        status: "pending",
      });
      res.status(201).json({ message: "Pengajuan cuti berhasil diajukan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/leave-requests/:id/cancel", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const targetId = Number(req.params.id);
    try {
      const [reqRecord] = await db.select().from(leaveRequests).where(and(eq(leaveRequests.id, targetId), eq(leaveRequests.userId, userId))).limit(1);
      if (!reqRecord) {
        return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
      }
      await db.update(leaveRequests).set({ status: "cancelled" }).where(eq(leaveRequests.id, targetId));
      res.json({ message: "Pengajuan cuti berhasil dibatalkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/leave-balance", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      // Find all approved leave requests
      const approvedRequests = await db
        .select()
        .from(leaveRequests)
        .where(and(eq(leaveRequests.userId, userId), eq(leaveRequests.status, "approved")));

      let used = 0;
      approvedRequests.forEach(req => {
        if (req.selectedDates) {
          used += req.selectedDates.split(",").length;
        } else if (req.startDate && req.endDate) {
          const diffTime = Math.abs(new Date(req.endDate).getTime() - new Date(req.startDate).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          used += diffDays;
        }
      });

      const limit = 12; // Standard jatah cuti limit
      const remaining = Math.max(0, limit - used);

      res.json({
        used,
        remaining,
        limit
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 10. Employee Complaints & Upload
  app.get("/api/employee/complaints", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    try {
      // Find complaints and link their photos
      const userComplaints = await db
        .select()
        .from(complaints)
        .where(eq(complaints.userId, userId))
        .orderBy(desc(complaints.createdAt));

      const response = [];
      for (const comp of userComplaints) {
        const photos = await db
          .select()
          .from(complaintPhotos)
          .where(eq(complaintPhotos.complaintId, comp.id));
        response.push({ ...comp, photos });
      }

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employee/complaints", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { title, description, photos } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      // Insert complaint
      const [insertResult] = await (db.insert(complaints) as any).values({
        userId,
        title,
        description,
        status: "pending",
        createdAt: new Date(),
      });

      const complaintId = insertResult.insertId;

      // Insert photos
      if (photos && Array.isArray(photos) && photos.length > 0) {
        for (const photo of photos) {
          await db.insert(complaintPhotos).values({
            complaintId,
            photoUrl: photo.url,
            caption: photo.caption || null,
          });
        }
      }

      // Fetch the newly created complaint so we can return it
      const [newComplaint] = await db.select().from(complaints).where(eq(complaints.id, complaintId));

      const photosData = await db.select().from(complaintPhotos).where(eq(complaintPhotos.complaintId, complaintId));

      res.status(201).json({ 
        message: "Pengaduan berhasil diajukan",
        complaint: { ...newComplaint, photos: photosData }
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/employee/complaints/:id", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const targetId = parseInt(req.params.id);
    
    try {
      // Pastikan pengaduan milik user ini
      const [complaint] = await db.select().from(complaints).where(and(eq(complaints.id, targetId), eq(complaints.userId, userId)));
      if (!complaint) return res.status(404).json({ message: "Pengaduan tidak ditemukan" });

      await db.delete(complaintPhotos).where(eq(complaintPhotos.complaintId, targetId));
      await db.delete(complaints).where(eq(complaints.id, targetId));

      res.json({ message: "Pengaduan berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 11. Employee popup notification checking
  // Cutoff date is 2026-06-10T04:00:00.000Z UTC (11:00 WIB)
  app.get("/api/employee/documents", isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const cutoff = new Date("2026-06-10T04:00:00.000Z");

    try {
      const sp = await db
        .select()
        .from(warningLetters)
        .where(and(
            eq(warningLetters.userId, userId), 
            eq(warningLetters.status, 'approved'),
            gte(warningLetters.createdAt, cutoff)
        ));

      const mut = await db
        .select()
        .from(mutations)
        .where(and(
            eq(mutations.userId, userId), 
            eq(mutations.status, 'approved'),
            gte(mutations.createdAt, cutoff)
        ));

      const resg = await db
        .select()
        .from(resignations)
        .where(and(
            eq(resignations.userId, userId), 
            eq(resignations.status, 'approved'),
            gte(resignations.createdAt, cutoff)
        ));

      res.json({
        warningLetters: sp,
        mutations: mut,
        resignations: resg,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // ================= ANNOUNCEMENTS (Info Board) =================

  // GET all announcements (public for authenticated users)
  app.get("/api/announcements", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST create announcement (admin only)
  app.post("/api/announcements", isAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const { title, content, expiresAt } = req.body;
      if (!title || !content) {
        return res.status(400).json({ message: "Judul dan konten wajib diisi" });
      }

      let imageUrl: string | null = null;
      if (req.file) {
        const username = (req.user as any).username;
        imageUrl = await processSingleUpload(req.file, "document", username);
      }

      const authorId = (req.user as any).id;
      await (db.insert(announcements) as any).values({
        title,
        content,
        imageUrl,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        authorId,
      });

      res.status(201).json({ message: "Informasi berhasil diterbitkan" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH update announcement (admin only)
  app.patch("/api/announcements/:id", isAdmin, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const { title, content, expiresAt } = req.body;

      const updates: any = {};
      if (title) updates.title = title;
      if (content) updates.content = content;
      if (expiresAt) updates.expiresAt = new Date(expiresAt);
      if (req.file) {
        const username = (req.user as any).username;
        updates.imageUrl = await processSingleUpload(req.file, "document", username);
      }

      await db.update(announcements).set(updates).where(eq(announcements.id, id));
      res.json({ message: "Informasi berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE announcement (admin only)
  app.delete("/api/announcements/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      await db.delete(announcements).where(eq(announcements.id, id));
      res.json({ message: "Informasi berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ================= ADMIN & SUPERADMIN =================

  // Dashboard Stats: total employees + present today
  app.get("/api/admin/stats", isAdmin, async (req: Request, res: Response) => {
    try {
      const adminDate = getAdminDate();
      // Count all approved employees
      const allEmployees = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "employee"), eq(users.registrationStatus, "approved")));
      const totalEmployees = allEmployees.length;

      // Count unique employees who clocked in today
      const todayAttendance = await db
        .select()
        .from(attendance)
        .where(sql`DATE(${attendance.date}) = ${adminDate}`);
      const presentUserIds = new Set(todayAttendance.map(a => a.userId));
      const presentToday = presentUserIds.size;

      res.json({ totalEmployees, presentToday });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Dashboard Stats: pending complaints count
  app.get("/api/admin/complaints/stats", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(complaints)
        .where(eq(complaints.status, "pending"));
      res.json({ pendingCount: list.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 1. Unverified employees list
  app.get("/api/admin/unverified-employees", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users)
        .where(eq(users.registrationStatus, "pending"));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 2. Approve/reject employee
  app.post("/api/admin/verify-employee/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { action } = req.body; // "approve" or "reject"

    try {
      const status = action === "approve" ? "approved" : "rejected";
      await db
        .update(users)
        .set({ registrationStatus: status })
        .where(eq(users.id, targetId));

      res.json({ message: `Tenaga Kerja berhasil di-${action}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 3. Get all active approved employees
  app.get("/api/admin/employees", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "employee"), eq(users.registrationStatus, "approved")));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get all users for admin list
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(users);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get activity logs (restricted to superadmin)
  app.get("/api/admin/activity-logs", isAdmin, async (req: Request, res: Response) => {
    if ((req.user as any).role !== "superadmin") {
      return res.status(403).json({ message: "Akses ditolak: Khusus Super Admin" });
    }
    try {
      const list = await db
        .select({
          id: activityLogs.id,
          userId: activityLogs.userId,
          action: activityLogs.action,
          details: activityLogs.details,
          createdAt: activityLogs.createdAt,
          userFullName: users.fullName,
          userRole: users.role,
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.userId, users.id))
        .orderBy(desc(activityLogs.createdAt));

      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create admin/employee user
  app.post("/api/admin/users", isAdmin, upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "ktpPhoto", maxCount: 1 },
    { name: "bpjsPhoto", maxCount: 1 },
    { name: "npwpPhoto", maxCount: 1 },
    { name: "kkPhoto", maxCount: 1 },
  ]), async (req: Request, res: Response) => {
    try {
      const { 
        fullName, username, password, role, nik, branch, position, email,
        phoneNumber, religion, npwp, bpjs, birthPlace, birthDate, gender,
        address, joinDate, employmentStatus, shift, registrationStatus, kkNumber
      } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!fullName || !username || !password || !role) {
        return res.status(400).json({ message: "Semua kolom wajib diisi" });
      }

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Username sudah digunakan" });
      }

      const hashedPassword = await hashPassword(password);
      
      const insertData: any = {
        fullName,
        username,
        password: hashedPassword,
        role,
        nik: nik || null,
        branch: branch || null,
        position: position || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
        religion: religion || null,
        npwp: npwp || null,
        bpjs: bpjs || null,
        birthPlace: birthPlace || null,
        birthDate: birthDate || null,
        gender: gender || "Laki-laki",
        address: address || null,
        joinDate: joinDate || null,
        employmentStatus: employmentStatus || null,
        shift: shift || null,
        registrationStatus: registrationStatus || "approved",
        kkNumber: kkNumber || null,
      };

      const uploadName = nik || username;
      if (files?.photo?.[0]) {
        insertData.photoUrl = await processSingleUpload(files.photo[0], "profile", uploadName, "Profil");
      }
      if (files?.ktpPhoto?.[0]) {
        insertData.ktpPhotoUrl = await processSingleUpload(files.ktpPhoto[0], "document", uploadName, "KTP");
      }
      if (files?.bpjsPhoto?.[0]) {
        insertData.bpjsPhotoUrl = await processSingleUpload(files.bpjsPhoto[0], "document", uploadName, "BPJS");
      }
      if (files?.npwpPhoto?.[0]) {
        insertData.npwpPhotoUrl = await processSingleUpload(files.npwpPhoto[0], "document", uploadName, "NPWP");
      }
      if (files?.kkPhoto?.[0]) {
        insertData.kkPhotoUrl = await processSingleUpload(files.kkPhoto[0], "document", uploadName, "KK");
      }

      const [newUser] = await db.insert(users).values(insertData);

      res.status(201).json(newUser);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Update admin/employee user
  app.patch("/api/admin/users/:id", isAdmin, upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "ktpPhoto", maxCount: 1 },
    { name: "bpjsPhoto", maxCount: 1 },
    { name: "npwpPhoto", maxCount: 1 },
    { name: "kkPhoto", maxCount: 1 },
  ]), async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      const { 
        fullName, username, password, role, nik, branch, position, email,
        phoneNumber, religion, npwp, bpjs, birthPlace, birthDate, gender,
        address, joinDate, employmentStatus, shift, registrationStatus, kkNumber
      } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const updateData: any = {};
      if (fullName) updateData.fullName = fullName;
      if (username) {
        const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (existingUser && existingUser.id !== targetId) {
          return res.status(400).json({ message: "Username sudah digunakan oleh user lain" });
        }
        updateData.username = username;
      }
      if (role) updateData.role = role;
      if (password && password.trim().length > 0) {
        updateData.password = await hashPassword(password);
      }
      
      // Additional employee fields
      if (nik !== undefined) updateData.nik = nik;
      if (branch !== undefined) updateData.branch = branch;
      if (position !== undefined) updateData.position = position;
      if (email !== undefined) updateData.email = email;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (religion !== undefined) updateData.religion = religion;
      if (npwp !== undefined) updateData.npwp = npwp;
      if (bpjs !== undefined) updateData.bpjs = bpjs;
      if (birthPlace !== undefined) updateData.birthPlace = birthPlace;
      if (birthDate !== undefined) updateData.birthDate = birthDate || null;
      if (gender !== undefined) updateData.gender = gender;
      if (address !== undefined) updateData.address = address;
      if (joinDate !== undefined) updateData.joinDate = joinDate;
      if (employmentStatus !== undefined) updateData.employmentStatus = employmentStatus;
      if (shift !== undefined) updateData.shift = shift;
      if (registrationStatus !== undefined) updateData.registrationStatus = registrationStatus;
      if (kkNumber !== undefined) updateData.kkNumber = kkNumber;

      // Handle photos
      const uploadName = nik || username || `user_${targetId}`;
      if (files?.photo?.[0]) {
        updateData.photoUrl = await processSingleUpload(files.photo[0], "profile", uploadName, "Profil");
      }
      if (files?.ktpPhoto?.[0]) {
        updateData.ktpPhotoUrl = await processSingleUpload(files.ktpPhoto[0], "document", uploadName, "KTP");
      }
      if (files?.bpjsPhoto?.[0]) {
        updateData.bpjsPhotoUrl = await processSingleUpload(files.bpjsPhoto[0], "document", uploadName, "BPJS");
      }
      if (files?.npwpPhoto?.[0]) {
        updateData.npwpPhotoUrl = await processSingleUpload(files.npwpPhoto[0], "document", uploadName, "NPWP");
      }

      await db.update(users).set(updateData).where(eq(users.id, targetId));
      const [updatedUser] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      res.json(updatedUser);
    } catch (err: any) {
      console.error("Update user error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4. Delete user permanently
  app.delete("/api/admin/users/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      // 1. Delete complaint photos
      const userComplaints = await db.select({ id: complaints.id }).from(complaints).where(eq(complaints.userId, targetId));
      if (userComplaints.length > 0) {
        const complaintIds = userComplaints.map(c => c.id);
        await db.delete(complaintPhotos).where(inArray(complaintPhotos.complaintId, complaintIds));
      }

      // 2. Delete all other related records
      await Promise.all([
        db.delete(complaints).where(eq(complaints.userId, targetId)),
        db.delete(attendance).where(eq(attendance.userId, targetId)),
        db.delete(leaveRequests).where(eq(leaveRequests.userId, targetId)),
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, targetId)),
        db.delete(resignations).where(eq(resignations.userId, targetId)),
        db.delete(mutations).where(eq(mutations.userId, targetId)),
        db.delete(warningLetters).where(eq(warningLetters.userId, targetId)),
        db.delete(activityLogs).where(eq(activityLogs.userId, targetId)),
      ]);

      // 3. Delete user
      await db.delete(users).where(eq(users.id, targetId));
      res.json({ message: "User berhasil dihapus secara permanen beserta seluruh datanya" });
    } catch (err: any) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // 4.1 Get user documents
  app.get("/api/admin/users/:id/documents", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const documents = [];

      if (user.ktpPhotoUrl) documents.push({ name: "KTP", url: user.ktpPhotoUrl, type: "Profil" });
      if (user.npwpPhotoUrl) documents.push({ name: "NPWP", url: user.npwpPhotoUrl, type: "Profil" });
      if (user.bpjsPhotoUrl) documents.push({ name: "BPJS", url: user.bpjsPhotoUrl, type: "Profil" });
      if (user.kkPhotoUrl) documents.push({ name: "KK", url: user.kkPhotoUrl, type: "Profil" });

      const userMutations = await db.select().from(mutations).where(eq(mutations.userId, targetId));
      for (const m of userMutations) {
        if (m.documentUrl) {
          documents.push({ name: `Surat ${m.type} (${m.createdAt?.toLocaleDateString()})`, url: m.documentUrl, type: "Mutasi" });
        }
      }

      const userWarningLetters = await db.select().from(warningLetters).where(eq(warningLetters.userId, targetId));
      for (const w of userWarningLetters) {
        if (w.documentUrl) {
          documents.push({ name: `Surat Peringatan ${w.type} (${w.startDate})`, url: w.documentUrl, type: "Peringatan" });
        }
      }

      const userResignations = await db.select().from(resignations).where(eq(resignations.userId, targetId));
      for (const r of userResignations) {
        if (r.documentUrl) {
          documents.push({ name: `Surat Resign (${r.resignDate})`, url: r.documentUrl, type: "Resign" });
        }
      }
      
      const userComplaints = await db.select().from(complaints).where(eq(complaints.userId, targetId));
      for (const c of userComplaints) {
        if (c.feedbackDocumentUrl) {
          documents.push({ name: `Dokumen Pengaduan: ${c.title}`, url: c.feedbackDocumentUrl, type: "Pengaduan" });
        }
      }

      res.json(documents);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 5. Shift management
  app.get("/api/shifts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(shifts);
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/shifts", isAdmin, async (req: Request, res: Response) => {
    const { name, checkInTime, checkOutTime, description } = req.body;
    if (!name || !checkInTime || !checkOutTime) {
      return res.status(400).json({ message: "Data shift tidak lengkap" });
    }
    try {
      await db.insert(shifts).values({
        name,
        checkInTime,
        checkOutTime,
        description: description || null,
      });
      res.status(201).json({ message: "Shift berhasil dibuat" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/shifts/:id", isAdmin, async (req: Request, res: Response) => {
    const { name, checkInTime, checkOutTime, description } = req.body;
    try {
      await db.update(shifts)
        .set({
          ...(name && { name }),
          ...(checkInTime && { checkInTime }),
          ...(checkOutTime && { checkOutTime }),
          ...(description !== undefined && { description: description || null }),
        })
        .where(eq(shifts.id, Number(req.params.id)));
      res.json({ message: "Shift berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/shifts/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(shifts).where(eq(shifts.id, Number(req.params.id)));
      res.json({ message: "Shift berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 6. Mutasi, Promosi, Demosi
  app.get("/api/admin/mutations", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(mutations).orderBy(desc(mutations.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/mutations", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, type, oldBranch, newBranch, oldPosition, newPosition, notes } = req.body;
    if (!userId || !type) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const userRole = (req.user as any).role;
      // Only superadmin can upload documents
      const docUrl = (req.file && userRole === 'superadmin') ? await processSingleUpload(req.file, "document", username) : null;
      
      const newMutation = {
        userId: Number(userId),
        type,
        oldBranch: oldBranch || null,
        newBranch: newBranch || null,
        oldPosition: oldPosition || null,
        newPosition: newPosition || null,
        documentUrl: docUrl,
        status: docUrl ? "approved" : "pending",
        notes: notes || null,
      };

      await db.insert(mutations).values(newMutation);

      // If approved, instantly update employee branch and position
      if (newMutation.status === "approved") {
        const updates: any = {};
        if (newBranch) updates.branch = newBranch;
        if (newPosition) updates.position = newPosition;
        if (Object.keys(updates).length > 0) {
          await db.update(users).set(updates).where(eq(users.id, Number(userId)));
        }
      }

      res.status(201).json({ message: docUrl ? "Mutasi berhasil disetujui" : "Pengajuan Mutasi berhasil dicatat (Menunggu Persetujuan)" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/mutations/:id", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { type, newBranch, newPosition, notes, status } = req.body;
    
    try {
      const [existing] = await db.select().from(mutations).where(eq(mutations.id, targetId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

      const updates: any = {};
      if (type) updates.type = type;
      if (newBranch) updates.newBranch = newBranch;
      if (newPosition) updates.newPosition = newPosition;
      if (notes) updates.notes = notes;

      const userRole = (req.user as any).role;
      
      if (status) {
        if (userRole !== 'superadmin' && status !== 'pending') {
          return res.status(403).json({ message: "Hanya Super Admin yang dapat menyetujui" });
        }
        updates.status = status;
      }

      if (req.file) {
        if (userRole !== 'superadmin') {
           return res.status(403).json({ message: "Hanya Super Admin yang dapat mengunggah SK" });
        }
        const username = (req.user as any).username;
        updates.documentUrl = await processSingleUpload(req.file, "document", username);
        updates.status = "approved"; // Automatically approve if document is uploaded
      }

      await db.update(mutations).set(updates).where(eq(mutations.id, targetId));

      // Apply the branch/position change if just approved
      if (updates.status === "approved" || existing.status === "approved") {
         const userUpdates: any = {};
         if (updates.newBranch || existing.newBranch) userUpdates.branch = updates.newBranch || existing.newBranch;
         if (updates.newPosition || existing.newPosition) userUpdates.position = updates.newPosition || existing.newPosition;
         if (Object.keys(userUpdates).length > 0) {
            await db.update(users).set(userUpdates).where(eq(users.id, existing.userId));
         }
      }

      res.json({ message: "Data Mutasi berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/mutations/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      await db.delete(mutations).where(eq(mutations.id, Number(req.params.id)));
      res.json({ message: "Data Mutasi berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/warning-letters", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select({
          id: warningLetters.id,
          userId: warningLetters.userId,
          type: warningLetters.type,
          startDate: warningLetters.startDate,
          endDate: warningLetters.endDate,
          status: warningLetters.status,
          documentUrl: warningLetters.documentUrl,
          notes: warningLetters.notes,
          createdAt: warningLetters.createdAt,
          user: {
            fullName: users.fullName,
            nik: users.nik,
          },
        })
        .from(warningLetters)
        .leftJoin(users, eq(warningLetters.userId, users.id))
        .orderBy(desc(warningLetters.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/warning-letters", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, type, startDate, endDate, notes } = req.body;
    if (!userId || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const docUrl = req.file ? await processSingleUpload(req.file, "document", username) : null;
      await db.insert(warningLetters).values({
        userId: Number(userId),
        type,
        startDate,
        endDate,
        documentUrl: docUrl,
        notes: notes || null,
        status: "pending", // Initially pending for Super Admin approval
      });
      res.status(201).json({ message: "Surat Peringatan berhasil dibuat (Menunggu Persetujuan Super Admin)" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/warning-letters/:id", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { type, startDate, endDate, notes, status } = req.body;
    
    try {
      const updates: any = {};
      if (type) updates.type = type;
      if (startDate) updates.startDate = startDate;
      if (endDate) updates.endDate = endDate;
      if (notes !== undefined) updates.notes = notes;
      
      // Only super admin can approve/reject
      if (status) {
        if ((req.user as any).role !== 'superadmin' && status !== 'pending') {
          return res.status(403).json({ message: "Hanya Super Admin yang dapat mengubah status persetujuan" });
        }
        updates.status = status;
      }

      if (req.file) {
        const username = (req.user as any).username;
        updates.documentUrl = await processSingleUpload(req.file, "document", username);
      }

      await db.update(warningLetters).set(updates).where(eq(warningLetters.id, targetId));
      res.json({ message: "Data Surat Peringatan berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/warning-letters/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      await db.delete(warningLetters).where(eq(warningLetters.id, targetId));
      res.json({ message: "Surat Peringatan berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 8. Resignations
  app.get("/api/admin/resignations", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db
        .select({
          id: resignations.id,
          userId: resignations.userId,
          resignDate: resignations.resignDate,
          reason: resignations.reason,
          status: resignations.status,
          documentUrl: resignations.documentUrl,
          createdAt: resignations.createdAt,
          user: {
            fullName: users.fullName,
            nik: users.nik,
          },
        })
        .from(resignations)
        .leftJoin(users, eq(resignations.userId, users.id))
        .orderBy(desc(resignations.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/resignations", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const { userId, resignDate, reason } = req.body;
    if (!userId || !resignDate || !reason) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    try {
      const username = (req.user as any).username;
      const userRole = (req.user as any).role;
      const docUrl = (req.file && userRole === 'superadmin') ? await processSingleUpload(req.file, "document", username) : null;
      
      const newResignation = {
        userId: Number(userId),
        resignDate,
        reason,
        documentUrl: docUrl,
        status: docUrl ? "approved" : "pending",
      };
      
      await db.insert(resignations).values(newResignation);

      if (newResignation.status === 'approved') {
         await db.update(users).set({ registrationStatus: "rejected" }).where(eq(users.id, Number(userId)));
      }

      res.status(201).json({ message: docUrl ? "Data Resign disetujui" : "Pengajuan Resign berhasil dicatat (Menunggu Persetujuan Super Admin)" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/resignations/:id", isAdmin, upload.single("document"), async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { resignDate, reason, status } = req.body;
    
    try {
      const [existing] = await db.select().from(resignations).where(eq(resignations.id, targetId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Data tidak ditemukan" });

      const updates: any = {};
      if (resignDate) updates.resignDate = resignDate;
      if (reason) updates.reason = reason;
      
      // Only super admin can approve/reject
      if (status) {
        if ((req.user as any).role !== 'superadmin' && status !== 'pending') {
          return res.status(403).json({ message: "Hanya Super Admin yang dapat menyetujui pengajuan" });
        }
        updates.status = status;
        
        // If approved, update user status to rejected (inactive)
        if (status === 'approved') {
           await db.update(users).set({ registrationStatus: "rejected" }).where(eq(users.id, existing.userId));
        }
      }

      if (req.file) {
        if ((req.user as any).role !== 'superadmin') {
           return res.status(403).json({ message: "Hanya Super Admin yang dapat mengunggah dokumen" });
        }
        const username = (req.user as any).username;
        updates.documentUrl = await processSingleUpload(req.file, "document", username);
        updates.status = "approved"; // Automatically approve if document is uploaded
      }

      await db.update(resignations).set(updates).where(eq(resignations.id, targetId));
      
      if (updates.status === 'approved') {
         await db.update(users).set({ registrationStatus: "rejected" }).where(eq(users.id, existing.userId));
      }

      res.json({ message: "Data Resign berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 9. Leave requests validation
  app.get("/api/admin/leave-requests", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/leave-quota — list all employees with leave quota & usage
  app.get("/api/admin/leave-quota", isAdmin, async (req: Request, res: Response) => {
    try {
      const allUsers = await db.select().from(users).where(eq(users.role, "employee"));
      const allLeaves = await db.select().from(leaveRequests);
      
      const year = new Date().getFullYear();
      
      const result = allUsers.map(u => {
        const userLeaves = allLeaves.filter(lr => 
          lr.userId === u.id && 
          lr.status === 'approved' &&
          new Date(lr.createdAt!).getFullYear() === year
        );
        
        let usedDays = 0;
        userLeaves.forEach(lr => {
          if (lr.selectedDates) {
            usedDays += lr.selectedDates.split(',').length;
          } else {
            const start = new Date(lr.startDate);
            const end = new Date(lr.endDate);
            usedDays += Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          }
        });
        
        const quota = (u as any).leaveQuota ?? 12;
        const remaining = Math.max(0, quota - usedDays);
        
        return {
          ...u,
          leaveQuota: quota,
          usedDays,
          remainingDays: remaining,
        };
      });
      
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/admin/leave-quota/:userId — set custom leave quota for a user
  app.patch("/api/admin/leave-quota/:userId", isAdmin, async (req: Request, res: Response) => {
    const targetUserId = Number(req.params.userId);
    const { leaveQuota } = req.body;
    
    if (typeof leaveQuota !== 'number' || leaveQuota < 0 || leaveQuota > 365) {
      return res.status(400).json({ message: "Nilai jatah cuti tidak valid (0-365)" });
    }
    
    try {
      await db.update(users).set({ leaveQuota } as any).where(eq(users.id, targetUserId));
      res.json({ success: true, message: "Jatah cuti berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });



  const updateLeaveStatus = async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { status } = req.body; // "approved", "rejected", "cancelled"

    try {
      // Get the leave request first
      const [leaveReq] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, targetId)).limit(1);
      if (!leaveReq) {
        return res.status(404).json({ message: "Pengajuan cuti tidak ditemukan" });
      }

      await db
        .update(leaveRequests)
        .set({ status })
        .where(eq(leaveRequests.id, targetId));

      // If approved, insert attendance logs for those dates as status = "cuti"
      if (status === "approved") {
        const datesToMark: string[] = [];
        if (leaveReq.selectedDates) {
          // If comma-separated dates are present
          datesToMark.push(...leaveReq.selectedDates.split(",").map(d => d.trim()));
        } else {
          // Add all dates from startDate to endDate
          const start = new Date(leaveReq.startDate);
          const end = new Date(leaveReq.endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            datesToMark.push(d.toISOString().split("T")[0]);
          }
        }

        for (const dateStr of datesToMark) {
          const [exists] = await db
            .select()
            .from(attendance)
            .where(and(eq(attendance.userId, leaveReq.userId), sql`DATE(${attendance.date}) = ${dateStr}`))
            .limit(1);

          if (!exists) {
            await db.insert(attendance).values({
              userId: leaveReq.userId,
              date: dateStr,
              status: "cuti",
              notes: `Cuti Disetujui: ${leaveReq.reason}`,
              sessionNumber: 1,
            });
          } else {
            await db
              .update(attendance)
              .set({ status: "cuti", notes: `Cuti Disetujui: ${leaveReq.reason}` })
              .where(and(eq(attendance.userId, leaveReq.userId), sql`DATE(${attendance.date}) = ${dateStr}`));
          }
        }
      }

      res.json({ message: "Status cuti berhasil diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  };

  app.patch("/api/admin/leave-requests/:id", isAdmin, updateLeaveStatus);
  app.put("/api/admin/leave-requests/:id", isAdmin, updateLeaveStatus);

  app.delete("/api/admin/leave-requests/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      await db.delete(leaveRequests).where(eq(leaveRequests.id, targetId));
      res.json({ message: "Pengajuan cuti berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 10. General Attendance logs retrieval (for rekap filters)
  app.get("/api/admin/attendance", isAdmin, async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    try {
      let query = db.select().from(attendance);
      
      const filters = [];
      if (startDate) {
        filters.push(sql`DATE(${attendance.date}) >= ${startDate}`);
      }
      if (endDate) {
        filters.push(sql`DATE(${attendance.date}) <= ${endDate}`);
      }

      if (filters.length > 0) {
        query = query.where(and(...filters)) as any;
      }

      const list = await query.orderBy(desc(attendance.date), desc(attendance.sessionNumber));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // General Attendance listing endpoint (used widely in frontend)
  app.get("/api/attendance", isAuthenticated, async (req: Request, res: Response) => {
    const { userId: qUserId, month: monthStr, startDate, endDate } = req.query;
    
    // Check role
    const isUserAdmin = (req.user as any).role === "admin" || (req.user as any).role === "superadmin" || (req.user as any).isAdmin === true;
    
    const parsedUserId = qUserId ? Number(Array.isArray(qUserId) ? qUserId[0] : qUserId) : undefined;
    const targetUserId = isUserAdmin ? parsedUserId : (req.user as any).id;

    try {
      let query = db.select().from(attendance);
      const filters = [];

      if (targetUserId) {
        filters.push(eq(attendance.userId, targetUserId));
      }

      if (startDate) {
        filters.push(sql`DATE(${attendance.date}) >= ${startDate}`);
      }
      if (endDate) {
        filters.push(sql`DATE(${attendance.date}) <= ${endDate}`);
      } else if (monthStr) {
        const prefix = String(monthStr);
        filters.push(sql`DATE_FORMAT(${attendance.date}, '%Y-%m') = ${prefix}`);
      }

      if (filters.length > 0) {
        query = query.where(and(...filters)) as any;
      }

      const list = await query.orderBy(desc(attendance.date), desc(attendance.sessionNumber));
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST: Add manual attendance record (admin override)
  app.post("/api/admin/attendance/manual", isAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, date, status, notes, shift, checkIn, checkOut, breakStart, breakEnd } = req.body;
      if (!userId || !date || !status) {
        return res.status(400).json({ message: "Data tidak lengkap" });
      }

      const parsedUserId = Number(userId);

      // Check if record exists for this user and date
      const [existing] = await db
        .select()
        .from(attendance)
        .where(and(eq(attendance.userId, parsedUserId), sql`DATE(${attendance.date}) = ${date}`))
        .limit(1);

      const toDate = (dateStr: string, timeStr: string | undefined): Date | null => {
        if (!timeStr || timeStr.trim() === '') return null;
        return new Date(`${dateStr}T${timeStr}:00+07:00`);
      };

      let record;
      if (existing) {
        const updatePayload: any = {
          status,
          notes: notes || null,
          shift: shift || existing.shift,
        };
        if (checkIn) updatePayload.checkIn = new Date(`${date}T${checkIn}:00+07:00`);
        if (checkOut) updatePayload.checkOut = toDate(date, checkOut);
        if (breakStart) updatePayload.breakStart = toDate(date, breakStart);
        if (breakEnd) updatePayload.breakEnd = toDate(date, breakEnd);

        await db.update(attendance).set(updatePayload).where(eq(attendance.id, existing.id));
        [record] = await db.select().from(attendance).where(eq(attendance.id, existing.id)).limit(1);
      } else {
        const [user] = await db.select().from(users).where(eq(users.id, parsedUserId)).limit(1);
        const insertPayload: any = {
          userId: parsedUserId,
          date: date,
          status,
          notes: notes || "",
          shift: shift || user?.shift || '-',
          sessionNumber: 1,
        };
        if (checkIn) insertPayload.checkIn = new Date(`${date}T${checkIn}:00+07:00`);
        if (checkOut) insertPayload.checkOut = toDate(date, checkOut);
        if (breakStart) insertPayload.breakStart = toDate(date, breakStart);
        if (breakEnd) insertPayload.breakEnd = toDate(date, breakEnd);

        const [result] = await db.insert(attendance).values(insertPayload);
        const insertId = result.insertId;
        [record] = await db.select().from(attendance).where(eq(attendance.id, insertId)).limit(1);
      }

      res.json(record);
    } catch (err: any) {
      console.error("Manual Attendance Error:", err);
      res.status(500).json({ message: "Gagal memproses data absensi" });
    }
  });

  // PUT: Edit existing attendance record (admin override)
  app.put('/api/admin/attendance/:id', isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status, notes, checkIn, checkOut, breakStart, breakEnd, date } = req.body;

    const toDate = (dateStr: string | undefined, timeStr: string | undefined): Date | null => {
      if (!timeStr || timeStr.trim() === '') return null;
      return new Date(`${dateStr}T${timeStr}:00+07:00`);
    };

    try {
      const updatePayload: any = {};
      if (status) updatePayload.status = status;
      updatePayload.notes = notes || null;
      if (checkIn) updatePayload.checkIn = new Date(`${date}T${checkIn}:00+07:00`);
      if (checkOut !== undefined) updatePayload.checkOut = toDate(date, checkOut);
      if (breakStart !== undefined) updatePayload.breakStart = toDate(date, breakStart);
      if (breakEnd !== undefined) updatePayload.breakEnd = toDate(date, breakEnd);

      await db.update(attendance).set(updatePayload).where(eq(attendance.id, id));
      
      const [updated] = await db.select().from(attendance).where(eq(attendance.id, id)).limit(1);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE: Remove an attendance record
  app.delete('/api/admin/attendance/:id', isAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      // First delete associated overtimes if any
      await db.delete(overtimes).where(eq(overtimes.attendanceId, id));
      // Then delete attendance record
      await db.delete(attendance).where(eq(attendance.id, id));
      res.json({ message: "Data absensi berhasil dihapus", id });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Gagal menghapus data absensi" });
    }
  });

  // --- Push Notifications ---
  app.get("/api/push/public-key", (req: Request, res: Response) => {
    if (!vapidPublicKey) {
      return res.status(500).json({ message: "VAPID key is not configured" });
    }
    res.json({ publicKey: vapidPublicKey });
  });

  app.post("/api/push/subscribe", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const subscription = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      // Check if subscription already exists for this user and endpoint
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, req.user!.id), eq(pushSubscriptions.endpoint, subscription.endpoint)))
        .limit(1);

      if (!existing) {
        await db.insert(pushSubscriptions).values({
          userId: req.user!.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        });
      }

      res.status(201).json({ message: "Subscription saved." });
    } catch (e) {
      console.error("Push Subscribe Error:", e);
      res.status(500).json({ message: "Server error" });
    }
  });

  // 11. Complaints listing for admin
  app.get("/api/admin/fix-complaints-time", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(complaints);
      let fixed = 0;
      for (const comp of list) {
        if (comp.createdAt) {
          // If the time is 8 hours ahead, subtract 8 hours.
          // Wait, if real time is 0:53, and DB has 08:53, it's exactly 8 hours ahead.
          // But I'll just subtract 8 hours from any complaint created BEFORE July 14 2026 12:00
          // to be safe.
          const date = new Date(comp.createdAt);
          if (date.getTime() > Date.now()) { // If it's in the future (like 8 hours ahead)
             const newDate = new Date(date.getTime() - 8 * 60 * 60 * 1000);
             await db.update(complaints).set({ createdAt: newDate }).where(eq(complaints.id, comp.id));
             fixed++;
          }
        }
      }
      res.json({ fixed });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/complaints", isAdmin, async (req: Request, res: Response) => {
    try {
      const list = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
      
      const response = [];
      for (const comp of list) {
        const photos = await db.select().from(complaintPhotos).where(eq(complaintPhotos.complaintId, comp.id));
        // Also fetch user info
        const [userInfo] = await db.select({ fullName: users.fullName, nik: users.nik }).from(users).where(eq(users.id, comp.userId)).limit(1);
        response.push({ ...comp, photos, userFullName: userInfo?.fullName || null });
      }
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/admin/complaints/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { status } = req.body; // "pending", "reviewed", "resolved"
    try {
      await db.update(complaints).set({ status }).where(eq(complaints.id, targetId));
      res.json({ message: "Status komplain diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH alias for client compatibility
  app.patch("/api/admin/complaints/:id/status", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    const { status, adminFeedback, feedbackDocumentUrl } = req.body; 
    try {
      if (!["pending", "reviewed", "resolved"].includes(status)) {
        return res.status(400).json({ message: "Status tidak valid" });
      }
      
      const updateData: any = { status };
      if (status === "resolved") {
        updateData.resolvedAt = new Date();
        if (adminFeedback !== undefined) updateData.adminFeedback = adminFeedback;
        if (feedbackDocumentUrl !== undefined) updateData.feedbackDocumentUrl = feedbackDocumentUrl;
      }

      await db.update(complaints).set(updateData).where(eq(complaints.id, targetId));
      res.json({ message: "Status komplain diperbarui" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/complaints/:id", isAdmin, async (req: Request, res: Response) => {
    const targetId = Number(req.params.id);
    try {
      // Delete associated photos first
      await db.delete(complaintPhotos).where(eq(complaintPhotos.complaintId, targetId));
      // Delete the complaint
      await db.delete(complaints).where(eq(complaints.id, targetId));
      res.json({ message: "Pengaduan berhasil dihapus" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Multer configuration for SQL files
  const sqlUpload = multer({
    dest: "uploads/",
    fileFilter: (req, file, cb) => {
      if (path.extname(file.originalname).toLowerCase() === ".sql") {
        cb(null, true);
      } else {
        cb(new Error("Hanya file SQL yang diperbolehkan") as any, false);
      }
    }
  });

  // Database Backup Listing
  app.get("/api/admin/backups", isAuthenticated, isSuperAdmin, (req: Request, res: Response) => {
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      const files = fs.readdirSync(backupDir);
      const backupList = files
        .filter(f => f.endsWith(".sql"))
        .map(f => {
          const stats = fs.statSync(path.join(backupDir, f));
          return {
            fileName: f,
            sizeBytes: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json(backupList);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Database Manual Backup Creation
  app.post("/api/admin/backup", isAuthenticated, isSuperAdmin, async (req: Request, res: Response) => {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ success: false, message: "DATABASE_URL tidak dikonfigurasi" });
    }

    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      const regex = /mysql:\/\/([^:]+):([^@]+)@([^/:]+)(?::(\d+))?\/(.+)/;
      const matches = dbUrl.match(regex);
      if (!matches) {
        return res.status(500).json({ success: false, message: "Format DATABASE_URL tidak dikenal" });
      }

      const [_, user, password, host, portStr, database] = matches;
      const port = portStr || "3306";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `backup-${database}-${timestamp}.sql`;
      const outputFile = path.join(backupDir, fileName);

      const cmd = `mysqldump -h ${host} -P ${port} -u ${user} -p"${password}" ${database} > "${outputFile}"`;

      exec(cmd, (error) => {
        if (error) {
          console.error(`[Manual Backup] Failed: ${error.message}`);
          return res.status(500).json({ success: false, message: `Gagal membuat backup: ${error.message}` });
        } else {
          console.log(`[Manual Backup] Success: ${fileName}`);
          return res.json({ success: true, message: "Backup database berhasil dibuat", fileName });
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Download SQL Backup File
  app.get("/api/admin/backups/download/:fileName", isAuthenticated, isSuperAdmin, (req: Request, res: Response) => {
    const backupDir = path.resolve(process.cwd(), "backups");
    const filePath = path.join(backupDir, req.params.fileName);

    if (!filePath.startsWith(backupDir)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ message: "File backup tidak ditemukan" });
    }
  });

  // Import SQL Database file
  app.post("/api/admin/backups/import", isAuthenticated, isSuperAdmin, sqlUpload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "File SQL wajib diunggah" });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ message: "DATABASE_URL tidak dikonfigurasi" });
    }

    const filePath = req.file.path;

    try {
      const regex = /mysql:\/\/([^:]+):([^@]+)@([^/:]+)(?::(\d+))?\/(.+)/;
      const matches = dbUrl.match(regex);
      if (!matches) {
        return res.status(500).json({ message: "Format DATABASE_URL tidak dikenal" });
      }

      const [_, user, password, host, portStr, database] = matches;
      const port = portStr || "3306";

      const cmd = `mysql -h ${host} -P ${port} -u ${user} -p"${password}" ${database} < "${filePath}"`;

      exec(cmd, (error) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        if (error) {
          console.error(`[Restore Database] Failed: ${error.message}`);
          return res.status(500).json({ message: `Gagal memulihkan database: ${error.message}` });
        } else {
          console.log(`[Restore Database] Success restoration`);
          return res.json({ success: true, message: "Database berhasil di-import/dipulihkan!" });
        }
      });
    } catch (e: any) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      res.status(500).json({ message: e.message });
    }
  });
}
