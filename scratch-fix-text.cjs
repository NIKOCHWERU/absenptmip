const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('/home/niko/Desktop/Kantor/Aplikasi/PT MEKANO INDUSTRIAL PRESISI/APLIKASI ABSENSI/client/src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let lines = content.split('\n');
        let changed = false;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // If the line contains text-primary-foreground AND a light background
            if (line.includes('text-primary-foreground') && (line.includes('bg-primary/5') || line.includes('bg-primary/10') || line.includes('bg-blue-50') || line.includes('bg-amber-50') || line.includes('bg-red-50') || line.includes('bg-green-50'))) {
                lines[i] = line.replace(/text-primary-foreground/g, 'text-primary');
                changed = true;
            } else if (line.includes('text-primary-foreground') && line.includes('text-[11px]')) {
                // Specific fix for some occurrences
                lines[i] = line.replace(/text-primary-foreground/g, 'text-primary');
                changed = true;
            }
        }
        
        if (changed) {
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
            console.log('Fixed ' + filePath);
        }
    }
});
