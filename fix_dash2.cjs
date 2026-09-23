const fs = require('fs');
let content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

content = content.replaceAll(',1', '₹');
content = content.replaceAll(',1 Qty', '×');
content = content.replaceAll('₹{req.amount} ₹ Qty {req.quantity}', '₹{req.amount} × Qty {req.quantity}');
// Wait, actually I'll just replace all ',1' with '₹' and then fix the × manually if needed

fs.writeFileSync('src/pages/DashboardPage.tsx', content, 'utf8');
console.log('Fixed DashboardPage.tsx');