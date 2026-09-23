const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const r =             {/* Desktop Global Location Picker */}
            <div className="flex items-center gap-3 overflow-hidden">
               <button 
                  onClick={handleOpenLocationPicker}
                  className="btn btn-secondary w-full justify-start p-0 h-10 overflow-hidden relative flex items-center gap-3 border-transparent bg-surface-100 hover:bg-surface-200"
                  aria-label="Choose Location"
                >
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                    <MapPin size={20} className="text-brand-500" />
                  </div>
                  <span className="truncate flex-1 text-left opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium">
                    {globalLocation ? globalLocation.destination : 'Choose Location'}
                  </span>
                  <div className="w-10 h-10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <ChevronDown size={16} className="text-surface-400" />
                  </div>
                </button>
            </div>;

const w =             {/* Desktop Global Location Picker */}
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
            </div>;

// Strip all newlines and multiple spaces for safe replace
const rx = new RegExp(r.replace(/\s+/g, '\\s+'));
content = content.replace(rx, w);
fs.writeFileSync('src/components/Layout.tsx', content, 'utf8');