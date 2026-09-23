const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

const changes = [
  { s: "toast.success('Receipt confirmed! ₹');", r: "toast.success('Receipt confirmed!');" },
  { s: "toast.success('Receipt confirmed! ?');", r: "toast.success('Receipt confirmed!');" },
  { s: ">₹ Mark as Delivered", r: ">Mark as Delivered" },
  { s: ">? Mark as Delivered", r: ">Mark as Delivered" },
  { s: ">— I've Received My Item", r: ">I've Received My Item" },
  { s: ">- I've Received My Item", r: ">I've Received My Item" },
  { s: "prefixNode={<span className=\"font-medium\">—</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "prefixNode={<span className=\"font-medium\">-</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "prefixNode={<span className=\"font-medium\">,1</span>}", r: "prefixNode={<span className=\"font-medium\">₹</span>}" },
  { s: "{req.quantity} — ₹{req.amount / req.quantity}", r: "{req.quantity} × ₹{req.amount / req.quantity}" },
  { s: "{req.quantity} ? -{req.amount / req.quantity}", r: "{req.quantity} × ₹{req.amount / req.quantity}" },
  { s: "—{joinItems.reduce", r: "₹{joinItems.reduce" },
  { s: "-{joinItems.reduce", r: "₹{joinItems.reduce" },
  { s: "—{remainingRequired}", r: "₹{remainingRequired}" },
  { s: "-{remainingRequired}", r: "₹{remainingRequired}" },
  { s: "—{pool.minimum_order_value}", r: "₹{pool.minimum_order_value}" },
  { s: "-{pool.minimum_order_value}", r: "₹{pool.minimum_order_value}" },
  { s: ">—{order.order_value", r: ">₹{order.order_value" },
  { s: ">-{order.order_value", r: ">₹{order.order_value" },
  { s: ">—{member.contribution}", r: ">₹{member.contribution}" },
  { s: ">-{member.contribution}", r: ">₹{member.contribution}" },
  { s: ">—{req.amount}", r: ">₹{req.amount}" },
  { s: ">-{req.amount}", r: ">₹{req.amount}" },
  { s: ">—{myMembership.contribution}", r: ">₹{myMembership.contribution}" },
  { s: ">-{myMembership.contribution}", r: ">₹{myMembership.contribution}" },
  { s: ">— Received", r: ">✓ Received" },
  { s: ">- Received", r: ">✓ Received" },
  { s: ">— Pending", r: ">Pending" },
  { s: ">- Pending", r: ">Pending" },
  { s: "Link —", r: "Link →" },
  { s: "Link -", r: "Link →" },
  { s: "<div className=\"text-4xl mb-3\">?</div>", r: "<div className=\"text-4xl mb-3\">✅</div>" },
  { s: ">—", r: ">×" }, // For the "×" remove item button
];

changes.forEach(({s, r}) => {
  content = content.replaceAll(s, r);
});

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed PoolDetailPage.tsx');