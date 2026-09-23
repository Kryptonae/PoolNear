const fs = require('fs');
const file = 'src/pages/CreatePoolPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const r1 =                       <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].name = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Item Name (e.g. Snacks...)"
                        className="input-field font-semibold text-base"
                        required
                      />;
const w1 =                       <Input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].name = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Item Name (e.g. Snacks...)"
                        className="font-semibold text-base"
                        required
                      />;
content = content.replace(r1, w1);

const r2 =                         <input
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].brand = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Brand (Opt)"
                          className="input-field text-sm"
                        />;
const w2 =                         <Input
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].brand = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Brand (Opt)"
                        />;
content = content.replace(r2, w2);

const r3 =                         <input
                          type="text"
                          value={item.variant_size || ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].variant_size = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Size (Opt)"
                          className="input-field text-sm"
                        />;
const w3 =                         <Input
                          type="text"
                          value={item.variant_size || ''}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[index].variant_size = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="Size (Opt)"
                        />;
content = content.replace(r3, w3);

const r4 =                     <input
                      type="url"
                      value={item.product_url || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].product_url = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Product URL (Optional)"
                      className="input-field text-sm"
                    />;
const w4 =                     <Input
                      type="url"
                      value={item.product_url || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].product_url = e.target.value;
                        setItems(newItems);
                      }}
                      placeholder="Product URL (Optional)"
                    />;
content = content.replace(r4, w4);

const r5 = className="grid grid-cols-2 gap-3";
const w5 = className="grid grid-cols-1 sm:grid-cols-2 gap-3";
content = content.replace(r5, w5);

const r6 = className="grid grid-cols-2 gap-3 pt-4 border-t border-surface-100";
const w6 = className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-surface-100";
content = content.replace(r6, w6);

const r7 =                       <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(item.quantity) || 1;
                          const newItems = [...items];
                          newItems[index].quantity = Math.max(1, current - 1).toString();
                          setItems(newItems);
                        }}
                        className="w-10 h-full rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-200 hover:text-surface-900 transition-colors text-lg"
                      >
                        →
                      </button>;
const w7 =                       <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(item.quantity) || 1;
                          const newItems = [...items];
                          newItems[index].quantity = Math.max(1, current - 1).toString();
                          setItems(newItems);
                        }}
                        className="w-10 h-full rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-200 hover:text-surface-900 transition-colors text-lg"
                      >
                        -
                      </button>;
content = content.replace(r7, w7);

fs.writeFileSync(file, content, 'utf8');