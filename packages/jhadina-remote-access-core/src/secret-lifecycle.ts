export interface EphemeralSecret<T> {
  readonly value: T;
  dispose(): void;
  readonly disposed: boolean;
}

export function ephemeralSecret<T>(value: T): EphemeralSecret<T> {
  let disposed = false;
  return {
    get value() {
      if (disposed) throw new Error('Secret has been disposed');
      return value;
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
    },
  };
}
