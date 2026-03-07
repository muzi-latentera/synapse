import { memo, useState, useEffect } from 'react';
import { Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/utils/cn';

type GetIconFn = (name: string) => { svg: string };

let cachedGetIcon: GetIconFn | null = null;
let loadPromise: Promise<GetIconFn | null> | null = null;
const svgCache = new Map<string, string>();

function getSvg(name: string): string | null {
  const cached = svgCache.get(name);
  if (cached) return cached;
  if (!cachedGetIcon) return null;
  const svg = cachedGetIcon(name).svg;
  svgCache.set(name, svg);
  return svg;
}

function loadModule(): Promise<GetIconFn | null> {
  if (!loadPromise) {
    loadPromise = import('material-file-icons').then(
      (m) => {
        cachedGetIcon = m.getIcon as GetIconFn;
        return cachedGetIcon;
      },
      () => {
        loadPromise = null;
        return null;
      },
    );
  }
  return loadPromise;
}

export interface FileIconProps {
  name: string;
  isFolder?: boolean;
  isExpanded?: boolean;
  className?: string;
}

export const FileIcon = memo(function FileIcon({
  name,
  isFolder = false,
  isExpanded,
  className,
}: FileIconProps) {
  const [svg, setSvg] = useState<string | null>(() => (isFolder ? null : getSvg(name)));

  useEffect(() => {
    if (isFolder) return;
    const resolved = getSvg(name);
    if (resolved) {
      setSvg(resolved);
      return;
    }
    setSvg(null);
    let cancelled = false;
    loadModule().then((getIcon) => {
      if (!cancelled && getIcon) setSvg(getSvg(name));
    });
    return () => {
      cancelled = true;
    };
  }, [name, isFolder]);

  if (isFolder) {
    const FolderIcon = isExpanded ? FolderOpen : Folder;
    return (
      <FolderIcon
        className={cn(
          'text-text-quaternary transition-colors dark:text-text-dark-quaternary',
          className,
        )}
      />
    );
  }

  if (!svg) return <span className={cn('inline-flex shrink-0', className)} />;

  return (
    <span
      className={cn('inline-flex shrink-0', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
