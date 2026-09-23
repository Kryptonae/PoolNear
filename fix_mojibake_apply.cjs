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

const arr = [...unique];
const map = {};

for (let m of arr) {
  if (m.includes('A\'A+?TA')) map[m] = '₹'; 
  else if (m.startsWith('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¹')) map[m] = '—'; 
  else if (m.startsWith('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢')) map[m] = '—'; 
  else if (m.startsWith('ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹')) map[m] = '₹';
  else if (m.startsWith('ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')) map[m] = '—';
  else if (m.startsWith('ÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â')) map[m] = '═';
  else if (m.startsWith('ÃƒÂ¢Ã‹â€ Ã¢â‚¬â„¢')) map[m] = '→';
  else if (m.startsWith('ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢')) map[m] = '•';
  else if (m.startsWith('Ã¢â€¢Â')) map[m] = '═';
  else if (m.startsWith('Ã¢â‚¬â€')) map[m] = '—';
  else if (m.startsWith('â€”')) map[m] = '—';
  else if (m.startsWith('ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·')) map[m] = '•';
  else if (m.startsWith('A,')) map[m] = '₹';
  else if (m.startsWith('A\'A,AAAA,A,AAAA?sAA,A?')) map[m] = '🎉';
  else if (m.startsWith('AAA?sAA,A?')) map[m] = '📍';
  // Check specifically for PoolDetailPage's scrambled strings
  else if (m.includes('A\'A+?TA?A,,A\'A,A?sA,AA\'A+?TA')) map[m] = '₹';
  else if (m.length > 20) map[m] = '₹'; // All long scrambles were ₹
  else map[m] = '₹';
}

for (let file of files) {
  if (!fs.existsSync(file) || !file.endsWith('.tsx')) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace from longest to shortest to prevent partial replacements
  const sorted = arr.sort((a,b) => b.length - a.length);
  
  for (let m of sorted) {
    if (content.includes(m)) {
      content = content.split(m).join(map[m]);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  }
}