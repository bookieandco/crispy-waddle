/** Server-only Solana Ed25519 ownership verifier. No wallet signing capability. */
import {createPublicKey, verify as ed25519Verify} from 'node:crypto'

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ED25519_SPKI = Buffer.from('302a300506032b6570032100', 'hex')

export function decodeSolanaPublicKey(address: unknown): Buffer | null {
  if (typeof address !== 'string' || address.length < 32 || address.length > 44) return null
  let total = 0n
  for (const char of address) {
    const digit = B58.indexOf(char)
    if (digit < 0) return null
    total = total * 58n + BigInt(digit)
    if (total >= (1n << 256n)) return null
  }
  const bytes: number[] = []
  while (total > 0n) {
    bytes.push(Number(total & 255n))
    total >>= 8n
  }
  bytes.reverse()
  const leading = address.match(/^1*/)?.[0].length ?? 0
  const result = Buffer.concat([Buffer.alloc(leading), Buffer.from(bytes)])
  return result.length === 32 ? result : null
}

export function validOwnershipSignature(message: unknown, address: unknown, signature: unknown): boolean {
  if (typeof message !== 'string' || message.length < 40 || message.length > 900) return false
  const publicBytes = decodeSolanaPublicKey(address)
  if (!publicBytes || typeof signature !== 'string' || signature.length > 100
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) return false
  const raw = Buffer.from(signature, 'base64')
  if (raw.length !== 64 || raw.toString('base64') !== signature) return false
  try {
    const key = createPublicKey({key: Buffer.concat([ED25519_SPKI, publicBytes]),
      format: 'der', type: 'spki'})
    return ed25519Verify(null, Buffer.from(message, 'utf8'), key, raw)
  } catch {
    return false
  }
}

export function buildOwnershipChallenge(input: {
  walletAddress: string
  nonce: string
  expiresAt: string
  origin: string
}): string {
  if (!decodeSolanaPublicKey(input.walletAddress) ||
      !/^[a-f0-9]{64}$/.test(input.nonce) ||
      !Number.isFinite(Date.parse(input.expiresAt)) ||
      !/^https:\/\/[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/.test(input.origin)) {
    throw new Error('WALLET_PROOF_CHALLENGE_INVALID')
  }
  return [
    'Jhadina Phantom wallet ownership verification',
    'Domain: ' + input.origin,
    'Wallet: ' + input.walletAddress,
    'Nonce: ' + input.nonce,
    'Expires at: ' + input.expiresAt,
    'Purpose: demonstrate control of this wallet for this signed-in owner only.',
    'This message does not authorize trades, transfers, approvals or transaction signing.',
  ].join('\n')
}
