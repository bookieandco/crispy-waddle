import type { AlpacaStockFeed } from './alpaca-stock-market-data.js';
import type { PaperAutopilotMode } from './paper-learning-loop.js';

export const PAPER_AUTOPILOT_SETTINGS_SCHEMA_VERSION =
  'MONEY-PAPER-SETTINGS-01' as const;

export type PaperAutopilotSettings = Readonly<{
  schemaVersion: typeof PAPER_AUTOPILOT_SETTINGS_SCHEMA_VERSION;
  userId: string;
  provider: 'alpaca';
  accountId: string;
  mode: PaperAutopilotMode;
  stockFeed: AlpacaStockFeed;
  strategyId: string;
  baseOrderNotionalMinor: string;
  maxOrderNotionalMinor: string;
  maximumConcurrentPositions: number;
  allowOpeningShorts: false;
  updatedAt: string;
  evidenceIds: readonly string[];
  authority: 'USER_PAPER_CONFIG_ONLY';
  canAuthorizeLive: false;
}>;

export interface PaperAutopilotSettingsStore {
  put(settings: PaperAutopilotSettings): Promise<void> | void;
  get(
    userId: string,
    provider: 'alpaca',
    accountId: string,
  ): Promise<PaperAutopilotSettings | undefined> | PaperAutopilotSettings | undefined;
}

function positiveMinor(value: string, code: string): bigint {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(code);
  return BigInt(value);
}

export function createPaperAutopilotSettings(
  input: Omit<
    PaperAutopilotSettings,
    | 'schemaVersion'
    | 'provider'
    | 'allowOpeningShorts'
    | 'authority'
    | 'canAuthorizeLive'
  >,
): PaperAutopilotSettings {
  if (!input.userId.trim() || !input.accountId.trim() || !input.strategyId.trim()) {
    throw new Error('MONEY_PAPER_SETTINGS_IDENTITY_REQUIRED');
  }
  if (Number.isNaN(Date.parse(input.updatedAt))) {
    throw new Error('MONEY_PAPER_SETTINGS_TIME_INVALID');
  }
  const base = positiveMinor(
    input.baseOrderNotionalMinor,
    'MONEY_PAPER_SETTINGS_BASE_NOTIONAL_INVALID',
  );
  const max = positiveMinor(
    input.maxOrderNotionalMinor,
    'MONEY_PAPER_SETTINGS_MAX_NOTIONAL_INVALID',
  );
  if (base > max) throw new Error('MONEY_PAPER_SETTINGS_BASE_EXCEEDS_MAX');
  if (
    !Number.isInteger(input.maximumConcurrentPositions) ||
    input.maximumConcurrentPositions < 1 ||
    input.maximumConcurrentPositions > 100
  ) {
    throw new Error('MONEY_PAPER_SETTINGS_POSITION_LIMIT_INVALID');
  }
  if (!input.evidenceIds.length) {
    throw new Error('MONEY_PAPER_SETTINGS_EVIDENCE_REQUIRED');
  }

  return Object.freeze({
    ...input,
    evidenceIds: Object.freeze([...input.evidenceIds]),
    schemaVersion: PAPER_AUTOPILOT_SETTINGS_SCHEMA_VERSION,
    provider: 'alpaca',
    allowOpeningShorts: false,
    authority: 'USER_PAPER_CONFIG_ONLY',
    canAuthorizeLive: false,
  });
}

export class InMemoryPaperAutopilotSettingsStore
  implements PaperAutopilotSettingsStore
{
  private readonly rows = new Map<string, PaperAutopilotSettings>();

  put(settings: PaperAutopilotSettings): void {
    this.rows.set(
      settings.userId + ':' + settings.provider + ':' + settings.accountId,
      settings,
    );
  }

  get(
    userId: string,
    provider: 'alpaca',
    accountId: string,
  ): PaperAutopilotSettings | undefined {
    return this.rows.get(userId + ':' + provider + ':' + accountId);
  }
}
