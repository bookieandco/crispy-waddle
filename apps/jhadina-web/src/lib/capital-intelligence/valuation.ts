import type { CapitalLabSnapshotLike } from './snapshot';

export type ValuationQuote = {
  asset: string;
  quoteCurrency: string;
  price: number;
  observedAt: string;
  source: string;
};

export type ValuedAsset = {
  asset: string;
  quantity: number;
  quoteCurrency: string;
  unitPrice: number;
  value: number;
  priceObservedAt: string;
  priceSource: string;
};

export type PortfolioValuation = {
  baseCurrency: string;
  assets: ValuedAsset[];
  totalValue: number;
  pricedAt: string;
  complete: boolean;
  unpricedAssets: string[];
};

/**
 * Pure valuation: prices are supplied by an external market-data layer.
 * This function never fetches data and never executes trades.
 */
export function valueCapitalSnapshot(
  snapshot: CapitalLabSnapshotLike,
  quotes: ValuationQuote[],
  baseCurrency = 'USD',
  pricedAt = new Date().toISOString(),
): PortfolioValuation {
  const quoteMap = new Map(quotes.map((quote) => [quote.asset.toUpperCase(), quote]));
  const assets: ValuedAsset[] = [];
  const unpricedAssets: string[] = [];

  for (const asset of snapshot.assets) {
    const quantity = Number(asset.available);
    if (!Number.isFinite(quantity) || quantity < 0) continue;
    const symbol = asset.asset.toUpperCase();
    const quote = quoteMap.get(symbol);
    if (!quote || quote.quoteCurrency !== baseCurrency) {
      unpricedAssets.push(symbol);
      continue;
    }
    assets.push({
      asset: symbol,
      quantity,
      quoteCurrency: baseCurrency,
      unitPrice: quote.price,
      value: quantity * quote.price,
      priceObservedAt: quote.observedAt,
      priceSource: quote.source,
    });
  }

  return {
    baseCurrency,
    assets,
    totalValue: assets.reduce((sum, asset) => sum + asset.value, 0),
    pricedAt,
    complete: unpricedAssets.length === 0,
    unpricedAssets,
  };
}
