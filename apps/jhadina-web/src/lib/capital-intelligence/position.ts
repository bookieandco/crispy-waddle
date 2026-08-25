import type { CapitalDomain, Money } from './domain';

export type Position = {
  id: string;
  accountId: string;
  domain: CapitalDomain;
  instrument: string;
  quantity: number;
  averageCost: Money;
  currentValue?: Money;
  realizedPnl?: Money;
  unrealizedPnl?: Money;
};

export type Lot = {
  id: string;
  positionId: string;
  quantity: number;
  unitCost: Money;
  acquiredAt: string;
  sourceTransactionId: string;
};

export type PositionTransaction = {
  id: string;
  accountId: string;
  instrument: string;
  domain: CapitalDomain;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: Money;
  fees?: Money;
  occurredAt: string;
};

export type RealizedLotMatch = {
  lotId: string;
  quantity: number;
  proceeds: Money;
  cost: Money;
  realizedPnl: Money;
};

export function applyBuy(position: Position | undefined, transaction: PositionTransaction, lotId = `lot-${transaction.id}`): { position: Position; lot: Lot } {
  if (transaction.side !== 'buy' || transaction.quantity <= 0) throw new Error('POSITION_BUY_INVALID');
  const gross = transaction.quantity * transaction.unitPrice.amount + (transaction.fees?.amount ?? 0);
  const existingQuantity = position?.quantity ?? 0;
  const existingCost = existingQuantity * (position?.averageCost.amount ?? 0);
  const quantity = existingQuantity + transaction.quantity;
  const averageCost = (existingCost + gross) / quantity;
  const next: Position = position ? { ...position, quantity, averageCost: { amount: averageCost, currency: transaction.unitPrice.currency } } : {
    id: `position-${transaction.accountId}-${transaction.instrument}`,
    accountId: transaction.accountId,
    domain: transaction.domain,
    instrument: transaction.instrument,
    quantity,
    averageCost: { amount: averageCost, currency: transaction.unitPrice.currency },
    realizedPnl: { amount: 0, currency: transaction.unitPrice.currency },
  };
  return { position: next, lot: { id: lotId, positionId: next.id, quantity: transaction.quantity, unitCost: { amount: gross / transaction.quantity, currency: transaction.unitPrice.currency }, acquiredAt: transaction.occurredAt, sourceTransactionId: transaction.id } };
}

export function matchLotsForSale(lots: Lot[], transaction: PositionTransaction): RealizedLotMatch[] {
  if (transaction.side !== 'sell' || transaction.quantity <= 0) throw new Error('POSITION_SELL_INVALID');
  let remaining = transaction.quantity;
  const matches: RealizedLotMatch[] = [];
  for (const lot of lots) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, lot.quantity);
    const proceeds = quantity * transaction.unitPrice.amount - (transaction.fees?.amount ?? 0) * (quantity / transaction.quantity);
    const cost = quantity * lot.unitCost.amount;
    matches.push({ lotId: lot.id, quantity, proceeds: { amount: proceeds, currency: transaction.unitPrice.currency }, cost: { amount: cost, currency: lot.unitCost.currency }, realizedPnl: { amount: proceeds - cost, currency: transaction.unitPrice.currency } });
    remaining -= quantity;
  }
  if (remaining > 0) throw new Error('POSITION_INSUFFICIENT_LOTS');
  return matches;
}
