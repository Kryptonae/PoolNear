const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

content = content.replace('import { useState, useEffect, useRef } from \'react\';', 'import { useState, useEffect } from \'react\';');

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed unused useRef in PoolDetailPage.tsx');