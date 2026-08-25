import type { FeedItem, FeedPlatform } from './core';

type SocialPost = {
  id: string;
  text: string;
  platforms?: FeedPlatform[];
  status: string;
  scheduledAt?: string;
};

const platformLabels: Record<FeedPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'have', 'has', 'our', 'into', 'about', 'what', 'when', 'how', 'its']);

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)));
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

/** Groups only observable social text. It does not invent engagement, trend velocity, or mentions. */
export function deriveCrossPlatformSignals(posts: SocialPost[]): FeedItem[] {
  const candidates = posts.filter((post) => post.status === 'published' || post.status === 'scheduled');
  const clusters: SocialPost[][] = [];

  for (const post of candidates) {
    const postTokens = tokens(post.text);
    if (postTokens.size < 2) continue;
    const cluster = clusters.find((group) => group.some((member) => similarity(postTokens, tokens(member.text)) >= 0.5));
    if (cluster) cluster.push(post);
    else clusters.push([post]);
  }

  return clusters
    .filter((cluster) => new Set(cluster.flatMap((post) => post.platforms ?? [])).size >= 2)
    .map((cluster) => {
      const sourcePlatforms = [...new Set(cluster.flatMap((post) => post.platforms ?? []))];
      const representative = cluster[0];
      return {
        id: `cross-platform-${cluster.map((post) => post.id).sort().join('-')}`,
        kind: 'jhadina' as const,
        label: 'Jhadina signal',
        title: 'The same topic is appearing across platforms',
        body: `${sourcePlatforms.map((platform) => platformLabels[platform]).join(' · ')} are carrying closely related content. Jhadina grouped ${cluster.length} related item${cluster.length === 1 ? '' : 's'} into one signal.`,
        status: 'insight',
        action: 'Investigate',
        href: '/growth',
        relevance: Math.min(90, 30 + sourcePlatforms.length * 15 + Math.min(cluster.length, 3) * 5),
        timestamp: representative.scheduledAt,
      };
    });
}
