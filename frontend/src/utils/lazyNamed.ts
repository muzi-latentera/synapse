import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export function lazyNamed<T extends ComponentType<any>>(
  factory: () => Promise<Record<string, T>>,
  name: string,
): LazyExoticComponent<T> {
  return lazy(() => factory().then((m) => ({ default: m[name] })));
}
