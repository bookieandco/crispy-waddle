import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  observePinnedPhantomAgentWallet,
  type PhantomMcpReadOnlyTransport,
} from './phantom-agent-mcp-observer.js'

/**
 * Owner-host worker handler. Mount ONLY behind private HTTPS transport; never
 * route a raw MCP endpoint, session file or tool selector through HTTP.
 * The actual MCP client must be injected by a trusted owner-host bootstrap.
 * This factory deliberately does not authenticate or launch Phantom.
 */
export function createPhantomAgentObservationHttpHandler(input: Readonly<{
  transport: PhantomMcpReadOnlyTransport
  bearerToken: string
  expectedWalletId: string
  expectedSolanaAddress: string
  ownerWalletAddresses: readonly string[]
}>) {
  if (input.bearerToken.length < 32 || input.expectedWalletId.length < 8 ||
      !input.expectedSolanaAddress || input.ownerWalletAddresses.includes(input.expectedSolanaAddress)) {
    throw new Error('PHANTOM_AGENT_WORKER_UNSAFE_CONFIGURATION')
  }
  const expected = createHash('sha256').update(input.bearerToken).digest()
  let active = false
  return async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const send = (status: number, payload: Record<string, unknown>) => {
      response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      response.end(JSON.stringify(payload))
    }
    if (request.url !== '/v1/observation') return send(404, { error: 'not_found' })
    if (request.method !== 'GET') return send(405, { error: 'method_not_allowed' })
    const authorization = request.headers.authorization
    const candidate = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7) : ''
    const actual = createHash('sha256').update(candidate).digest()
    if (!candidate || !timingSafeEqual(actual, expected)) return send(401, { error: 'unauthorized' })
    if (active) return send(429, { error: 'busy' })
    active = true
    try {
      const observation = await observePinnedPhantomAgentWallet({
        transport: input.transport,
        expectedWalletId: input.expectedWalletId,
        expectedSolanaAddress: input.expectedSolanaAddress,
        ownerWalletAddresses: input.ownerWalletAddresses,
      })
      // Explicit projection prevents future additions to internal MCP response
      // objects from being sent over the read-only HTTP interface.
      send(200, {
        walletId: observation.walletId,
        solanaAddress: observation.solanaAddress,
        provider: observation.provider,
        network: observation.network,
        observedAt: observation.observedAt,
        balanceEvidenceSha256: observation.balanceEvidenceSha256,
        authority: observation.authority,
        financialAuthority: observation.financialAuthority,
        canSign: false,
        canExecute: false,
        canAuthorizeLive: false,
        spendableBalanceMinor: null,
      })
    } catch {
      send(503, { error: 'observation_unavailable' })
    } finally {
      active = false
    }
  }
}
