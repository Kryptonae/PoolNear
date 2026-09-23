const fs = require('fs');
const path = require('path');

const symbols = ['₹', '—', '?', '✓'];

function searchFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(searchFiles(filePath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (symbols.some(sym => line.includes(sym))) {
          results.push(`${filePath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

const matches = searchFiles('src');
console.log(matches.join('\n'));