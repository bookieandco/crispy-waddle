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

/** Sign ONLY a fresh server-issued, owner-bound, single-use message. */
export async function signOwnershipChallenge(walletAddress: string, message: string): Promise<Uint8Array> {
  const provider = getPhantomProvider()
  if (!provider?.signMessage) throw new Error('This Phantom provider does not expose message signing.')
  if (typeof message !== 'string' || message.length < 40 || message.length > 900
      || !message.includes('Wallet: ' + walletAddress)
      || !message.includes('This message does not authorize trades')) {
    throw new Error('Invalid server wallet ownership challenge.')
  }
  if (provider.publicKey?.toString() !== walletAddress)
    throw new Error('Connected Phantom account changed. Reconnect first.')
  const result = await provider.signMessage(new TextEncoder().encode(message), 'utf8')
  if (result.publicKey?.toString() !== walletAddress)
    throw new Error('Phantom signature account differs from the requested wallet.')
  if (!(result.signature instanceof Uint8Array) || result.signature.length !== 64)
    throw new Error('Phantom returned an invalid signature.')
  return result.signature
}
