import type { BankAdapter, MoneyAccount, MoneyStatement, MoneyTransaction } from './bank-adapter.js';

export type ReadOnlyHttpBankAdapterOptions = {
  baseUrl: string;
  accountPath: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  mapAccounts: (payload: unknown) => MoneyAccount[];
  mapTransactions?: (payload: unknown) => MoneyTransaction[];
  mapStatements?: (payload: unknown) => MoneyStatement[];
};

/** Read-only provider HTTP boundary. No payment/transfer execution is exposed. */
export class ReadOnlyHttpBankAdapter implements BankAdapter {
  constructor(private readonly options: ReadOnlyHttpBankAdapterOptions) {}

  async listAccounts(): Promise<MoneyAccount[]> {
    const payload = await this.request(this.options.accountPath);
    return this.options.mapAccounts(payload);
  }

  async listTransactions(): Promise<MoneyTransaction[]> {
    if (!this.options.mapTransactions) throw new Error('TRANSACTION_READ_NOT_CONFIGURED');
    const payload = await this.request('/transactions');
    return this.options.mapTransactions(payload);
  }

  async listStatements(): Promise<MoneyStatement[]> {
    if (!this.options.mapStatements) throw new Error('STATEMENT_READ_NOT_CONFIGURED');
    const payload = await this.request('/statements');
    return this.options.mapStatements(payload);
  }

  async createPayment(): Promise<never> { throw new Error('PAYMENT_NOT_AVAILABLE_ON_READ_ONLY_ADAPTER'); }
  async createTransfer(): Promise<never> { throw new Error('TRANSFER_NOT_AVAILABLE_ON_READ_ONLY_ADAPTER'); }

  private async request(path: string): Promise<unknown> {
    if (!this.options.baseUrl.startsWith('https://')) throw new Error('PROVIDER_HTTPS_REQUIRED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 10_000);
    try {
      const response = await fetch(new URL(path, this.options.baseUrl), {
        method: 'GET',
        headers: { accept: 'application/json', ...this.options.headers },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}
