import fs from 'fs';

let file = fs.readFileSync('server/routes.ts', 'utf8');

// 1. Add alamatPt to POST /api/config req.body destructuring
file = file.replace('namaPt, singkatanPt, deskripsiPwa, logoUrl, logoInisial, rekapPrefix,',
'namaPt, singkatanPt, deskripsiPwa, alamatPt, logoUrl, logoInisial, rekapPrefix,');

// 2. Add saving alamatPt
file = file.replace('if (deskripsiPwa !== undefined) configsToSave.push({ key: "deskripsiPwa", value: String(deskripsiPwa) });',
'if (deskripsiPwa !== undefined) configsToSave.push({ key: "deskripsiPwa", value: String(deskripsiPwa) });\n      if (alamatPt !== undefined) configsToSave.push({ key: "alamatPt", value: String(alamatPt) });');

fs.writeFileSync('server/routes.ts', file);
