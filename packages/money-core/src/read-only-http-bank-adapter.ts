import type { BankAdapter, MoneyAccount, MoneyAdapterContext, MoneyTransaction } from './bank-adapter.js';

export type HttpClient = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ReadOnlyHttpBankAdapterOptions = {
  provider: string;
  baseUrl: string;
  secret: string;
  accountPath: string;
  transactionPath?: (accountId: string) => string;
  fetchImpl?: HttpClient;
  mapAccounts: (payload: unknown, provider: string) => MoneyAccount[];
  mapTransactions?: (payload: unknown, provider: string, accountId: string) => MoneyTransaction[];
  timeoutMs?: number;
};

/** Provider-neutral read-only HTTP adapter. It deliberately has no payment/transfer methods. */
export class ReadOnlyHttpBankAdapter implements BankAdapter {
  readonly provider: string;
  private readonly fetchImpl: HttpClient;
  private readonly options: ReadOnlyHttpBankAdapterOptions;

  constructor(options: ReadOnlyHttpBankAdapterOptions) {
    if (!/^https:\/\//i.test(options.baseUrl)) throw new Error('PROVIDER_BASE_URL_MUST_USE_HTTPS');
    this.provider = options.provider;
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listAccounts(context: MoneyAdapterContext): Promise<MoneyAccount[]> {
    const payload = await this.request(this.options.accountPath, context);
    return this.options.mapAccounts(payload, this.provider);
  }

  async listTransactions(context: MoneyAdapterContext, accountId: string): Promise<MoneyTransaction[]> {
    if (!this.options.transactionPath || !this.options.mapTransactions) {
      throw new Error(`PROVIDER_TRANSACTIONS_NOT_CONFIGURED:${this.provider}`);
    }
    const path = this.options.transactionPath(accountId);
    const payload = await this.request(path, context);
    return this.options.mapTransactions(payload, this.provider, accountId);
  }

  private async request(path: string, context: MoneyAdapterContext): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10000);
    try {
      const url = new URL(path, this.options.baseUrl).toString();
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.options.secret}`,
          'X-Jhadina-Request-Id': context.requestId,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`PROVIDER_HTTP_ERROR:${this.provider}:${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
