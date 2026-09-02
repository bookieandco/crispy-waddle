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
    return Array.isArray(parsed) ? (parsed as RegisteredWallet[]) : []
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

export function markWalletOwnershipVerified(walletId: string, now = new Date().toISOString()): RegisteredWallet | null {
  const wallet = loadRegisteredWallets().find((item) => item.walletId === walletId)
  if (!wallet || typeof window === 'undefined') return wallet ?? null

  const updated: RegisteredWallet = {
    ...wallet,
    connectionState: 'ownership-verified',
    lastSeenAt: now,
  }
  const wallets = loadRegisteredWallets().map((item) => item.walletId === walletId ? updated : item)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
  return updated
}

export function removeRegisteredWallet(walletId: string): void {
  if (typeof window === 'undefined') return
  const wallets = loadRegisteredWallets().filter((item) => item.walletId !== walletId)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
}
