import assert from 'node:assert/strict'
import test from 'node:test'
import { ShodanHttpTransport } from './shodan-http-transport.js'

test('uses injected credential provider and never exposes mutation endpoints', async () => {
  const urls: string[] = []
  const transport = new ShodanHttpTransport(async (url, init) => {
    urls.push(url)
    assert.equal(init?.method, 'GET')
    return { ok: true, status: 200, async json() { return { ok: true } } }
  }, { async getApiKey() { return 'secret-key' } })
  await transport.read('host.read', '203.0.113.5')
  assert.match(urls[0], /\/shodan\/host\/203.0.113.5/)
  assert.match(urls[0], /key=secret-key/)
})

test('InternetDB read requires no Shodan credential', async () => {
  let credentialsCalled = false
  const transport = new ShodanHttpTransport(async (url) => {
    assert.equal(url, 'https://internetdb.shodan.io/203.0.113.5')
    return { ok: true, status: 200, async json() { return {} } }
  }, { async getApiKey() { credentialsCalled = true; return '' } })
  await transport.read('internetdb.read', '203.0.113.5')
  assert.equal(credentialsCalled, false)
})


test('all declared Shodan capabilities use GET-only transport semantics', async () => {
  const methods: Array<string | undefined> = []
  const transport = new ShodanHttpTransport(async (_url, init) => {
    methods.push(init?.method)
    return { ok: true, status: 200, async json() { return {} } }
  }, { async getApiKey() { return 'secret-key' } })
  for (const [capability, subject] of [['host.read','203.0.113.5'],['internetdb.read','203.0.113.5'],['dns.read','example.org'],['search.read','product:nginx'],['history.read','203.0.113.5']] as const) {
    await transport.read(capability, subject)
  }
  assert.deepEqual(methods, ['GET','GET','GET','GET','GET'])
})
