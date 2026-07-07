const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./client/src');
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Convert onSuccess: () => to onSuccess: async () =>
    content = content.replace(/onSuccess:\s*\(\)\s*=>\s*\{/g, 'onSuccess: async () => {');
    // Convert onSuccess: (data) => to onSuccess: async (data) =>
    content = content.replace(/onSuccess:\s*\(([^)]+)\)\s*=>\s*\{/g, 'onSuccess: async ($1) => {');
    
    // Prefix queryClient.invalidateQueries with await if not already
    // Use a regex that checks if 'await ' is missing before 'queryClient'
    content = content.replace(/(?<!await\s+)queryClient\.invalidateQueries/g, 'await queryClient.invalidateQueries');

    if (content !== original) {
        fs.writeFileSync(file, content);
        changedCount++;
        console.log("Updated", file);
    }
});

console.log(`Updated ${changedCount} files.`);
