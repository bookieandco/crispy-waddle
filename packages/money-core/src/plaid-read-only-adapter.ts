import type { BankAdapter, MoneyAccount, MoneyAdapterContext, MoneyTransaction } from './bank-adapter.js';
import { assertCapability } from './bank-adapter.js';

export const PLAID_API_VERSION = '2020-09-14' as const;

type PlaidCredentialBundle = {
  clientId: string;
  secret: string;
  accessToken: string;
};

type PlaidAccount = {
  account_id: string;
  name?: string;
  official_name?: string | null;
  mask?: string | null;
  type?: string;
  subtype?: string | null;
  balances?: {
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
    current?: number | null;
    available?: number | null;
  };
};

type PlaidAccountsResponse = { accounts?: PlaidAccount[] };

type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  date?: string;
  datetime?: string | null;
  name?: string;
  merchant_name?: string | null;
};

type PlaidTransactionsResponse = { transactions?: PlaidTransaction[] };

export type PlaidReadOnlyAdapterOptions = {
  baseUrl: string;
  credentialBundle: string;
  timeoutMs?: number;
};

/**
 * Plaid's account-read endpoint is POST /accounts/get. This adapter exposes
 * only read-only account/balance data and transaction history; no payment,
 * transfer, or account mutation path.
 */
export class PlaidReadOnlyAdapter implements BankAdapter {
  readonly provider = 'plaid';
  private readonly credentials: PlaidCredentialBundle;

  constructor(private readonly options: PlaidReadOnlyAdapterOptions) {
    this.credentials = parseCredentials(options.credentialBundle);
  }

  async listAccounts(context: MoneyAdapterContext): Promise<MoneyAccount[]> {
    assertCapability(context, 'money.account.read');
    const payload = await this.post<PlaidAccountsResponse>('/accounts/get', {
      access_token: this.credentials.accessToken,
    });

    return (payload.accounts ?? []).map((account) => ({
      id: `plaid:${account.account_id}`,
      provider: this.provider,
      externalId: account.account_id,
      type: account.subtype || account.type || 'unknown',
      currency:
        account.balances?.iso_currency_code ||
        account.balances?.unofficial_currency_code ||
        'UNKNOWN',
      currentBalance: account.balances?.current ?? undefined,
      availableBalance: account.balances?.available ?? undefined,
      maskedName: account.mask
        ? `${account.name ?? account.official_name ?? 'Account'} ••••${account.mask}`
        : account.name ?? account.official_name ?? undefined,
    }));
  }

  async listTransactions(context: MoneyAdapterContext, accountId: string): Promise<MoneyTransaction[]> {
    assertCapability(context, 'money.transaction.read');
    if (!accountId.trim()) throw new Error('MONEY_ACCOUNT_REQUIRED');

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 30);
    const payload = await this.post<PlaidTransactionsResponse>('/transactions/get', {
      access_token: this.credentials.accessToken,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      options: { account_ids: [accountId], count: 100, offset: 0 },
    });

    return (payload.transactions ?? [])
      .filter((transaction) => transaction.account_id === accountId)
      .map((transaction) => ({
        id: `plaid:${transaction.transaction_id}`,
        accountId: `plaid:${transaction.account_id}`,
        amount: transaction.amount,
        currency: transaction.iso_currency_code || transaction.unofficial_currency_code || 'UNKNOWN',
        occurredAt: transaction.datetime || transaction.date || '',
        description: transaction.merchant_name || transaction.name || undefined,
      }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.options.baseUrl.startsWith('https://')) throw new Error('PROVIDER_HTTPS_REQUIRED');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);

    try {
      const response = await fetch(new URL(path, this.options.baseUrl), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'PLAID-CLIENT-ID': this.credentials.clientId,
          'PLAID-SECRET': this.credentials.secret,
          'Plaid-Version': PLAID_API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`PLAID_HTTP_${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseCredentials(value: string): PlaidCredentialBundle {
  try {
    const parsed = JSON.parse(value) as Partial<PlaidCredentialBundle>;
    if (!parsed.clientId || !parsed.secret || !parsed.accessToken) {
      throw new Error('PLAID_CREDENTIAL_BUNDLE_INCOMPLETE');
    }
    return {
      clientId: parsed.clientId,
      secret: parsed.secret,
      accessToken: parsed.accessToken,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'PLAID_CREDENTIAL_BUNDLE_INCOMPLETE') throw error;
    throw new Error('PLAID_CREDENTIAL_BUNDLE_INVALID');
  }
}
