import type { FeedItem } from './core';
import type { FeedPlatform } from './core';

type SocialPost = { id: string; text: string; platforms?: FeedPlatform[]; status: string; scheduledAt?: string };

const platforms: FeedPlatform[] = ['facebook', 'instagram', 'tiktok', 'youtube'];
const labels: Record<FeedPlatform, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };

/** Deterministic signals derived only from data already returned by the connected social provider. */
export function deriveSocialIntelligence(posts: SocialPost[]): FeedItem[] {
  const published = posts.filter((post) => post.status === 'published' || post.status === 'scheduled');
  const covered = new Set(published.flatMap((post) => post.platforms ?? []));
  const missing = platforms.filter((platform) => !covered.has(platform));
  if (!published.length || !missing.length) return [];

  return [{
    id: `social-coverage-${missing.join('-')}`,
    kind: 'jhadina',
    label: 'Jhadina insight',
    title: 'Your connected social coverage has a gap',
    body: `${published.length} recent social item${published.length === 1 ? '' : 's'} is represented across ${platforms.length - missing.length} platform${platforms.length - missing.length === 1 ? '' : 's'}. No recent item is represented on ${missing.map((platform) => labels[platform]).join(', ')}.`,
    status: 'recommendation',
    action: 'Review social coverage',
    href: '/growth',
    relevance: 25,
  }];
}
