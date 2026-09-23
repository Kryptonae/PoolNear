const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

content = content.replace('import { uploadOrderProof, uploadPaymentProof, getSignedUrl } from \'../services/uploads\';', 'import { getSignedUrl } from \'../services/uploads\';');
content = content.replace(/const proofFileRef = useRef<HTMLInputElement>\(null\);\n/g, '');
content = content.replace(/const paymentFileRef = useRef<HTMLInputElement>\(null\);\n/g, '');

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed unused variables in PoolDetailPage.tsx');