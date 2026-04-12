import type { ReactNode } from 'react';

interface AuthErrorBannerProps {
  children: ReactNode;
}

export function AuthErrorBanner({ children }: AuthErrorBannerProps) {
  return (
    <div className="animate-fadeIn rounded-lg border border-error-500/20 bg-error-500/10 p-3">
      {children}
    </div>
  );
}
