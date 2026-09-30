import type { SharkObservation } from '../observations/SharkObservation';

export interface SolanaRpcTransport {
  request<T>(method: string, params: readonly unknown[]): Promise<T>;
}

export interface SolanaAccountObservation {
  readonly address: string;
  readonly owner?: string;
  readonly executable?: boolean;
  readonly lamports?: number;
  readonly dataEncoding?: string;
  readonly slot: number;
  readonly observedAt: string;
}

/**
 * Provider-neutral Solana observation adapter. It reads public chain state only;
 * it never signs, submits, or moves funds.
 */
export async function observeSolanaAccount(
  transport: SolanaRpcTransport,
  address: string,
  observedAt = new Date().toISOString(),
): Promise<SharkObservation | null> {
  const result = await transport.request<{
    readonly context?: { readonly slot?: number };
    readonly value?: {
      readonly lamports?: number;
      readonly owner?: string;
      readonly executable?: boolean;
      readonly data?: unknown;
    } | null;
  }>('getAccountInfo', [address, { encoding: 'base64', commitment: 'confirmed' }]);

  if (!result.value) return null;

  return {
    id: `solana:account:${address}:${result.context?.slot ?? observedAt}`,
    observedAt,
    chain: 'solana',
    subjectId: address,
    subjectType: 'wallet',
    kind: 'wallet_flow',
    value: {
      lamports: result.value.lamports,
      ownerProgram: result.value.owner,
      executable: result.value.executable,
      dataPresent: result.value.data != null,
      slot: result.context?.slot,
    },
    evidence: [{
      source: 'chain',
      sourceId: address,
      observedAt,
      reliability: 0.98,
      data: { rpcMethod: 'getAccountInfo', slot: result.context?.slot },
    }],
    confidence: 0.98,
    novelty: 0.2,
  };
}
