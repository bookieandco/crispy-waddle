import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { isAbsolute } from 'node:path'
import { RestrictedPhantomMcpStdio } from './phantom-agent-restricted-stdio.js'
import { createPhantomAgentObservationHttpHandler } from './phantom-agent-observation-http.js'
import { verifyPhantomAgentNativeSol } from './phantom-agent-chain-verification.js'
import { appendPhantomAgentStudy } from './phantom-agent-study-ledger.js'

/**
 * Owner-host-only entrypoint, not for Vercel / client bundles.
 * The Phantom binary MUST have been manually installed, pinned and reviewed
 * under a dedicated isolated OS user with an already completed owner session.
 * The process only binds to 127.0.0.1. Provide private TLS via a separate
 * authenticated reverse proxy; no public listening is allowed here.
 */
async function main() {
  const e = process.env
  if (e.PHANTOM_AGENT_OWNER_HOST_ENABLED !== 'OWNER_CONFIRMED_READ_ONLY' ||
      e.PHANTOM_AGENT_OWNER_SESSION_ATTESTED !== 'true') {
    throw new Error('PHANTOM_HOST_OWNER_ATTESTATION_REQUIRED')
  }
  const binary = e.PHANTOM_AGENT_MCP_BINARY ?? ''
  const walletId = e.PHANTOM_AGENT_PIN_WALLET_ID ?? ''
  const address = e.PHANTOM_AGENT_PIN_SOLANA_ADDRESS ?? ''
  const bearerToken = e.PHANTOM_AGENT_OBSERVER_BEARER_TOKEN ?? ''
  const rpcUrl = e.SOLANA_RPC_URL ?? ''
  const journalPath = e.PHANTOM_AGENT_STUDY_JOURNAL_PATH ?? ''
  const hmacKey = e.PHANTOM_AGENT_STUDY_HMAC_KEY ?? ''
  const port = Number(e.PHANTOM_AGENT_LOCAL_PORT ?? '43571')
  const argsRaw = e.PHANTOM_AGENT_MCP_ARGS_JSON ?? '[]'
  let args: unknown
  let ownerAddresses: unknown
  try {
    args = JSON.parse(argsRaw)
    ownerAddresses = JSON.parse(e.PHANTOM_AGENT_OWNER_WALLETS_JSON ?? '[]')
  } catch { throw new Error('PHANTOM_HOST_CONFIG_JSON_INVALID') }
  if (!isAbsolute(binary) || !isAbsolute(journalPath) ||
      !Array.isArray(args) || args.length > 12 ||
      args.some(x => typeof x !== 'string' || x.length > 500) ||
      !Array.isArray(ownerAddresses) || ownerAddresses.length < 1 ||
      ownerAddresses.some(x => typeof x !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x)) ||
      !Number.isInteger(port) || port < 1024 || port > 65535 ||
      bearerToken.length < 32 || hmacKey.length < 32 ||
      !walletId || !address || !rpcUrl.startsWith('https:')) {
    throw new Error('PHANTOM_HOST_CONFIGURATION_INVALID')
  }
  if (ownerAddresses.includes(address)) throw new Error('PHANTOM_HOST_OWNER_WALLET_COLLISION')
  const subprocess = spawn(binary, args as string[], {
    stdio: ['pipe', 'pipe', 'pipe'], shell: false,
    // Do not pass the worker bearer/HMAC secrets to the Phantom MCP process.
    env: {
      HOME: e.HOME, PATH: e.PATH, TMPDIR: e.TMPDIR,
      XDG_CONFIG_HOME: e.XDG_CONFIG_HOME,
      NODE_ENV: e.NODE_ENV,
    },
  })
  // Phantom stderr might contain a device-code URL or session metadata.
  // Never log it. If auth fails, operator must repair the host directly.
  subprocess.stderr.resume()
  const transport = new RestrictedPhantomMcpStdio(subprocess)
  try {
    await transport.initialize()
    const server = createServer(createPhantomAgentObservationHttpHandler({
      transport, bearerToken,
      expectedWalletId: walletId, expectedSolanaAddress: address,
      ownerWalletAddresses: ownerAddresses as string[],
      afterObservation: async observation => {
        const verified = await verifyPhantomAgentNativeSol({
          observation, expectedWalletId: walletId, expectedAddress: address, rpcUrl,
        })
        await appendPhantomAgentStudy({
          options: {
            path: journalPath, hmacKey,
            expectedWalletId: walletId, expectedAddress: address,
          },
          verified,
        })
      },
    }))
    server.requestTimeout = 10000
    server.headersTimeout = 10000
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', resolve)
    })
    process.once('SIGTERM', () => {
      server.close()
      transport.close()
      subprocess.kill('SIGTERM')
    })
    process.once('SIGINT', () => {
      server.close()
      transport.close()
      subprocess.kill('SIGTERM')
    })
    // No credentials, wallet details or session information are logged.
    process.stdout.write('PHANTOM_AGENT_LOCAL_OBSERVER_LISTENING\n')
  } catch (error) {
    transport.close()
    subprocess.kill('SIGTERM')
    throw error
  }
}

void main().catch(() => {
  // Fail closed without outputting private keys, provider errors or host env.
  process.stderr.write('PHANTOM_AGENT_OWNER_WORKER_START_FAILED\n')
  process.exitCode = 1
})
