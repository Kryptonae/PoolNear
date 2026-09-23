const fs = require('fs');
let content = fs.readFileSync('src/pages/PoolDetailPage.tsx', 'utf8');

// 1. Remove Product Link Image and replace with button
content = content.replace(
  `{req.product_url && getSafeUrl(req.product_url) && (
                                <a 
                                  href={getSafeUrl(req.product_url)!}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold bg-surface-100 hover:bg-surface-200 text-surface-700 py-1.5 px-3 rounded-lg transition-colors inline-flex items-center gap-1"
                                >
                                  Link +'
                                </a>
                              )}`,
  `{req.product_url && getSafeUrl(req.product_url) && (
                                <a 
                                  href={getSafeUrl(req.product_url)!}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 py-1.5 px-3 rounded-xl transition-colors inline-flex items-center gap-1 mt-2"
                                >
                                  View Product <ExternalLink size={14} />
                                </a>
                              )}`
);

// Add ExternalLink import if not present
if (!content.includes('ExternalLink')) {
  content = content.replace('Image, Map, MapPin', 'Image, Map, MapPin, ExternalLink');
}

// 2. Connect UX Upgrade
const oldConnect = `                            if (!hasValidPhone) {
                              return (
                                <button onClick={() => setShowPhoneModal(true)} className="text-xs font-semibold text-red-600 hover:underline">
                                  Add Phone to Connect
                                </button>
                              );
                            }
                            return (
                              <button onClick={() => handleRequestConnection(member.user_id)} className="text-xs font-semibold text-brand-600 hover:underline">
                                Connect for Payment
                              </button>
                            );`;

const newConnect = `                            if (!hasValidPhone) {
                              return (
                                <div className="mt-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                                  <p className="text-xs font-semibold text-red-800 mb-2">Connect to coordinate order</p>
                                  <button onClick={() => setShowPhoneModal(true)} className="btn w-full bg-white border-red-200 text-red-600 hover:bg-red-50 py-2.5 text-sm shadow-sm">
                                    Add Phone to Connect
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div className="mt-3 p-4 bg-surface-50 border border-surface-200 rounded-xl">
                                <p className="text-xs font-semibold text-surface-600 mb-2">Connect to coordinate order</p>
                                <button onClick={() => handleRequestConnection(member.user_id)} className="btn btn-secondary w-full py-2.5 text-sm shadow-sm">
                                  Connect for Payment
                                </button>
                              </div>
                            );`;

content = content.replace(oldConnect, newConnect);

const oldRequestSent = `return <span className="text-xs font-medium text-surface-500 flex items-center gap-1"><Clock size={12}/> Request Sent</span>;`;
const newRequestSent = `return (
                                <div className="mt-3 p-3 bg-surface-50 border border-surface-200 rounded-xl flex items-center justify-center">
                                  <span className="text-sm font-semibold text-surface-500 flex items-center gap-2"><Clock size={16}/> Request Sent</span>
                                </div>
                              );`;
content = content.replace(oldRequestSent, newRequestSent);

const oldConnected = `<span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1 mt-1">
                                <CheckCircle2 size={12}/> {connection.contact_phone || 'No phone'}
                              </span>`;
const newConnected = `<div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-1 items-center">
                                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1"><CheckCircle2 size={14}/> Connected</span>
                                <span className="text-sm font-mono font-bold text-emerald-900">
                                  {connection.contact_phone || 'No phone'}
                                </span>
                              </div>`;
content = content.replace(oldConnected, newConnected);

// Orderer connect UI
const oldOrdererConnect = `<button onClick={() => handleRequestConnection(pool.orderer_id!)} className="btn btn-primary w-full py-3">
                        Connect with orderer for payment
                      </button>`;
const newOrdererConnect = `<button onClick={() => handleRequestConnection(pool.orderer_id!)} className="btn btn-primary w-full py-3">
                        Connect for Payment
                      </button>`;
content = content.replace(oldOrdererConnect, newOrdererConnect);


// 3. Remove Photo upload from Payment Proof
const oldPaymentProof = `<div className="flex items-center gap-2">
                      <button onClick={handleMarkPaymentSent} disabled={actionLoading} className="btn btn-primary flex-1 py-3">
                        Mark Payment Sent
                      </button>
                      <div className="flex flex-col items-center justify-center shrink-0 w-24">
                        <span className="text-[10px] text-surface-500 font-medium mb-1 truncate w-full text-center">
                          {paymentProofFile ? paymentProofFile.name : 'Screenshot (optional)'}
                        </span>
                        <button onClick={() => paymentFileRef.current?.click()} className="text-xs font-bold text-brand-600 hover:underline">
                          {paymentProofFile ? 'Change' : 'Attach'}
                        </button>
                        <input ref={paymentFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} />
                      </div>
                    </div>`;
const newPaymentProof = `<div className="flex items-center gap-2">
                      <button onClick={handleMarkPaymentSent} disabled={actionLoading} className="btn btn-primary w-full py-3">
                        Mark Payment Sent
                      </button>
                    </div>`;
content = content.replace(oldPaymentProof, newPaymentProof);


// 4. Remove Photo Upload from Order Proof
const oldOrderProofInputs = `<div className="mt-4">
                  <label className="block text-sm font-bold text-surface-900 mb-1.5">Proof Screenshot (Optional)</label>
                  <div 
                    onClick={() => proofFileRef.current?.click()}
                    className="border-2 border-dashed border-surface-200 rounded-xl p-4 text-center cursor-pointer hover:bg-surface-50 hover:border-surface-300 transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-surface-400 mb-2" />
                    <p className="text-sm font-medium text-surface-700">{proofFile ? proofFile.name : 'Choose file...'}</p>
                    <p className="text-xs text-surface-500 mt-1">Tap to select image</p>
                  </div>
                  <input 
                    ref={proofFileRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                  {proofFile && (
                    <p className="text-xs text-brand-600 mt-2 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 size={12} /> {(proofFile.size / 1024).toFixed(0)} KB • {proofFile.type}
                    </p>
                  )}
                </div>`;
content = content.replace(oldOrderProofInputs, '');

fs.writeFileSync('src/pages/PoolDetailPage.tsx', content, 'utf8');
console.log('Fixed PoolDetailPage.tsx');