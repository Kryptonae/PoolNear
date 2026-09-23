const fs = require('fs');
let content = fs.readFileSync('src/pages/CreatePoolPage.tsx', 'utf8');

const changes = [
  { s: "prefixNode={<span className=\"font-medium\">—</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "prefixNode={<span className=\"font-medium\">-</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "prefixNode={<span className=\"font-medium\">,1</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "prefixNode={<span className=\"font-medium\">,1</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: ">—", r: ">×" }, // For the "×" remove item button
];

changes.forEach(({s, r}) => {
  content = content.replaceAll(s, r);
});

fs.writeFileSync('src/pages/CreatePoolPage.tsx', content, 'utf8');
console.log('Fixed CreatePoolPage.tsx');