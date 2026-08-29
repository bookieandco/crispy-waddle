export interface ScreenChangeResult {
  changed: boolean;
  novelty: number;
}

/**
 * Platform-neutral contract. Actual pixel comparison belongs in the platform
 * adapter because frames may be represented by files, buffers, or OS handles.
 */
export interface ScreenChangeDetector {
  compare(previousContentRef: string | null, currentContentRef: string): Promise<ScreenChangeResult>;
}
