import fs from 'fs';

let file = fs.readFileSync('client/src/pages/admin/AdminSettingsPage.tsx', 'utf8');

// 1. Add useState for alamatPt
file = file.replace('const [namaPt, setNamaPt] = useState("");',
'const [namaPt, setNamaPt] = useState("");\n  const [alamatPt, setAlamatPt] = useState("");');

// 2. Add to useEffect
file = file.replace('setNamaPt(config.namaPt || "");',
'setNamaPt(config.namaPt || "");\n      setAlamatPt(config.alamatPt || "");');

// 3. Add to mutation payload
file = file.replace('namaPt,',
'namaPt,\n      alamatPt,');

// 4. Add UI field
const fieldHTML = `              <div className="space-y-2">
                <Label htmlFor="alamatPt">Alamat Perusahaan</Label>
                <Input
                  id="alamatPt"
                  value={alamatPt}
                  onChange={(e) => setAlamatPt(e.target.value)}
                  placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
                />
              </div>`;

file = file.replace('              <div className="space-y-2">\n                <Label htmlFor="singkatanPt">Singkatan PT</Label>',
fieldHTML + '\n              <div className="space-y-2">\n                <Label htmlFor="singkatanPt">Singkatan PT</Label>');

fs.writeFileSync('client/src/pages/admin/AdminSettingsPage.tsx', file);
