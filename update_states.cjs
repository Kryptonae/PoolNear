const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

// 1. Remove state variables
content = content.replace(/const \[proofFile, setProofFile\] = useState<File \| null>\(null\);\n/g, '');
content = content.replace(/const \[paymentProofFile, setPaymentProofFile\] = useState<File \| null>\(null\);\n/g, '');

// 2. Fix handleSubmitProof upload logic
const oldSubmitProof = `    // Upload proof file if provided
    if (proofFile && profile) {
      const result = await uploadOrderProof(proofFile, profile.id, pool!.id, setUploadProgress);
      proofImageUrl = result.url;
    }`;
const newSubmitProof = `    // Upload proof disabled in frontend UI
    proofImageUrl = undefined;`;
content = content.replace(oldSubmitProof, newSubmitProof);

const oldResetProof = `    toast.success('Order proof submitted!');
    setShowOrderProofModal(false);
    setProofFile(null);`;
const newResetProof = `    toast.success('Order proof submitted!');
    setShowOrderProofModal(false);`;
content = content.replace(oldResetProof, newResetProof);

// 3. Fix handleMarkPaymentSent logic
const oldPaymentSent = `    // Upload payment proof if provided
    if (paymentProofFile && profile) {
      const result = await uploadPaymentProof(paymentProofFile, profile.id, pool!.id, setUploadProgress);
      proofUrl = result.url;
    }`;
const newPaymentSent = `    // Payment proof upload disabled in frontend UI
    proofUrl = undefined;`;
content = content.replace(oldPaymentSent, newPaymentSent);

const oldResetPayment = `    await markPaymentSent(pool!.id, profile!.id, proofUrl);
    
    setPaymentProofFile(null);`;
const newResetPayment = `    await markPaymentSent(pool!.id, profile!.id, proofUrl);`;
content = content.replace(oldResetPayment, newResetPayment);

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed states in PoolDetailPage.tsx');