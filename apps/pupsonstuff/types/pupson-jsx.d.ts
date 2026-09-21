import type * as React19 from 'react';

/**
 * Next.js requires `jsx: preserve`, which makes TypeScript use the classic
 * JSX factory namespace for type checking. This monorepo intentionally also
 * contains a React 18 app, so falling back to the global JSX namespace can
 * merge incompatible React 18/19 ambient declarations.
 *
 * PupsonReact is type-only. Next/SWC still performs the runtime JSX transform.
 * It gives PupsonStuff a deterministic React 19 JSX namespace while retaining
 * React Three Fiber's module augmentation of React.JSX.
 */
declare global {
  namespace PupsonReact {
    const createElement: typeof React19.createElement;
    const Fragment: typeof React19.Fragment;

    namespace JSX {
      type ElementType = React19.JSX.ElementType;
      interface Element extends React19.JSX.Element {}
      interface ElementClass extends React19.JSX.ElementClass {}
      interface ElementAttributesProperty extends React19.JSX.ElementAttributesProperty {}
      interface ElementChildrenAttribute extends React19.JSX.ElementChildrenAttribute {}
      type LibraryManagedAttributes<C, P> = React19.JSX.LibraryManagedAttributes<C, P>;
      interface IntrinsicAttributes extends React19.JSX.IntrinsicAttributes {}
      interface IntrinsicClassAttributes<T>
        extends React19.JSX.IntrinsicClassAttributes<T> {}
      interface IntrinsicElements extends React19.JSX.IntrinsicElements {}
    }
  }
}

export {};
