import type { SafetyCodeWordBinding } from './personal-safety.js';

export type CodeWordRuntimeResult =
  | 'matched'
  | 'not-matched'
  | 'disabled'
  | 'revoked'
  | 'cooldown';

export interface CodeWordVerifier {
  verify(input: string, binding: SafetyCodeWordBinding): Promise<boolean>;
}

export interface CodeWordActivation {
  readonly bindingId: string;
  readonly protocolId: string;
  readonly activatedAt: string;
  readonly mode: SafetyCodeWordBinding['triggerMode'];
}

export interface CodeWordRuntimePolicy {
  readonly cooldownSeconds: number;
  readonly maxAttemptsPerWindow: number;
  readonly attemptWindowSeconds: number;
}

export interface CodeWordRuntime {
  match(input: string, bindings: readonly SafetyCodeWordBinding[]): Promise<{
    result: CodeWordRuntimeResult;
    activation?: CodeWordActivation;
  }>;
  revoke(bindingId: string): void;
  restore(bindingId: string): void;
}

/**
 * Runtime contract only. Implementations must not persist plaintext code words.
 * Activation produces an intent for the emergency protocol engine; it does not
 * directly send notifications, record media, or release evidence.
 */
export interface CodeWordActivationIntent {
  readonly protocolId: string;
  readonly bindingId: string;
  readonly activatedAt: string;
  readonly triggerMode: SafetyCodeWordBinding['triggerMode'];
}
