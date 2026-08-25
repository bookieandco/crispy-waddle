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
};

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
  return (item.relevance ?? 0) + workBoost + opportunityBoost + approvalBoost + recencyScore(item.timestamp, now);
}

export function rankFeedItems(items: FeedItem[], now = Date.now()): FeedItem[] {
  return [...items].sort((a, b) => scoreFeedItem(b, now) - scoreFeedItem(a, now));
}
