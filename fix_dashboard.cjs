const fs = require('fs');
let content = fs.readFileSync('src/pages/DashboardPage.tsx', 'utf8');

const changes = [
  { s: "—{req.amount}", r: "₹{req.amount}" },
  { s: "-{req.amount}", r: "₹{req.amount}" },
  { s: "—{pool.total_value}", r: "₹{pool.total_value}" },
  { s: "-{pool.total_value}", r: "₹{pool.total_value}" },
  { s: ">—", r: ">₹" } // Be careful with this, let's just do targeted replacements
];

changes.forEach(({s, r}) => {
  content = content.replaceAll(s, r);
});

fs.writeFileSync('src/pages/DashboardPage.tsx', content, 'utf8');
console.log('Fixed DashboardPage.tsx');