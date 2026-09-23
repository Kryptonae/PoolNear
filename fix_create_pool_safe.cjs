const fs = require('fs');
const file = 'src/pages/CreatePoolPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace <input className="input-field ..."> with <Input ...>
content = content.replace(/<input([^>]*?)className="input-field([^>]*?)"([^>]*?)\/>/g, '<Input=""/>');
content = content.replace(/className="grid grid-cols-2 gap-3"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-3"');
fs.writeFileSync(file, content, 'utf8');