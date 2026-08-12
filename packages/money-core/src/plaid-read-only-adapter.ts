import type { BankAdapter, MoneyAccount, MoneyAdapterContext, MoneyTransaction } from './bank-adapter.js';
import { assertCapability } from './bank-adapter.js';

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
  };
};

type PlaidAccountsResponse = { accounts?: PlaidAccount[] };

export type PlaidReadOnlyAdapterOptions = {
  baseUrl: string;
  credentialBundle: string;
  timeoutMs?: number;
};

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
      maskedName: account.mask
        ? `${account.name ?? account.official_name ?? 'Account'} ••••${account.mask}`
        : account.name ?? account.official_name,
    }));
  }

  async listTransactions(context: MoneyAdapterContext, _accountId: string): Promise<MoneyTransaction[]> {
    assertCapability(context, 'money.transaction.read');
    throw new Error('PLAID_TRANSACTION_READ_NOT_IMPLEMENTED');
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
