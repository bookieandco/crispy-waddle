import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { PHANTOM_MCP_READ_ONLY_POLICY, assertPhantomMcpReadOnlyTool, type PhantomMcpReadOnlyTransport } from './phantom-agent-mcp-observer.js'

/**
 * Minimal 2025-06-18 stdio MCP client for a trusted owner-host launcher.
 * The caller starts a reviewed, version-pinned Phantom MCP subprocess as a
 * dedicated OS user. This adapter never starts login, creates a session, or
 * passes a user/LLM-supplied method name to the child.
 *
 * IMPORTANT: the child itself still has wallet signing capabilities. The
 * model must never have access to this transport, child handle or OS account.
 * An isolated worker and controlled egress are mandatory; this wrapper alone
 * is not a signing sandbox.
 */
type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}
type RecordValue = Record<string, unknown>
const supportedVersion = '2025-06-18'
const MAX_FRAME = 262144
const requestTimeoutMs = 6000
function record(value: unknown): RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('PHANTOM_STDIO_PROTOCOL_INVALID')
  }
  return value as RecordValue
}
export class RestrictedPhantomMcpStdio implements PhantomMcpReadOnlyTransport {
  private nextId = 0
  private pending = new Map<number, Pending>()
  private initialized = false
  private disposed = false
  private incoming = ''
  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on('data', (chunk: Buffer | string) => this.receive(String(chunk)))
    child.on('error', () => this.shutdown('PHANTOM_STDIO_PROCESS_ERROR'))
    child.on('exit', () => this.shutdown('PHANTOM_STDIO_PROCESS_EXITED'))
    child.stdin.on('error', () => this.shutdown('PHANTOM_STDIO_STREAM_ERROR'))
  }
  private shutdown(code: string) {
    this.disposed = true
    for (const task of this.pending.values()) {
      clearTimeout(task.timer)
      task.reject(new Error(code))
    }
    this.pending.clear()
  }
  private receive(fragment: string) {
    if (this.disposed) return
    this.incoming += fragment
    if (Buffer.byteLength(this.incoming, 'utf8') > MAX_FRAME) {
      this.shutdown('PHANTOM_STDIO_RESPONSE_OVERSIZE')
      return
    }
    for (;;) {
      const newline = this.incoming.indexOf('\n')
      if (newline < 0) break
      const line = this.incoming.slice(0, newline).replace(/\r$/, '')
      this.incoming = this.incoming.slice(newline + 1)
      if (!line.trim()) continue
      let parsed: RecordValue
      try { parsed = record(JSON.parse(line)) } catch {
        this.shutdown('PHANTOM_STDIO_RESPONSE_INVALID')
        return
      }
      // Ignore server-originated notifications, never respond to server-originated
      // requests for sampling, roots, elicitation, login or other capabilities.
      if (typeof parsed.id !== 'number' || !Number.isInteger(parsed.id)) continue
      const pending = this.pending.get(parsed.id)
      if (!pending) continue
      this.pending.delete(parsed.id)
      clearTimeout(pending.timer)
      if (parsed.jsonrpc !== '2.0' || parsed.error !== undefined ||
          (parsed.result !== null && typeof parsed.result === 'object' &&
            (parsed.result as RecordValue).isError === true)) {
        // Expired/revoked session or provider failure is sticky. A fresh,
        // owner-confirmed process is required; NEVER trigger phantom_login.
        pending.reject(new Error('PHANTOM_STDIO_REMOTE_ERROR'))
        this.shutdown('PHANTOM_STDIO_REMOTE_ERROR')
      } else {
        pending.resolve(parsed.result)
      }
    }
  }
  private write(message: unknown) {
    if (this.disposed || this.child.exitCode !== null || this.child.stdin.destroyed) {
      throw new Error('PHANTOM_STDIO_NOT_AVAILABLE')
    }
    const line = JSON.stringify(message) + '\n'
    if (Buffer.byteLength(line) > 4096) throw new Error('PHANTOM_STDIO_REQUEST_TOO_LARGE')
    if (!this.child.stdin.write(line)) throw new Error('PHANTOM_STDIO_BACKPRESSURE')
  }
  private request(method: 'initialize' | 'tools/call', params: RecordValue): Promise<unknown> {
    if (this.pending.size) return Promise.reject(new Error('PHANTOM_STDIO_CONCURRENT_REQUEST_DENIED'))
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        this.shutdown('PHANTOM_STDIO_REQUEST_TIMEOUT')
        reject(new Error('PHANTOM_STDIO_REQUEST_TIMEOUT'))
      }, requestTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try { this.write({ jsonrpc: '2.0', id, method, params }) }
      catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      }
    })
  }
  async initialize() {
    if (this.initialized || this.disposed) throw new Error('PHANTOM_STDIO_ALREADY_INITIALIZED_OR_CLOSED')
    const response = record(await this.request('initialize', {
      protocolVersion: supportedVersion, capabilities: {},
      clientInfo: { name: 'jhadina-phantom-readonly', version: '0.1.0' },
    }))
    if (response.protocolVersion !== supportedVersion ||
        !response.capabilities || typeof response.capabilities !== 'object' ||
        !(response.capabilities as RecordValue).tools) {
      this.shutdown('PHANTOM_STDIO_PROTOCOL_OR_CAPABILITY_MISMATCH')
      throw new Error('PHANTOM_STDIO_PROTOCOL_OR_CAPABILITY_MISMATCH')
    }
    this.write({ jsonrpc: '2.0', method: 'notifications/initialized' })
    this.initialized = true
  }
  async callTool(request: Readonly<{ name: string; arguments: Readonly<RecordValue> }>): Promise<unknown> {
    if (!this.initialized || this.disposed) throw new Error('PHANTOM_STDIO_NOT_READY')
    assertPhantomMcpReadOnlyTool(request.name)
    // Recreate the exact arguments, reject additional keys, and never accept
    // any caller-controlled tool parameters.
    const args = request.name === 'get_wallet_addresses'
      ? { derivationIndex: 0 }
      : request.name === 'get_token_balances'
        ? { networks: ['solana'], derivationIndex: 0 }
        : {}
    if (JSON.stringify(request.arguments) !== JSON.stringify(args)) {
      throw new Error('PHANTOM_STDIO_UNEXPECTED_ARGUMENTS')
    }
    if (!PHANTOM_MCP_READ_ONLY_POLICY.tools.includes(request.name)) {
      throw new Error('PHANTOM_STDIO_TOOL_DENIED')
    }
    return this.request('tools/call', { name: request.name, arguments: args })
  }
  close() {
    this.shutdown('PHANTOM_STDIO_CLOSED')
    this.child.stdin.end()
  }
}
