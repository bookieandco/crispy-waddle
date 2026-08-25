export type FeedKind = 'work' | 'social' | 'opportunity' | 'media' | 'jhadina';
export type FeedPlatform = 'facebook' | 'instagram' | 'tiktok' | 'youtube';

export type FeedItem = {
  id: string;
  kind: FeedKind;
  label: string;
  title: string;
  body: string;
  platform?: FeedPlatform;
  status?: string;
  action?: string;
  href?: string;
  timestamp?: string;
  relevance?: number;
  personalRelevance?: number;
  relevanceReason?: string;
};

const personalProjectSignals = [
  { name: 'Jhadina', terms: ['jhadina'], weight: 35 },
  { name: 'JhadinaTV', terms: ['jhadinatv', 'jhadina tv'], weight: 40 },
  { name: 'Jhadina Music', terms: ['jhadina music'], weight: 30 },
  { name: 'OverageOS', terms: ['overageos', 'overage', 'surplus'], weight: 35 },
  { name: 'Bookie & Co.', terms: ['bookie', 'bookie & co'], weight: 25 },
];

export function personalRelevance(item: FeedItem): { score: number; reason?: string } {
  const haystack = `${item.label} ${item.title} ${item.body}`.toLowerCase();
  const matches = personalProjectSignals.filter((signal) => signal.terms.some((term) => haystack.includes(term)));
  if (!matches.length) return { score: 0 };
  const score = Math.min(100, matches.reduce((sum, signal) => sum + signal.weight, 0));
  return { score, reason: `Matches ${matches.map((signal) => signal.name).join(', ')}` };
}

export function recencyScore(timestamp?: string, now = Date.now()): number {
  if (!timestamp) return 20;
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return 20;
  const ageHours = Math.max(0, (now - parsed) / 3_600_000);
  if (ageHours <= 1) return 100;
  if (ageHours <= 6) return 80;
  if (ageHours <= 24) return 60;
  if (ageHours <= 72) return 35;
  return 10;
}

export function scoreFeedItem(item: FeedItem, now = Date.now()): number {
  const workBoost = item.kind === 'work' ? 35 : 0;
  const opportunityBoost = item.kind === 'opportunity' ? 20 : 0;
  const approvalBoost = item.status === 'PENDING_APPROVAL' || item.status === 'new' ? 45 : 0;
  const relevance = personalRelevance(item);
  return (item.relevance ?? 0) + (item.personalRelevance ?? relevance.score) + workBoost + opportunityBoost + approvalBoost + recencyScore(item.timestamp, now);
}

export function rankFeedItems(items: FeedItem[], now = Date.now()): FeedItem[] {
  return [...items].map((item) => {
    const relevance = personalRelevance(item);
    return { ...item, personalRelevance: item.personalRelevance ?? relevance.score, relevanceReason: item.relevanceReason ?? relevance.reason };
  }).sort((a, b) => scoreFeedItem(b, now) - scoreFeedItem(a, now));
}
