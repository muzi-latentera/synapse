import { useState } from 'react';
import { MOBILE_BREAKPOINT } from '@/config/constants';
import { useMountEffect } from '@/hooks/useMountEffect';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  useMountEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  });

  return isMobile;
}
