const fs = require('fs');
let content = fs.readFileSync('src/pages/CreatePoolPage.tsx', 'utf8');

// Replace all instances of <input ... className="input-field ..."> with <Input ...>
content = content.replace(/<input\s+type="text"\s+value=\{item\.name\}([\s\S]*?)className="input-field font-semibold text-base"([\s\S]*?)\/>/g, '<Input type="text" value={item.name}="font-semibold text-base"/>');

content = content.replace(/<input\s+type="text"\s+value=\{item\.brand \|\| ''\}([\s\S]*?)className="input-field text-sm"\s*\/>/g, '<Input type="text" value={item.brand || \'\'}/>');

content = content.replace(/<input\s+type="text"\s+value=\{item\.variant_size \|\| ''\}([\s\S]*?)className="input-field text-sm"\s*\/>/g, '<Input type="text" value={item.variant_size || \'\'}/>');

content = content.replace(/<input\s+type="url"\s+value=\{item\.product_url \|\| ''\}([\s\S]*?)className="input-field text-sm"\s*\/>/g, '<Input type="url" value={item.product_url || \'\'}/>');

content = content.replace(/className="grid grid-cols-2 gap-3"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-3"');
content = content.replace(/className="grid grid-cols-2 gap-3 pt-4 border-t border-surface-100"/g, 'className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-surface-100"');
content = content.replace(/>\s*→\s*<\/button>/g, '> - </button>');

fs.writeFileSync('src/pages/CreatePoolPage.tsx', content, 'utf8');