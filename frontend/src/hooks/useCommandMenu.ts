import { useMountEffect } from '@/hooks/useMountEffect';
import { useUIStore } from '@/store/uiStore';

export function useCommandMenu() {
  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        const { commandMenuOpen, setCommandMenuOpen } = useUIStore.getState();
        setCommandMenuOpen(!commandMenuOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  });
}
