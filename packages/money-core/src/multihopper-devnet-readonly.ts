import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * MultiHopper integration boundary: devnet, quote and lookup ONLY.
 * No transaction creation, preparation, signature, confirmation or broadcasting.
 * This is intentionally separate from Purse allocation and wallet signing.
 */
export const MULTIHOPPER_DEVNET_BASE_URL = 'https://devnet.multihopper.com/api/v1' as const;
export const MULTIHOPPER_READ_ONLY_AUTHORITY = Object.freeze({
  provider: 'multihopper',
  environment: 'DEVNET',
  authority: 'READ_ONLY_OBSERVATION' as const,
  canCreateTransfer: false,
  canPrepareTransfer: false,
  canSign: false,
  canBroadcast: false,
  canConfirmBroadcast: false,
  canMoveFunds: false,
});

export type MultiHopperEstimateInput = Readonly<{
  tokenMint: string;
  amountRaw: string;
  tokenDecimals: number;
  hops: number;
}>;

export type MultiHopperDevnetEstimate = Readonly<{
  tier: string;
  percentFeeBps: number;
  percentFeeRaw: string;
  flatFeeLamportsPerHop: number;
  totalFlatFeeLamports: number;
  integratorPercentShare?: string;
  integratorFlatShare?: number;
  usdEquivalent?: number;
  isTestMode: true;
  authority: 'READ_ONLY_OBSERVATION';
  canMoveFunds: false;
}>;

export type MultiHopperDevnetTransferObservation = Readonly<{
  id: string;
  status: string;
  externalId?: string;
  supportBundleId?: string;
  isTest?: true;
  authority: 'READ_ONLY_OBSERVATION';
  canMoveFunds: false;
}>;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type Options = Readonly<{
  /** Must be a devnet test key. Resolve from secret management at invocation time. */
  apiKey: string;
  fetchFn?: FetchLike;
}>;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MULTIHOPPER_RESPONSE_INVALID');
  }
  return value as Record<string, unknown>;
}
function nonnegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('MULTIHOPPER_RESPONSE_INVALID');
  }
  return value;
}
function nonnegativeIntegerString(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('MULTIHOPPER_RESPONSE_INVALID');
  }
  return value;
}
function validBase58(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

/** Only production-disabled capabilities are exposed. */
export class MultiHopperDevnetReadOnlyClient {
  readonly authority = MULTIHOPPER_READ_ONLY_AUTHORITY;
  private readonly apiKey: string;
  private readonly fetchFn: FetchLike;

  constructor(options: Options) {
    if (!options.apiKey.startsWith('mh_test_') || /\s/.test(options.apiKey) || options.apiKey.length < 9) {
      throw new Error('MULTIHOPPER_DEVNET_TEST_KEY_REQUIRED');
    }
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> {
    // All request paths are constructed internally. Never follow a user-provided URL.
    const response = await this.fetchFn(MULTIHOPPER_DEVNET_BASE_URL + path, {
      method,
      headers: { 'x-api-key': this.apiKey, accept: 'application/json', ...(payload ? { 'content-type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      redirect: 'error',
    });
    // Do not expose provider error bodies: they may contain credentials or account identifiers.
    if (!response.ok) throw new Error('MULTIHOPPER_DEVNET_HTTP_' + response.status);
    return object(await response.json());
  }

  /** POST /transfers/estimate is non-mutating and does not create a transfer. */
  async estimate(input: MultiHopperEstimateInput): Promise<MultiHopperDevnetEstimate> {
    if (!validBase58(input.tokenMint)) throw new Error('MULTIHOPPER_MINT_INVALID');
    if (!/^[1-9]\d*$/.test(input.amountRaw)) throw new Error('MULTIHOPPER_AMOUNT_INVALID');
    if (!Number.isInteger(input.tokenDecimals) || input.tokenDecimals < 0 || input.tokenDecimals > 18) {
      throw new Error('MULTIHOPPER_DECIMALS_INVALID');
    }
    if (!Number.isInteger(input.hops) || input.hops < 3 || input.hops > 10) {
      throw new Error('MULTIHOPPER_HOPS_INVALID');
    }
    const data = await this.request('POST', '/transfers/estimate', { ...input });
    if (data.isTestMode !== true) throw new Error('MULTIHOPPER_TEST_MODE_NOT_CONFIRMED');
    if (typeof data.tier !== 'string' || !data.tier.trim()) throw new Error('MULTIHOPPER_RESPONSE_INVALID');
    const fee = Object.freeze({
      tier: data.tier,
      percentFeeBps: nonnegativeNumber(data.percentFeeBps),
      percentFeeRaw: nonnegativeIntegerString(data.percentFeeRaw),
      flatFeeLamportsPerHop: nonnegativeNumber(data.flatFeeLamportsPerHop),
      totalFlatFeeLamports: nonnegativeNumber(data.totalFlatFeeLamports),
      ...(typeof data.integratorPercentShare === 'string' ? { integratorPercentShare: nonnegativeIntegerString(data.integratorPercentShare) } : {}),
      ...(typeof data.integratorFlatShare === 'number' ? { integratorFlatShare: nonnegativeNumber(data.integratorFlatShare) } : {}),
      ...(typeof data.usdEquivalent === 'number' && Number.isFinite(data.usdEquivalent) && data.usdEquivalent >= 0 ? { usdEquivalent: data.usdEquivalent } : {}),
      isTestMode: true as const,
      authority: 'READ_ONLY_OBSERVATION' as const,
      canMoveFunds: false as const,
    });
    return fee;
  }

  async getTransfer(transferId: string): Promise<MultiHopperDevnetTransferObservation> {
    if (!/^[1-9]\d*$/.test(transferId)) throw new Error('MULTIHOPPER_TRANSFER_ID_INVALID');
    return this.observe('/transfers/' + transferId);
  }

  async getTransferByExternalId(externalId: string): Promise<MultiHopperDevnetTransferObservation> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId)) throw new Error('MULTIHOPPER_EXTERNAL_ID_INVALID');
    return this.observe('/transfers/by-external/' + encodeURIComponent(externalId));
  }

  private async observe(path: string): Promise<MultiHopperDevnetTransferObservation> {
    const data = await this.request('GET', path);
    if (data.isTest === false) throw new Error('MULTIHOPPER_NONTEST_TRANSFER_REFUSED');
    if ((typeof data.id !== 'number' && typeof data.id !== 'string') || !/^[1-9]\d*$/.test(String(data.id))) {
      throw new Error('MULTIHOPPER_RESPONSE_INVALID');
    }
    if (typeof data.status !== 'string' || !data.status.trim()) throw new Error('MULTIHOPPER_RESPONSE_INVALID');
    return Object.freeze({
      id: String(data.id),
      status: data.status,
      ...(typeof data.externalId === 'string' ? { externalId: data.externalId } : {}),
      ...(typeof data.supportBundleId === 'string' ? { supportBundleId: data.supportBundleId } : {}),
      ...(data.isTest === true ? { isTest: true as const } : {}),
      authority: 'READ_ONLY_OBSERVATION' as const,
      canMoveFunds: false as const,
    });
  }
}

/** Verify against the unparsed HTTP body bytes; never verify a parsed JSON object. */
export function verifyMultiHopperWebhookRawBody(
  rawBody: Uint8Array,
  signatureHex: string | undefined,
  secret: string,
): boolean {
  if (!secret || !signatureHex || !/^[0-9a-fA-F]{64}$/.test(signatureHex)) return false;
  const actual = Buffer.from(signatureHex, 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
