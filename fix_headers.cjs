const fs = require('fs');
const files = [
  'src/pages/AuthPage.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/CreatePoolPage.tsx',
  'src/pages/DiscoverPage.tsx',
  'src/pages/DashboardPage.tsx',
  'src/pages/PoolDetailPage.tsx',
  'src/components/Layout.tsx'
];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let changed = false;
    for (let i = 0; i < 5; i++) {
      if (lines[i] && (lines[i].includes('A') || lines[i].includes(''))) {
        lines[i] = '// ═';
        changed = true;
      }
      if (lines[i] && lines[i].includes('?"')) {
        lines[i] = lines[i].replace(/\?"/g, '—');
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
      console.log(`Fixed header of ${file}`);
    }
  } catch(e) {}
}