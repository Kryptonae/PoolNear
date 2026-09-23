const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const s1 = '{/* Desktop Global Location Picker */}';
const s2 = '</button>';
const i1 = content.indexOf(s1);
if (i1 === -1) process.exit(1);
const i2 = content.indexOf(s2, i1);
if (i2 === -1) process.exit(1);

const blockStart = i1 - 12; // include some leading spaces
const blockEnd = i2 + s2.length + 20;

const before = content.substring(0, i1);
const after = content.substring(i2 + s2.length + 18); // skip over </div>

const w = `{/* Desktop Global Location Picker */}
            <div className="flex items-center overflow-hidden">
               <button 
                  onClick={handleOpenLocationPicker}
                  className="btn btn-secondary w-full justify-start p-0 h-10 overflow-hidden relative flex items-center border-transparent bg-surface-100 hover:bg-surface-200 group/loc"
                  aria-label="Choose Location"
                >
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                    <MapPin size={20} className="text-brand-500" />
                  </div>
                  <span className="truncate flex-1 text-left opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium pl-3 pr-10">
                    {globalLocation ? globalLocation.destination : 'Choose Location'}
                  </span>
                  <div className="absolute right-0 top-0 w-10 h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                    <ChevronDown size={16} className="text-surface-400" />
                  </div>
                </button>
            </div>`;

content = before + w + after;
fs.writeFileSync('src/components/Layout.tsx', content, 'utf8');
console.log('Layout fixed');