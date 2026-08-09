export type ShoppingSource = 'amazon' | 'ebay' | 'retailer' | 'grocery' | 'restaurant' | 'local' | 'unknown';

export interface ShoppingSearchRequest {
  query: string;
  source?: ShoppingSource | 'all';
  filters?: { maxPrice?: number; size?: string; color?: string; condition?: 'new' | 'used' | 'any'; nearby?: boolean };
}

export interface ShoppingResult {
  id: string;
  title: string;
  source: ShoppingSource;
  price?: number;
  currency?: string;
  imageUrl?: string;
  url?: string;
  availability?: string;
  distanceMiles?: number;
}

export interface ShoppingSearchResponse {
  query: string;
  results: ShoppingResult[];
  comparedSources: ShoppingSource[];
}

export function createShoppingSearch(query: string, options: Omit<ShoppingSearchRequest, 'query'> = {}): ShoppingSearchRequest {
  return { query: query.trim(), source: 'all', ...options };
}

export function rankShoppingResults(results: ShoppingResult[]): ShoppingResult[] {
  return [...results].sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY));
}
