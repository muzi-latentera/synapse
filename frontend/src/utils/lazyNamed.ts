import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export function lazyNamed<P extends Record<string, unknown>>(
  factory: () => Promise<Record<string, ComponentType<P>>>,
  name: string,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(() => factory().then((m) => ({ default: m[name] })));
}
