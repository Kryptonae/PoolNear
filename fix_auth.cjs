const fs = require('fs');
let content = fs.readFileSync('src/pages/AuthPage.tsx', 'utf8');
content = content.replace(/\/\/\s+\s\?\n/g, '// ═\n');
content = content.replace(/\/\/\s+\s\?.*\n/g, '// PoolNear — Authentication\n');
fs.writeFileSync('src/pages/AuthPage.tsx', content, 'utf8');