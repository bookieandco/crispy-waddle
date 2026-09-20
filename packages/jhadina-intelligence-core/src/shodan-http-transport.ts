import type { ShodanReadCapability, ShodanTransport } from './shodan-readonly-adapter.js'

export type ShodanHttpClient = (url: string, init?: { method?: 'GET'; headers?: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

export type ShodanCredentialProvider = { getApiKey(): Promise<string> }

const API_BASE = 'https://api.shodan.io'
const INTERNETDB_BASE = 'https://internetdb.shodan.io'

function endpoint(capability: ShodanReadCapability, subject: string, key: string): string {
  const s = encodeURIComponent(subject)
  switch (capability) {
    case 'host.read': return `${API_BASE}/shodan/host/${s}?key=${encodeURIComponent(key)}`
    case 'internetdb.read': return `${INTERNETDB_BASE}/${s}`
    case 'dns.read': return `${API_BASE}/dns/resolve?hostnames=${s}&key=${encodeURIComponent(key)}`
    case 'search.read': return `${API_BASE}/shodan/host/search?query=${s}&key=${encodeURIComponent(key)}`
    case 'history.read': return `${API_BASE}/shodan/host/${s}?history=true&key=${encodeURIComponent(key)}`
  }
}

export class ShodanHttpTransport implements ShodanTransport {
  constructor(private readonly http: ShodanHttpClient, private readonly credentials: ShodanCredentialProvider) {}

  async read(capability: ShodanReadCapability, subject: string): Promise<unknown> {
    if (!subject.trim()) throw new Error('SHODAN_SUBJECT_REQUIRED')
    const key = capability === 'internetdb.read' ? '' : await this.credentials.getApiKey()
    if (capability !== 'internetdb.read' && !key.trim()) throw new Error('SHODAN_CREDENTIAL_REQUIRED')
    const response = await this.http(endpoint(capability, subject, key), { method: 'GET', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`SHODAN_HTTP_${response.status}`)
    return response.json()
  }
}
