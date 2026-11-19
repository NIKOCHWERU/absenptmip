# 🛠️ Panduan Lengkap Developer & Master Prompt Antigravity

Panduan satu pintu untuk mengelola **Aplikasi Absensi Karyawan** (`absen-ptmip`), mulai dari **setup VPS dari nol, domain & SSL HTTPS, maintenance harian**, hingga **kumpulan template prompt Antigravity ramah orang awam** (untuk buat/clone PT baru, edit fitur, dan menangani komplain klien).

---

## 📑 Daftar Isi
1. [Ringkasan Arsitektur Aplikasi](#-1-ringkasan-arsitektur-aplikasi)
2. [Setup VPS & Clone Repository dari Nol](#-2-setup-vps--clone-repository-dari-nol)
3. [Setup Domain & SSL HTTPS (Nginx + Certbot)](#-3-setup-domain--ssl-https-nginx--certbot)
4. [SOP Maintenance, Cek Error & Update VPS](#-4-sop-maintenance-cek-error--update-vps)
5. [Master Prompt Antigravity (Ramah Orang Awam)](#-5-master-prompt-antigravity-ramah-orang-awam)
   - [Template Utama (Form Ringkas)](#template-utama-form-ringkas)
   - [Prompt 1: Clone & Buat PT Baru / Setup VPS & Domain](#1%EF%B8%8F%E2%83%A3-prompt-1-clone--buat-untuk-pt-baru--setup-vps--domain)
   - [Prompt 2: Edit / Tambah Fitur / Update Aplikasi](#2%EF%B8%8F%E2%83%A3-prompt-2-edit--tambah-fitur--update-aplikasi)
   - [Prompt 3: Menangani Komplain / Error Klien](#3%EF%B8%8F%E2%83%A3-prompt-3-menangani-komplain--error-dari-klien)
6. [Contoh Penggunaan Nyata (Step-by-Step)](#-6-contoh-penggunaan-nyata-step-by-step)
7. [Cheat Sheet Perintah Cepat VPS](#-7-cheat-sheet-perintah-cepat-vps)

---

## 📋 1. Ringkasan Arsitektur Aplikasi

- **Repository GitHub**: `https://github.com/NIKOCHWERU/absenptmip.git` (`git@github.com:NIKOCHWERU/absenptmip.git`)
- **Tech Stack**:
  - **Frontend**: React + TypeScript + Vite + Tailwind CSS (`client/`)
  - **Backend**: Express.js + TypeScript via `tsx` (`server/index.ts`)
  - **Database**: MySQL + Drizzle ORM (`shared/schema.ts`, `drizzle.config.ts`)
- **Direktori Production VPS**: `/var/www/absensi-pt-mip`
- **Process Manager**: PM2 (`ecosystem.config.cjs`, nama app: `absen-ptmip`, Port: `3008`)
- **Web Server / Reverse Proxy**: Nginx + Certbot (HTTPS)

---

## 🚀 2. Setup VPS & Clone Repository dari Nol

Asumsi VPS menggunakan **Ubuntu 22.04 / 24.04 LTS** dengan akses `root` atau user `sudo`.

### 2.1 Update Sistem & Install Tools Dasar
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx mysql-server
```

### 2.2 Install Node.js (v20 LTS) & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

sudo npm install -g pm2
```

### 2.3 Setup Database MySQL
```bash
sudo mysql
```
Jalankan query SQL berikut di prompt MySQL:
```sql
CREATE DATABASE absen_ptmip CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'absen_user'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT_ANDA';
GRANT ALL PRIVILEGES ON absen_ptmip.* TO 'absen_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2.4 Clone Repository ke `/var/www/absensi-pt-mip`
```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/NIKOCHWERU/absenptmip.git absensi-pt-mip
sudo chown -R $USER:$USER /var/www/absensi-pt-mip
cd /var/www/absensi-pt-mip
```
*(Jika repo private, pastikan SSH Key VPS sudah didaftarkan ke GitHub dan gunakan `git@github.com:NIKOCHWERU/absenptmip.git`).*

### 2.5 Konfigurasi File `.env`
Buat file `.env` di `/var/www/absensi-pt-mip/.env`:
```bash
nano .env
```
Isi dengan konfigurasi berikut:
```env
NODE_ENV=production
PORT=3008
DATABASE_URL=mysql://absen_user:GANTI_PASSWORD_KUAT_ANDA@localhost:3306/absen_ptmip
SESSION_SECRET=isi_string_acak_panjang_minimal_32_karakter
```
Simpan (`Ctrl + O`, `Enter`, `Ctrl + X`).

### 2.6 Install Dependencies, Push Schema DB, Build & Jalankan PM2
```bash
cd /var/www/absensi-pt-mip

# 1. Install package
npm install

# 2. Sinkronkan schema tabel MySQL
npm run db:push

# 3. Build frontend (output ke dist/public)
npm run build

# 4. Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.cjs

# 5. Simpan daftar PM2 agar otomatis jalan saat VPS reboot
pm2 save
pm2 startup
```
*(Jika `pm2 startup` menampilkan perintah `sudo env PATH=...`, copy & jalankan perintah tersebut).*

Cek status aplikasi:
```bash
pm2 status
pm2 logs absen-ptmip --lines 30
```

---

## 🌐 3. Setup Domain & SSL HTTPS (Nginx + Certbot)

Pastikan DNS domain Anda (misal `absen.ptmip.com`) sudah diarahkan (`A Record`) ke **IP Publik VPS** Anda.

### 3.1 Buat Konfigurasi Nginx
```bash
sudo nano /etc/nginx/sites-available/absen-ptmip
```
Masukkan konfigurasi berikut:
```nginx
server {
    listen 80;
    server_name absen.ptmip.com;

    # Penting untuk upload foto absensi & dokumen pendaftaran ukuran besar
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3008;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3.2 Aktifkan Site & Pasang SSL HTTPS
Kamera HP & GPS browser **wajib HTTPS** agar fitur absensi foto & lokasi bisa berjalan:
```bash
sudo ln -s /etc/nginx/sites-available/absen-ptmip /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d absen.ptmip.com
```

---

## 🔧 4. SOP Maintenance, Cek Error & Update VPS

### 4.1 Alur Standar Update Aplikasi di VPS
Setiap kali ada perbaikan/fitur baru yang sudah di-*push* ke GitHub (`origin/main`), jalankan 1 baris perintah ini di VPS:
```bash
cd /var/www/absensi-pt-mip && git pull origin main && npm run build && pm2 restart all
```
- Jika ada package baru di `package.json`: tambahkan `npm install` sebelum `npm run build`.
- Jika ada perubahan tabel database: jalankan `npm run db:push`.

### 4.2 SOP Cek Error Sebelum Lapor ke Antigravity
1. **Cek Log Error Server (PM2)**:
   ```bash
   pm2 logs absen-ptmip --lines 100
   ```
2. **Cek Error Browser (Frontend)**:
   - Tekan `F12` di browser $\rightarrow$ buka tab **Console** dan **Network** (lihat yang berwarna merah / status `400` atau `500`).
3. **Backup Database MySQL Manual (Sebelum Perubahan Besar)**:
   ```bash
   mysqldump -u absen_user -p absen_ptmip > backup_absen_$(date +%Y%m%d).sql
   ```

---

## 🤖 5. Master Prompt Antigravity (Ramah Orang Awam)

Cukup *copy-paste* template di bawah ini ke chat **Antigravity** dan isi bagian di dalam tanda `[ ... ]`.

### Template Utama (Form Ringkas)

```text
Git Repo   : [Isi link GitHub, misal: https://github.com/NIKOCHWERU/absenptmip.git]
Keperluan  : [Pilih salah satu:
              1. Clone & Buat untuk PT Baru (Rebranding + VPS + Domain)
              2. Clone & Setup VPS/Domain Baru (Tanpa ganti PT)
              3. Edit / Tambah Fitur Aplikasi
              4. Update Aplikasi di VPS
              5. Menangani Komplain / Error Klien]

Detail     : [Isi singkat kebutuhan Anda, atau tempel screenshot / pesan error]

ATURAN WAJIB UNTUK ANTIGRAVITY:
1. Pandu saya SATU LANGKAH demi SATU LANGKAH dengan bahasa yang mudah dipahami orang awam.
2. Di SETIAP pertanyaan atau langkah, selalu akhiri dengan menanyakan:
   "Apakah Anda sudah paham dengan langkah ini?"
   Jika saya belum paham, jelaskan lebih sederhana dulu sebelum lanjut.
3. Jangan ubah kode sebelum menjelaskan penyebab/dampaknya dan mendapat persetujuan saya.
```

---

### 1️⃣ PROMPT 1: Clone & Buat untuk PT Baru / Setup VPS & Domain

*Gunakan saat ingin memasang aplikasi di VPS baru atau membuat versi untuk perusahaan/PT lain:*

```text
Git Repo   : [https://github.com/NIKOCHWERU/absenptmip.git atau link repo baru]
Keperluan  : [Pilih: Clone & Buat untuk PT Baru / Clone & Setup VPS & Domain]

Data yang sudah saya siapkan (kosongkan jika belum ada, nanti tanyakan ke saya):
- Ganti Identitas PT Baru? : [Iya / Tidak]
- Nama PT Lengkap          : [misal: PT Maju Jaya Sejahtera]
- Singkatan PT             : [misal: PT MJS]
- Alamat & Kota PT         : [misal: Jl. Industri No. 10, Karawang]
- Kode Daftar Karyawan     : [misal: MJS2026]
- Domain Baru              : [misal: absen.ptmjs.com]
- IP VPS & OS              : [misal: 103.xx.xx.xx - Ubuntu 22.04]

Posisikan kamu sebagai Senior Developer & DevOps yang membimbing orang awam dari nol sampai aplikasi benar-benar berjalan online (work 100%).

ATURAN WAJIB:
1. Jika ada data di atas yang masih kosong atau belum jelas, tanyakan ke saya dulu dengan rinci.
   - Jika saya pilih TIDAK ganti PT, langsung lanjut ke setup VPS, Database, Domain & SSL.
   - Jika saya pilih IYA ganti PT baru, bantu ubah identitas PT, logo, kode pendaftaran, nama database MySQL, nama PM2, dan port-nya.
2. Pandu saya PER STEP (jangan semua perintah sekaligus).
3. Di SETIAP pertanyaan atau langkah, selalu tanya:
   "Apakah Anda sudah paham dengan langkah ini, atau perlu saya jelaskan lebih sederhana?"
4. Tunjukkan setup lengkap sampai HTTPS aktif (agar kamera & GPS HP bisa dipakai absen).
```

---

### 2️⃣ PROMPT 2: Edit / Tambah Fitur / Update Aplikasi

*Gunakan saat ingin mengubah tampilan, menambah fitur baru, atau mengubah aturan perhitungan absensi/rekap:*

```text
Git Repo   : [https://github.com/NIKOCHWERU/absenptmip.git]
Keperluan  : Edit / Tambah Fitur / Update Aplikasi
Halaman    : [Misal: Rekap Absensi Admin / Dashboard Karyawan / Pendaftaran]
Permintaan : [Jelaskan dengan bahasa sehari-hari fitur atau perubahan yang diinginkan]

Posisikan kamu sebagai Developer utama aplikasi ini.
ATURAN WAJIB:
1. Periksa kodenya dulu, lalu JELASKAN ke saya dengan bahasa awam:
   - Cara kerja saat ini seperti apa?
   - Apa saja yang akan berubah & apakah aman untuk absensi karyawan yang sedang berjalan?
   - Jika ada beberapa cara, berikan 2-3 opsi pilihan.
2. Tanya dulu ke saya apakah saya sudah paham dan boleh langsung dikerjakan. Jangan edit kode sebelum saya setuju.
3. Setelah saya setuju dan selesai dikerjakan: pastikan tidak ada error build, push ke GitHub (`origin/main`), lalu berikan perintah 1 baris untuk saya jalankan di VPS:
   `git pull origin main && npm run build && pm2 restart all`
   (Beri tahu juga jika perlu `npm run db:push` atau edit `.env`).
```

---

### 3️⃣ PROMPT 3: Menangani Komplain / Error dari Klien

*Gunakan saat klien mengirim keluhan atau screenshot error (tinggal tempel screenshot di chat Antigravity):*

```text
Git Repo   : [https://github.com/NIKOCHWERU/absenptmip.git]
Keperluan  : Menangani Komplain Klien

Komplain: "[Tempel keluhan klien, misal: Bapak/Ibu, kenapa tiba-tiba tidak bisa login?]" (lihat screenshot terlampir).

Perbaiki masalah di atas dan jelaskan dulu mengapa terjadi.
Jelaskan penyebabnya secara singkat dan rinci dengan bahasa awam, beri tahu cara ceknya jika perlu, lalu tanya ke saya dulu apa langkah perbaikannya ingin dijalankan sekarang. Jangan ubah kode sebelum saya setuju.
```

---

## 📖 6. Contoh Penggunaan Nyata (Step-by-Step)

### 🔹 Contoh A: Menangani Komplain Klien (Pakai Screenshot)

**1. Klien chat ke Anda + kirim screenshot:**
> *"Bapak/Ibu, kenapa tiba-tiba tidak bisa login?"*

**2. Anda copy-paste ke Antigravity (sambil tempel screenshot):**
```text
Git Repo   : https://github.com/NIKOCHWERU/absenptmip.git
Keperluan  : Menangani Komplain Klien

Komplain: "Bapak/Ibu, kenapa tiba-tiba tidak bisa login?" (lihat screenshot terlampir).

Perbaiki masalah di atas dan jelaskan dulu mengapa terjadi.
Jelaskan penyebabnya secara singkat dan rinci dengan bahasa awam, beri tahu cara ceknya jika perlu, lalu tanya ke saya dulu apa langkah perbaikannya ingin dijalankan sekarang. Jangan ubah kode sebelum saya setuju.
```

**3. Antigravity memandu cara cek (jika butuh cek server):**
> *"Dari screenshot tersebut, muncul error `502 Bad Gateway` / gagal terhubung ke server. Artinya website-nya bisa diakses, tapi mesin aplikasi di VPS sedang mati.*
> *Silakan buka terminal VPS lalu jalankan perintah ini untuk melihat penyebabnya:*
> `pm2 status && pm2 logs absen-ptmip --lines 30`
> *Apakah Anda sudah paham cara menjalankan perintah ini di VPS?"*

**4. Anda kirim hasil log ke Antigravity, lalu Antigravity menjelaskan penyebab & solusinya:**
> *"Penyebabnya sudah ketemu: [penjelasan singkat dengan bahasa awam].*
> *Langkah perbaikannya: [penjelasan perbaikan kode/server].*
> *Apakah Anda sudah paham dan ingin langkah perbaikannya dijalankan sekarang?"*

**5. Anda jawab `"Paham, jalankan"` $\rightarrow$ Antigravity perbaiki & push ke GitHub $\rightarrow$ Anda jalankan di VPS:**
```bash
git pull origin main && npm run build && pm2 restart all
```
*(Lalu tes login ulang dan kabari klien bahwa aplikasi sudah normal).*

---

### 🔹 Contoh B: Clone & Buat untuk PT Baru

**1. Anda isi & kirim Prompt 1:**
> - **Git Repo**: `https://github.com/NIKOCHWERU/absenptmip.git`
> - **Keperluan**: `Clone & Buat untuk PT Baru`
> - **Nama PT**: `PT Karya Mandiri (PT KM)`, **Domain**: `absen.ptkm.co.id`, **IP VPS**: `103.xx.xx.xx`

**2. Antigravity memandu satu per satu:**
- **Step 1**: Cara login ke VPS (`ssh root@103.xx.xx.xx`) + tanya *"Apakah Anda sudah paham?"*
- **Step 2**: Install Node.js, MySQL, Nginx, PM2 + tanya *"Apakah Anda sudah paham?"*
- **Step 3**: Clone repo & ganti identitas PT baru + tanya *"Apakah Anda sudah paham?"*
- **Step 4**: Buat `.env`, `npm install`, `npm run db:push`, `npm run build`, `pm2 start` + tanya *"Apakah Anda sudah paham?"*
- **Step 5**: Setting Domain Nginx & SSL HTTPS (`certbot`) sampai bisa dibuka di HP karyawan!

---

### 🔹 Contoh C: Edit / Tambah Fitur Baru

**1. Anda isi & kirim Prompt 2:**
> - **Halaman**: `Rekap Absensi Admin`
> - **Permintaan**: `Tolong tambahkan kolom Jabatan di file Excel yang di-export.`

**2. Antigravity jelaskan dulu bagian kode Excel yang akan diubah & dampaknya, lalu tanya:**
> *"Apakah Anda sudah paham dan boleh langsung saya kerjakan?"*

**3. Anda jawab `"Lanjut"` $\rightarrow$ Antigravity edit, push ke GitHub, lalu Anda jalankan di VPS:**
```bash
git pull origin main && npm run build && pm2 restart all
```

---

## ⚡ 7. Cheat Sheet Perintah Cepat VPS

| Kebutuhan | Perintah di Terminal VPS |
| :--- | :--- |
| **Update Aplikasi (Rutin)** | `cd /var/www/absensi-pt-mip && git pull origin main && npm run build && pm2 restart all` |
| **Cek Status Aplikasi** | `pm2 status` |
| **Lihat Log Error Live** | `pm2 logs absen-ptmip --lines 50` |
| **Restart Aplikasi Saja** | `pm2 restart absen-ptmip` |
| **Push Perubahan Tabel DB** | `npm run db:push` |
| **Cek Status Nginx** | `sudo systemctl status nginx` |
| **Cek SSL / Perpanjang** | `sudo certbot renew --dry-run` |
| **Cek Disk & RAM VPS** | `df -h && free -m` |

---
*Disusun sebagai panduan resmi Developer, Maintainer & Pengguna Antigravity untuk Aplikasi Absensi PT MIP.*
