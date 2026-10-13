import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RestrictedPhantomMcpStdio } from './phantom-agent-restricted-stdio.js'
import {
  appendPhantomAgentStudy, readPhantomAgentStudyForShadow,
  verifyPhantomAgentStudyLedger,
} from './phantom-agent-study-ledger.js'
import type { PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'

const walletId = '05307b6d-2d5a-43d6-8d11-08db650a169b'
const address = 'H8FpYTgx4Uy9aF9Nk9fCTqKKFLYQ9KfC6UJhMkMDzCBh'
const now = '2026-10-12T21:00:00.000Z'
const later = '2026-10-12T21:00:05.000Z'

function fakeMcp(options: { mismatch?: boolean; invalidResponse?: boolean; respondToTools?: boolean; toolError?: boolean } = {}) {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams
  const stdin = new PassThrough(), stdout = new PassThrough()
  Object.assign(child, { stdin, stdout, stderr: new PassThrough(), exitCode: null })
  const calls: Array<{ method: string; params?: Record<string, unknown> }> = []
  let lineBuffer = ''
  stdin.on('data', (fragment: Buffer) => {
    lineBuffer += fragment.toString('utf8')
    for (;;) {
      const pos = lineBuffer.indexOf('\n')
      if (pos < 0) break
      const line = lineBuffer.slice(0, pos)
      lineBuffer = lineBuffer.slice(pos + 1)
      const req = JSON.parse(line) as { id?: number; method: string; params?: Record<string, unknown> }
      calls.push({ method: req.method, params: req.params })
      if (req.id === undefined) continue
      if (options.invalidResponse) {
        stdout.write('{"jsonrpc": "garbled"\n')
        continue
      }
      if (req.method === 'initialize') {
        stdout.write(JSON.stringify({
          jsonrpc: '2.0', id: req.id,
          result: {
            protocolVersion: options.mismatch ? '2024-11-05' : '2025-06-18',
            capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1' },
          },
        }) + '\n')
      } else if (req.method === 'tools/call' && options.respondToTools !== false) {
        const name = req.params?.name
        const payload = name === 'get_wallet_addresses'
          ? { walletId, addresses: [{ addressType: 'Solana', address }] }
          : { holdings: [] }
        stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: options.toolError ? { isError:true, content:[{type:'text',text:'session expired'}] } : payload }) + '\n')
      }
    }
  })
  return { child, calls, stdout }
}

test('restricted stdio negotiates MCP, invokes only allowlisted methods and arguments', async () => {
  const fake = fakeMcp()
  const transport = new RestrictedPhantomMcpStdio(fake.child)
  await transport.initialize()
  const response = await transport.callTool({
    name: 'get_wallet_addresses', arguments: { derivationIndex: 0 },
  })
  assert.equal((response as { walletId: string }).walletId, walletId)
  assert.deepEqual(fake.calls.map(x => x.method),
    ['initialize', 'notifications/initialized', 'tools/call'])
  assert.deepEqual(fake.calls[2]?.params, {
    name: 'get_wallet_addresses', arguments: { derivationIndex: 0 },
  })
  await assert.rejects(transport.callTool({
    name: 'buy_token', arguments: {},
  }), /PHANTOM_MCP_TOOL_DENIED/)
  await assert.rejects(transport.callTool({
    name: 'get_token_balances', arguments: { networks: ['ethereum'] },
  }), /PHANTOM_STDIO_UNEXPECTED_ARGUMENTS/)
  assert.equal(fake.calls.filter(x => x.method === 'tools/call').length, 1)
  transport.close()
})

test('MCP protocol mismatch and corrupt transport response both fail closed', async () => {
  const wrong = new RestrictedPhantomMcpStdio(fakeMcp({ mismatch: true }).child)
  await assert.rejects(wrong.initialize(), /PHANTOM_STDIO_PROTOCOL_OR_CAPABILITY_MISMATCH/)
  wrong.close()
  const broken = new RestrictedPhantomMcpStdio(fakeMcp({ invalidResponse: true }).child)
  await assert.rejects(broken.initialize(), /PHANTOM_STDIO_RESPONSE_INVALID/)
  broken.close()
})

function snapshot(input: { slot: number; observedAt: string; hashChar: string }): PhantomAgentVerifiedNativeSol {
  return {
    provider: 'solana-rpc-independent',
    walletId, address, balanceLamports: '1200000000', slot: input.slot,
    commitment: 'confirmed', observedAt: input.observedAt,
    evidenceHash: input.hashChar.repeat(64), phantomEvidenceHash: 'c'.repeat(64),
    authority: 'CHAIN_OBSERVATION_ONLY', financialAuthority: 'NONE',
    canSign: false, canExecute: false, canAuthorizeLive: false, spendableBalanceMinor: null,
  }
}
const key = 'super-secret-isolated-mock-key-not-production-' + 'x'.repeat(32)
async function withTemp<T>(run: (path: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'phantom-study-'))
  try { return await run(join(directory, 'study.jsonl')) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

test('forward study ledger is chained, auditable, non-executing, and read-only in SHADOW', async () =>
  withTemp(async path => {
    const options = { path, hmacKey: key, expectedWalletId: walletId, expectedAddress: address }
    const first = await appendPhantomAgentStudy({ options, verified: snapshot({slot:101,observedAt:now,hashChar:'a'}), writtenAt:now })
    const second = await appendPhantomAgentStudy({ options, verified: snapshot({slot:102,observedAt:later,hashChar:'b'}), writtenAt:later })
    assert.equal(first.sequence, 1)
    assert.equal(second.sequence, 2)
    assert.equal(second.previousDigest, first.digest)
    const verify = await verifyPhantomAgentStudyLedger(options)
    assert.equal(verify.count, 2)
    assert.equal(verify.headDigest, second.digest)
    assert.equal(verify.canExecute, false)
    const research = await readPhantomAgentStudyForShadow(options)
    assert.equal(research.length, 2)
    assert.equal(research[1]?.parentCaseId, research[0]?.caseId)
    assert.equal(research[1]?.authority, 'SHADOW_LEARNING_ONLY')
    assert.equal(research[1]?.canExecute, false)
    assert.equal(research[1]?.realizedPnl, null)
    assert.equal(research[1]?.simulatedPnl, null)
    assert.ok(research[1]?.evidenceIds.includes('phantom-study:hmac-sha256:' + second.digest))
  }))

test('study replay, older slot and owner pin mismatch are refused', async () =>
  withTemp(async path => {
    const options = { path, hmacKey: key, expectedWalletId: walletId, expectedAddress: address }
    const initial = snapshot({ slot: 101, observedAt: now, hashChar: 'a' })
    await appendPhantomAgentStudy({ options, verified: initial, writtenAt: now })
    await assert.rejects(appendPhantomAgentStudy({ options, verified: initial, writtenAt: later }),
      /PHANTOM_STUDY_REPLAY_OR_OUT_OF_ORDER/)
    await assert.rejects(appendPhantomAgentStudy({
      options, verified: snapshot({ slot: 100, observedAt: later, hashChar: 'b' }), writtenAt: later,
    }), /PHANTOM_STUDY_REPLAY_OR_OUT_OF_ORDER/)
    await assert.rejects(appendPhantomAgentStudy({
      options: { ...options, expectedWalletId: 'another-account' },
      verified: snapshot({ slot: 102, observedAt: later, hashChar: 'b' }), writtenAt: later,
    }), /PHANTOM_STUDY_UNVERIFIED_EVIDENCE/)
  }))

test('corrupted receipts, forged history, and incorrect MAC key fail verification', async () =>
  withTemp(async path => {
    const options = { path, hmacKey: key, expectedWalletId: walletId, expectedAddress: address }
    await appendPhantomAgentStudy({ options, verified: snapshot({slot:101,observedAt:now,hashChar:'a'}), writtenAt:now })
    await assert.rejects(verifyPhantomAgentStudyLedger({ ...options, hmacKey:'wrong-secret-value'.repeat(4) }),
      /PHANTOM_STUDY_HMAC_MISMATCH/)
    const raw = await readFile(path, 'utf8')
    await writeFile(path, raw.replace('1200000000', '9900000000'), { mode: 0o600 })
    await assert.rejects(verifyPhantomAgentStudyLedger(options), /PHANTOM_STUDY_HMAC_MISMATCH/)
    await writeFile(path, raw.slice(0, -4), { mode: 0o600 })
    await assert.rejects(verifyPhantomAgentStudyLedger(options), /PHANTOM_STUDY_TRUNCATED/)
  }))

test('untrusted, stale and overly permissive evidence never enters study ledger', async () =>
  withTemp(async path => {
    const options = { path, hmacKey: key, expectedWalletId: walletId, expectedAddress: address }
    await assert.rejects(appendPhantomAgentStudy({
      options, verified: { ...snapshot({slot:101,observedAt:now,hashChar:'a'}), canExecute: true } as unknown as PhantomAgentVerifiedNativeSol,
      writtenAt: now,
    }), /PHANTOM_STUDY_UNVERIFIED_EVIDENCE/)
    await assert.rejects(appendPhantomAgentStudy({
      options, verified: snapshot({slot:101,observedAt:now,hashChar:'a'}), writtenAt: '2026-10-12T21:20:00.000Z',
    }), /PHANTOM_STUDY_STALE_EVIDENCE/)
    const verify = await verifyPhantomAgentStudyLedger(options)
    assert.equal(verify.count, 0)
  }))

test('expired/revoked Phantom session latches closed; restart must be owner initiated',async()=>{
  const fake=fakeMcp({toolError:true})
  const transport=new RestrictedPhantomMcpStdio(fake.child)
  await transport.initialize()
  await assert.rejects(transport.callTool({
    name:'get_wallet_addresses',arguments:{derivationIndex:0},
  }),/PHANTOM_STDIO_REMOTE_ERROR/)
  await assert.rejects(transport.callTool({
    name:'get_wallet_addresses',arguments:{derivationIndex:0},
  }),/PHANTOM_STDIO_NOT_READY/)
  assert.equal(fake.calls.filter(x=>x.method==='tools/call').length,1)
  assert.equal(fake.calls.filter(x=>x.method==='phantom_login').length,0)
  transport.close()
})

test('worker process exit rejects future MCP access instead of silently restarting',async()=>{
  const fake=fakeMcp()
  const transport=new RestrictedPhantomMcpStdio(fake.child)
  await transport.initialize()
  fake.child.emit('exit',1)
  await assert.rejects(transport.callTool({
    name:'get_wallet_addresses',arguments:{derivationIndex:0},
  }),/PHANTOM_STDIO_NOT_READY/)
  assert.equal(fake.calls.filter(x=>x.method==='phantom_login').length,0)
})
