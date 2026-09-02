export type SolanaRpcWalletSnapshot = {
  address: string
  lamports: number
  slot: number
  observedAt: string
  source: 'solana-rpc'
}

export type ArkhamWalletSnapshot = {
  address: string
  observedAt: string
  source: 'arkham'
  data: unknown
}

function assertAddress(address: string): string {
  if (typeof address !== 'string' || address.length < 32 || address.length > 44) throw new Error('Invalid Solana wallet address.')
  return address
}

export async function observeSolanaWallet(address: string, rpcUrl: string, fetchImpl: typeof fetch = fetch): Promise<SolanaRpcWalletSnapshot> {
  const wallet = assertAddress(address)
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [wallet] }),
  })
  if (!response.ok) throw new Error(`Solana RPC request failed: ${response.status}`)
  const body = await response.json() as { result?: { value?: unknown; context?: { slot?: unknown } }; error?: unknown }
  if (body.error || typeof body.result?.value !== 'number' || typeof body.result?.context?.slot !== 'number') throw new Error('Invalid Solana RPC balance response.')
  return { address: wallet, lamports: body.result.value, slot: body.result.context.slot, observedAt: new Date().toISOString(), source: 'solana-rpc' }
}

/** Arkham is intentionally injected: credentials never live in the client bundle. */
export async function observeArkhamWallet(address: string, endpoint: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ArkhamWalletSnapshot> {
  const wallet = assertAddress(address)
  const url = new URL(endpoint)
  url.searchParams.set('address', wallet)
  const response = await fetchImpl(url, { headers: { accept: 'application/json', 'API-Key': apiKey } })
  if (!response.ok) throw new Error(`Arkham request failed: ${response.status}`)
  return { address: wallet, observedAt: new Date().toISOString(), source: 'arkham', data: await response.json() }
}

export type WalletIntelligenceObservation = SolanaRpcWalletSnapshot | ArkhamWalletSnapshot

export async function observeVerifiedWallet(address: string, options: { rpcUrl: string; arkham?: { endpoint: string; apiKey: string } }): Promise<WalletIntelligenceObservation[]> {
  const observations: WalletIntelligenceObservation[] = [await observeSolanaWallet(address, options.rpcUrl)]
  if (options.arkham) observations.push(await observeArkhamWallet(address, options.arkham.endpoint, options.arkham.apiKey))
  return observations
}
