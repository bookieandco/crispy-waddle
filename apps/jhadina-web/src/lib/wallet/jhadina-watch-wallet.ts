/**
 * Owner-created, local-device-only Jhadina Purse watch address.
 *
 * This is NOT a Phantom MCP wallet binding, browser wallet connection,
 * custody proof, verified signer, Coffer account, deposit instruction,
 * money balance, or permissions/authority record.
 *
 * Never send this record to the trading or wallet-connector APIs.
 */
export type JhadinaOwnerCreatedWatchWallet = Readonly<{
  schema: 'jhadina.purse.owner-created-watch.v1'
  network: 'SOLANA_MAINNET'
  address: string
  purpose: 'JHADINA_DEDICATED'
  custody: 'OWNER_CREATED_UNVERIFIED'
  status: 'LOCAL_WATCH_ONLY_UNVERIFIED'
  observationEnabled: false
  verifiedControl: false
  phantomMcpConnected: false
  canSign: false
  canExecute: false
  canMoveMoney: false
  registeredAt: string
}>

export const JHADINA_WATCH_STORAGE_KEY = 'jhadina.purse.owner-created-watch.v1'
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** A Solana address must decode to exactly 32 bytes; Base58 appearance alone
 * does not establish key ownership, account existence or mainnet funding. */
export function isSolanaPublicAddress(candidate: string): boolean {
  if (!BASE58.test(candidate)) return false
  let decoded = 0n
  for (const char of candidate) {
    const digit = ALPHABET.indexOf(char)
    if (digit < 0) return false
    decoded = decoded * 58n + BigInt(digit)
  }
  const zeroBytes = candidate.length - candidate.replace(/^1+/, '').length
  let nonZeroBytes = 0
  for (let value = decoded; value > 0n; value >>= 8n) nonZeroBytes++
  return zeroBytes + nonZeroBytes === 32
}

export function createJhadinaWatchWallet(input: Readonly<{
  address: string
  existingWalletAddresses?: readonly string[]
  registeredAt?: string
}>): JhadinaOwnerCreatedWatchWallet {
  const address = input.address.trim()
  if (!isSolanaPublicAddress(address)) {
    throw new Error('JHADINA_WATCH_SOLANA_ADDRESS_INVALID')
  }
  if ((input.existingWalletAddresses ?? []).includes(address)) {
    // An owner-browser, MCP or Coffer wallet cannot silently become a second
    // identity in a different custody role.
    throw new Error('JHADINA_WATCH_WALLET_ROLE_COLLISION')
  }
  const registeredAt = input.registeredAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(registeredAt))) {
    throw new Error('JHADINA_WATCH_REGISTERED_AT_INVALID')
  }
  return Object.freeze({
    schema: 'jhadina.purse.owner-created-watch.v1',
    network: 'SOLANA_MAINNET',
    address,
    purpose: 'JHADINA_DEDICATED',
    custody: 'OWNER_CREATED_UNVERIFIED',
    status: 'LOCAL_WATCH_ONLY_UNVERIFIED',
    observationEnabled: false,
    verifiedControl: false,
    phantomMcpConnected: false,
    canSign: false,
    canExecute: false,
    canMoveMoney: false,
    registeredAt,
  })
}

export function loadJhadinaWatchWallet(): JhadinaOwnerCreatedWatchWallet | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(JHADINA_WATCH_STORAGE_KEY)
    if (!raw || raw.length > 2048) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (record.schema !== 'jhadina.purse.owner-created-watch.v1' ||
      record.network !== 'SOLANA_MAINNET' ||
      record.purpose !== 'JHADINA_DEDICATED' ||
      typeof record.address !== 'string' ||
      typeof record.registeredAt !== 'string') return null
    // Never trust arbitrary localStorage authority flags. Reconstruct them
    // from the mandatory zero-permissions contract, not from saved JSON.
    return createJhadinaWatchWallet({
      address: record.address,
      registeredAt: record.registeredAt,
    })
  } catch { return null }
}

export function saveJhadinaWatchWallet(input: Parameters<typeof createJhadinaWatchWallet>[0]) {
  const value = createJhadinaWatchWallet(input)
  if (typeof window === 'undefined') {
    throw new Error('JHADINA_WATCH_BROWSER_REQUIRED')
  }
  window.localStorage.setItem(JHADINA_WATCH_STORAGE_KEY, JSON.stringify(value))
  return value
}

export function clearJhadinaWatchWallet() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(JHADINA_WATCH_STORAGE_KEY)
}
