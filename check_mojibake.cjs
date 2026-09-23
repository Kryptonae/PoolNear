const fs = require('fs');
const files = fs.readdirSync('src/pages').map(f => 'src/pages/' + f);
files.push('src/components/LocationInput.tsx', 'src/components/PhoneNumberModal.tsx', 'src/pages/AuthPage.tsx', 'src/pages/HomePage.tsx', 'src/components/ui.tsx', 'src/components/Layout.tsx');

let unique = new Set();
for (let file of files) {
  if (!fs.existsSync(file) || !file.endsWith('.tsx')) continue;
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/[^\x00-\x7F]+/g) || [];
  matches.forEach(m => {
     if (m !== '🔔' && !m.includes('─') && !m.includes('₹') && !m.includes('→') && !m.includes('•') && !m.includes('═') && !m.includes('—') && !m.includes('📍') && !m.includes('🎉')) unique.add(m);
  });
}
console.log([...unique].join('\n'));