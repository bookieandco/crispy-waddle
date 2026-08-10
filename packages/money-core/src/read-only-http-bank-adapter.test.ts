import { ReadOnlyHttpBankAdapter } from './read-only-http-bank-adapter.js';

const requests: Array<{ url: string; init?: RequestInit }> = [];
const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({ url: String(input), init });
  return new Response(JSON.stringify({ accounts: [{ id: 'acct-1' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const adapter = new ReadOnlyHttpBankAdapter({
  provider: 'test-provider',
  baseUrl: 'https://bank.example.test',
  secret: 'do-not-log',
  accountPath: '/v1/accounts',
  fetchImpl: fakeFetch,
  mapAccounts: (payload, provider) => [{
    id: 'a1', provider, externalId: String((payload as { accounts: Array<{ id: string }> }).accounts[0].id),
    type: 'checking', currency: 'USD',
  }],
});

const accounts = await adapter.listAccounts({ userId: 'u1', capability: 'money.account.read', requestId: 'req-1' });
if (accounts[0]?.externalId !== 'acct-1') throw new Error('HTTP_ADAPTER_MAPPING_FAILED');
if (!requests[0]?.init?.headers || String((requests[0].init.headers as Record<string, string>).Authorization) !== 'Bearer do-not-log') {
  throw new Error('HTTP_ADAPTER_AUTH_FAILED');
}

let insecureRejected = false;
try {
  new ReadOnlyHttpBankAdapter({ provider: 'x', baseUrl: 'http://insecure.example', secret: 'x', accountPath: '/accounts', mapAccounts: () => [] });
} catch { insecureRejected = true; }
if (!insecureRejected) throw new Error('HTTP_ADAPTER_ACCEPTED_INSECURE_URL');

console.log('Read-only HTTP bank adapter passed');
