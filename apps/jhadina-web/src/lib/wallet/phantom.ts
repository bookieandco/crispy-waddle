export type PhantomProvider = {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string }}>
  disconnect: () => Promise<void>
  signMessage?: (message: Uint8Array, display?: 'utf8' | 'hex') => Promise<{ signature: Uint8Array; publicKey: { toString(): string }}>
  on?: (event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void) => void
  removeListener?: (event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider }
    solana?: PhantomProvider
  }
}

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null
  const provider = window.phantom?.solana ?? window.solana ?? null
  return provider?.isPhantom ? provider : null
}

export async function connectPhantom(): Promise<string> {
  const provider = getPhantomProvider()
  if (!provider) throw new Error('Phantom wallet was not detected. Install or open Phantom and try again.')

  const result = await provider.connect()
  const address = result.publicKey?.toString()
  if (!address) throw new Error('Phantom connected without returning a public address.')
  return address
}

export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantomProvider()
  if (!provider) return
  await provider.disconnect()
}

export function createOwnershipChallenge(walletAddress: string, now = new Date().toISOString()): string {
  return [
    'Jhadina wallet ownership verification',
    `Wallet: ${walletAddress}`,
    `Issued at: ${now}`,
    'Purpose: prove control of this public wallet address.',
    'This signature does not authorize a transaction or transfer.',
  ].join('\n')
}

export async function signOwnershipChallenge(walletAddress: string): Promise<Uint8Array> {
  const provider = getPhantomProvider()
  if (!provider?.signMessage) throw new Error('This Phantom provider does not expose message signing.')
  const message = new TextEncoder().encode(createOwnershipChallenge(walletAddress))
  const result = await provider.signMessage(message, 'utf8')
  return result.signature
}
