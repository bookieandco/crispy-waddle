export type WalletChain = 'solana'
export type WalletConnectionState = 'connected-unverified' | 'ownership-verified' | 'disconnected'

export type RegisteredWallet = {
  walletId: string
  ownerId: string
  chain: WalletChain
  address: string
  provider: 'phantom'
  connectionState: WalletConnectionState
  observationEnabled: boolean
  tradingEnabled: false
  connectedAt: string
  lastSeenAt: string
}

const STORAGE_KEY = 'jhadina.wallet-registry.v1'

export function walletIdFor(address: string): string {
  return `solana:${address}`
}

export function loadRegisteredWallets(): RegisteredWallet[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as RegisteredWallet[]).filter(item =>
      item && typeof item.address === 'string' && item.provider === 'phantom'
    ).map(item => ({...item, connectionState: 'connected-unverified' as const,
      tradingEnabled: false as const})) : []
  } catch {
    return []
  }
}

export function registerWallet(input: {
  ownerId: string
  address: string
  provider: 'phantom'
  now?: string
}): RegisteredWallet {
  const now = input.now ?? new Date().toISOString()
  const wallet: RegisteredWallet = {
    walletId: walletIdFor(input.address),
    ownerId: input.ownerId,
    chain: 'solana',
    address: input.address,
    provider: input.provider,
    connectionState: 'connected-unverified',
    observationEnabled: true,
    tradingEnabled: false,
    connectedAt: now,
    lastSeenAt: now,
  }

  if (typeof window !== 'undefined') {
    const wallets = loadRegisteredWallets().filter((item) => item.walletId !== wallet.walletId)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...wallets, wallet]))
  }

  return wallet
}

// A browser-local flag or stale signature is NEVER an ownership credential.
// Server confirmation is only shown in live component state after an authenticated
// GET/POST to /api/wallet/ownership; durable proof lives in Supabase exclusively.

export function removeRegisteredWallet(walletId: string): void {
  if (typeof window === 'undefined') return
  const wallets = loadRegisteredWallets().filter((item) => item.walletId !== walletId)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
}
