export interface MediaElementEventLease {
  readonly token: number;
  isCurrent(): boolean;
  release(): void;
}

let nextToken = 0;
let activeToken = 0;

/**
 * Claim the right to translate events from the shared persistent media element.
 * A newer route immediately fences callbacks from older routes, even before
 * React has run the older effect cleanup.
 */
export function acquireMediaElementEventLease(): MediaElementEventLease {
  const token = ++nextToken;
  activeToken = token;
  return {
    token,
    isCurrent: () => activeToken === token,
    release: () => {
      if (activeToken === token) activeToken = 0;
    },
  };
}

export function resetMediaElementEventOwnership(): void {
  activeToken = 0;
}
