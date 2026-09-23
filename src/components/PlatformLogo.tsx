import { type PlatformKey } from '../lib/constants';
import { ShoppingBag } from 'lucide-react';

export function PlatformLogo({ platform, className = '', size = 24 }: { platform: PlatformKey | string; className?: string; size?: number }) {
  // Use SVG path structures to accurately represent logos where possible, or high-quality typography/colors.
  // We use inline SVG for the logos since we don't have static assets.

  const baseClasses = `shrink-0 flex items-center justify-center transition-transform ${className}`;

  switch (platform) {
    case 'blinkit':
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: '#F5C518', borderRadius: size * 0.2 }}
          aria-label="Blinkit"
        >
          <span style={{ color: '#000', fontWeight: 900, fontSize: size * 0.55, lineHeight: 1, letterSpacing: '-0.05em' }}>
            b
          </span>
        </div>
      );
    case 'zepto':
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: '#3f0071', borderRadius: size * 0.2 }}
          aria-label="Zepto"
        >
          <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.55, fontStyle: 'italic', lineHeight: 1, paddingRight: size * 0.05 }}>
            Z
          </span>
        </div>
      );
    case 'swiggy_instamart':
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: '#FC8019', borderRadius: size * 0.2 }}
          aria-label="Swiggy Instamart"
        >
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="white">
             <path d="M11.758 1.558c-5.748.917-10.428 5.6-11.346 11.346-.738 4.636 1.488 9.07 5.626 11.096h10.97c3.9-1.92 6.082-6.104 5.518-10.446-1.025-7.85-8.915-13.064-16.79-11.996zM13.2 21.43c-3.13.06-6.196-1.428-7.982-3.864-1.282-1.748-1.72-4.01-1.12-6.07.65-2.24 2.37-4.08 4.54-4.88 4.15-1.528 8.76.62 10.3 4.77.72 1.94.57 4.1-.38 5.92-1.19 2.27-3.47 3.82-6.05 4.12z" />
          </svg>
        </div>
      );
    case 'flipkart_minutes':
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: '#2874F0', borderRadius: size * 0.2 }}
          aria-label="Flipkart Minutes"
        >
          <span style={{ color: '#F5C518', fontWeight: 900, fontSize: size * 0.55, fontStyle: 'italic', lineHeight: 1 }}>
            f
          </span>
        </div>
      );
    case 'bigbasket':
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: '#84C225', borderRadius: size * 0.2 }}
          aria-label="BigBasket"
        >
          <span style={{ color: '#fff', fontWeight: 900, fontSize: size * 0.55, lineHeight: 1 }}>
            bb
          </span>
        </div>
      );
    default:
      // Fallback for 'other' or unknown platforms
      return (
        <div 
          className={baseClasses} 
          style={{ width: size, height: size, backgroundColor: 'var(--color-surface-100, #F1F5F9)', borderRadius: size * 0.2 }}
          aria-label={typeof platform === 'string' ? platform : 'Other'}
        >
          <ShoppingBag size={size * 0.5} className="text-surface-500" strokeWidth={2.5} />
        </div>
      );
  }
}
