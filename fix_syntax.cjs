const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

const oldStr = `            <input id="proof-delivery" type="datetime-local" value={proofDeliveryTime} onChange={(e) => setProof          <button onClick={handleSubmitProof} disabled={actionLoading} className="btn btn-primary btn-lg w-full mt-2">of} disabled={actionLoading} className="btn btn-primary btn-lg w-full mt-2">
            {actionLoading ? 'Submitting...' : 'Submit Proof'}
          </button>`;

const newStr = `            <input id="proof-delivery" type="datetime-local" value={proofDeliveryTime} onChange={(e) => setProofDeliveryTime(e.target.value)} className="input-field" />
          </div>
          <button onClick={handleSubmitProof} disabled={actionLoading} className="btn btn-primary btn-lg w-full mt-6">
            {actionLoading ? 'Submitting...' : 'Submit Proof'}
          </button>`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed PoolDetailPage.tsx syntax error');