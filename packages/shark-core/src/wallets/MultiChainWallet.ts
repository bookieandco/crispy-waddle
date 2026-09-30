export type SharkChain =
  | 'solana'
  | 'bitcoin'
  | 'dogecoin'
  | 'ethereum'
  | 'base'
  | 'tron'
  | 'other';

export type WalletRole =
  | 'trading'
  | 'treasury'
  | 'observation'
  | 'mining'
  | 'mixed';

export type WalletCapability =
  | 'observe'
  | 'value'
  | 'transfer'
  | 'trade'
  | 'mine';

export interface WalletAddress {
  readonly id: string;
  readonly chain: SharkChain;
  readonly address: string;
  readonly label?: string;
  readonly capabilities: readonly WalletCapability[];
  readonly observationOnly: boolean;
}

export interface MiningProfile {
  readonly enabled: boolean;
  readonly algorithm?: string;
  readonly asset?: string;
  readonly pool?: string;
  readonly workerId?: string;
}

/**
 * A logical wallet container. Secrets/private keys never belong in Shark's
 * intelligence records; custody references point to an external signer.
 */
export interface MultiChainWallet {
  readonly id: string;
  readonly name: string;
  readonly role: WalletRole;
  readonly custodyRef: string;
  readonly addresses: readonly WalletAddress[];
  readonly mining?: MiningProfile;
  readonly createdAt: string;
  readonly tags?: readonly string[];
}

export function walletSupports(
  wallet: MultiChainWallet,
  chain: SharkChain,
  capability: WalletCapability,
): boolean {
  return wallet.addresses.some(
    (address) =>
      address.chain === chain &&
      !address.observationOnly &&
      address.capabilities.includes(capability),
  );
}

export function walletHasMiningCapability(wallet: MultiChainWallet): boolean {
  return Boolean(wallet.mining?.enabled) || wallet.addresses.some(
    (address) => address.capabilities.includes('mine'),
  );
}
