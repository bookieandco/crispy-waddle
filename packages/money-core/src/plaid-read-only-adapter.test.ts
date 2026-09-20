import { PlaidReadOnlyAdapter } from './plaid-read-only-adapter.js';

const originalFetch = globalThis.fetch;

const credentials = JSON.stringify({
  clientId: 'client-test',
  secret: 'secret-test',
  accessToken: 'access-sandbox-test',
});

try {
  let request: RequestInit | undefined;
  let url = '';

  globalThis.fetch = async (input, init) => {
    url = String(input);
    request = init;
    return new Response(JSON.stringify({
      accounts: [{
        account_id: 'acct-123',
        name: 'Checking',
        mask: '4242',
        type: 'depository',
        subtype: 'checking',
        balances: { iso_currency_code: 'USD', current: 1250.5, available: 1100.25 },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const adapter = new PlaidReadOnlyAdapter({
    baseUrl: 'https://sandbox.plaid.com',
    credentialBundle: credentials,
  });

  const accounts = await adapter.listAccounts({
    userId: 'user-test',
    capability: 'money.account.read',
    requestId: 'req-test',
  });

  if (accounts.length !== 1) throw new Error('PLAID_ACCOUNT_MAPPING_FAILED');
  if (accounts[0].externalId !== 'acct-123') throw new Error('PLAID_EXTERNAL_ID_FAILED');
  if (accounts[0].currency !== 'USD') throw new Error('PLAID_CURRENCY_MAPPING_FAILED');
  if (accounts[0].maskedName !== 'Checking ••••4242') throw new Error('PLAID_MASK_MAPPING_FAILED');
  if (accounts[0].currentBalance !== 1250.5) throw new Error('PLAID_CURRENT_BALANCE_MAPPING_FAILED');
  if (accounts[0].availableBalance !== 1100.25) throw new Error('PLAID_AVAILABLE_BALANCE_MAPPING_FAILED');
  if (url !== 'https://sandbox.plaid.com/accounts/get') throw new Error('PLAID_ENDPOINT_FAILED');

  const body = JSON.parse(String(request?.body));
  if (body.access_token !== 'access-sandbox-test') throw new Error('PLAID_ACCESS_TOKEN_FAILED');
  const headers = new Headers(request?.headers);
  if (headers.get('PLAID-CLIENT-ID') !== 'client-test') throw new Error('PLAID_CLIENT_HEADER_FAILED');
  if (headers.get('PLAID-SECRET') !== 'secret-test') throw new Error('PLAID_SECRET_HEADER_FAILED');
  if (headers.get('Plaid-Version') !== '2020-09-14') throw new Error('PLAID_VERSION_HEADER_FAILED');

  globalThis.fetch = async (input, init) => {
    url = String(input); request = init;
    return new Response(JSON.stringify({ transactions: [{ transaction_id:'txn-1', account_id:'acct-123', amount:12.5, iso_currency_code:'USD', date:'2026-09-20', merchant_name:'Test Merchant' }] }), { status:200, headers:{'content-type':'application/json'} });
  };
  const transactions = await adapter.listTransactions({ userId:'user-test', capability:'money.transaction.read', requestId:'req-txn' }, 'acct-123');
  if (transactions.length !== 1 || transactions[0].id !== 'plaid:txn-1') throw new Error('PLAID_TRANSACTION_MAPPING_FAILED');
  if (transactions[0].accountId !== 'plaid:acct-123' || transactions[0].amount !== 12.5) throw new Error('PLAID_TRANSACTION_FIELDS_FAILED');
  if (String(url) !== 'https://sandbox.plaid.com/transactions/get') throw new Error('PLAID_TRANSACTION_ENDPOINT_FAILED');
  const transactionBody = JSON.parse(String(request?.body));
  if (transactionBody.options?.account_ids?.[0] !== 'acct-123') throw new Error('PLAID_TRANSACTION_ACCOUNT_FILTER_FAILED');

  let invalidRejected = false;
  try {
    new PlaidReadOnlyAdapter({ baseUrl: 'https://sandbox.plaid.com', credentialBundle: '{}' });
  } catch {
    invalidRejected = true;
  }
  if (!invalidRejected) throw new Error('PLAID_CREDENTIAL_VALIDATION_FAILED');

  console.log('Plaid read-only adapter passed');
} finally {
  globalThis.fetch = originalFetch;
}
