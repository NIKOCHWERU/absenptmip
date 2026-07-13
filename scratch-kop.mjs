import fs from 'fs';
import path from 'path';

const files = [
  'client/src/pages/admin/AdminLeavePage.tsx',
  'client/src/pages/admin/AttendanceHistoryPage.tsx',
  'client/src/pages/admin/AttendanceSummaryPage.tsx',
  'client/src/pages/admin/RecapPage.tsx',
  'client/src/pages/admin/AdminLeaveHistoryPage.tsx',
  'client/src/components/ui/sidebar.tsx'
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');

  if (f.endsWith('sidebar.tsx')) {
    content = content.replace('const SIDEBAR_WIDTH = "16rem"', 'const SIDEBAR_WIDTH = "18rem"');
  } else {
    // Inject alamatPt var
    if (!content.includes('const alamatPt = config?.alamatPt || "";')) {
       content = content.replace('const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PTABC";', 
                                 'const singkatanPt = config?.singkatanPt || import.meta.env.VITE_SINGKATAN_PT || "PTABC";\n        const alamatPt = config?.alamatPt || "";');
    }

    // Replace CSS for letterhead
    // We want Logo | Nama PT
    //              | Alamat PT
    // So text-align left, row layout.
    const newCss = `    .letterhead { display: flex; flex-direction: row; align-items: center; text-align: left; margin-bottom: 10px; gap: 20px; }
    .logo-container { width: 90px; flex-shrink: 0; }
    .logo-img { width: 90px; height: 90px; object-fit: contain; }
    .company-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .company-name { font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .company-tagline { font-size: 13px; font-weight: normal; margin-bottom: 2px; }
    .company-address { font-size: 11px; font-weight: normal; font-style: italic; color: #334155; }`;

    // Handle AdminLeavePage which already has logo-container
    if (content.includes('.logo-container')) {
       content = content.replace(/    \.letterhead \{ display: flex; flex-direction: row; align-items: center; text-align: center; margin-bottom: 10px; \}\n    \.logo-container \{ width: 90px; flex-shrink: 0; \}\n    \.logo-img \{ width: 90px; height: 90px; object-fit: contain; \}\n    \.company-info \{ flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-right: 90px; \}\n    \.company-name \{ font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; \}\n    \.company-tagline \{ font-size: 13px; font-weight: normal; margin-bottom: 2px; \}\n    \.company-address \{ font-size: 11px; font-weight: normal; font-style: italic; color: #334155; \}/, newCss);
    } else {
       // Old CSS
       content = content.replace(/    \.letterhead \{ display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 10px; \}\n    \.logo-img \{ width: 60px; height: 60px; object-fit: contain; margin-bottom: 6px; \}\n    \.company-name \{ font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; \}\n    \.company-tagline \{ font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #475569; font-weight: bold; \}/, newCss);
    }
    
    // Some other files might not have font-family in CSS, let's catch both
    content = content.replace(/    \.letterhead \{ display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 10px; \}\n    \.logo-img \{ width: 60px; height: 60px; object-fit: contain; margin-bottom: 6px; \}\n    \.company-name \{ font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; \}\n    \.company-tagline \{ font-size: 10px; color: #475569; font-weight: bold; \}/, newCss);

    // Replace HTML
    const newHtml = `  <div class="letterhead">
    <div class="logo-container">
      \${logoDataUrl ? \`<img src="\${logoDataUrl}" class="logo-img" alt="Logo" />\` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">\${namaPt}</div>
      \${alamatPt ? \`<div class="company-address">\${alamatPt}</div>\` : \`<div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital</div>\`}
    </div>
  </div>`;

    if (!content.includes('<div class="logo-container">')) {
       content = content.replace(/  <div class="letterhead">\n    \$\{logoDataUrl \? \`<img src="\$\{logoDataUrl\}" class="logo-img" alt="Logo" \/>\` : ''\}\n    <div class="company-name">\$\{namaPt\}<\/div>\n    <div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital<\/div>\n  <\/div>/g, newHtml);
    } else {
       // Already has logo-container, maybe AdminLeavePage
       content = content.replace(/  <div class="letterhead">\n    <div class="logo-container">\n      \$\{logoDataUrl \? \`<img src="\$\{logoDataUrl\}" class="logo-img" alt="Logo" \/>\` : ''\}\n    <\/div>\n    <div class="company-info">\n      <div class="company-name">\$\{namaPt\}<\/div>\n      \$\{alamatPt \? \`<div class="company-address">\$\{alamatPt\}<\/div>\` : \`<div class="company-tagline">Sistem Manajemen Kehadiran & Tenaga Kerja Digital<\/div>\`\}\n    <\/div>\n  <\/div>/g, newHtml);
    }
  }

  fs.writeFileSync(f, content);
}
