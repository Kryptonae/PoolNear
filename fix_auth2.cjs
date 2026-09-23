const fs = require('fs');
let content = fs.readFileSync('src/pages/AuthPage.tsx', 'utf8');

content = content.replaceAll('placeholder=",1"', 'placeholder="••••••••"');
content = content.replaceAll('placeholder="—"', 'placeholder="••••••••"');
content = content.replaceAll('placeholder=",1"', 'placeholder="••••••••"');

fs.writeFileSync('src/pages/AuthPage.tsx', content, 'utf8');
console.log('Fixed AuthPage.tsx');