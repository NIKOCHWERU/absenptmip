import fs from 'fs';

let file = fs.readFileSync('client/src/pages/admin/AdminLeavePage.tsx', 'utf8');

// 1. Get config.alamatPt
file = file.replace('const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PTABC";',
'const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PTABC";\n        const alamatPt = config?.alamatPt || "";');

// 2. Change CSS for letterhead
file = file.replace(/    \.letterhead \{ display: flex; flex-direction: row; align-items: center; text-align: left; margin-bottom: 10px; gap: 20px; \}\n    \.logo-img \{ width: 90px; height: 90px; object-fit: contain; \}\n    \.company-info \{ display: flex; flex-direction: column; justify-content: center; \}\n    \.company-name \{ font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; \}\n    \.company-tagline \{ font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #475569; font-weight: bold; \}/g,
`    .letterhead { display: flex; flex-direction: row; align-items: center; text-align: center; margin-bottom: 10px; }
    .logo-container { width: 90px; flex-shrink: 0; }
    .logo-img { width: 90px; height: 90px; object-fit: contain; }
    .company-info { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-right: 90px; }
    .company-name { font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .company-tagline { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: normal; margin-bottom: 2px; }
    .company-address { font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: normal; font-style: italic; color: #334155; }`);

// 3. Change HTML structure
file = file.replace(/  <div class="letterhead">\n    \$\{logoDataUrl \? \`<img src="\$\{logoDataUrl\}" class="logo-img" alt="Logo" \/>\` : ''\}\n    <div class="company-info">\n      <div class="company-name">\$\{namaPt\}<\/div>\n      <div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital<\/div>\n    <\/div>\n  <\/div>/g,
`  <div class="letterhead">
    <div class="logo-container">
      \${logoDataUrl ? \`<img src="\${logoDataUrl}" class="logo-img" alt="Logo" />\` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">\${namaPt}</div>
      \${alamatPt ? \`<div class="company-address">\${alamatPt}</div>\` : \`<div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital</div>\`}
    </div>
  </div>`);

fs.writeFileSync('client/src/pages/admin/AdminLeavePage.tsx', file);
