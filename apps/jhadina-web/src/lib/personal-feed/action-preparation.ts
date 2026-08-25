import type { FeedItem } from './core';

export type PreparedPostPlatform = 'facebook' | 'instagram' | 'tiktok' | 'youtube';

export interface PreparedPostDraft {
  actionId: string;
  sourceItemId: string;
  action: 'prepare_post';
  title: string;
  why: string;
  platforms: PreparedPostPlatform[];
  caption: string;
  media: string[];
  hashtags: string[];
  scheduledAt?: string;
  audience?: string;
  requiresApproval: true;
  status: 'pending';
}

export function canPreparePost(item: FeedItem): boolean {
  return item.kind === 'social' || item.kind === 'media' || item.kind === 'opportunity' || item.kind === 'jhadina';
}

export function createPreparedPost(item: FeedItem, platforms: PreparedPostPlatform[]): PreparedPostDraft {
  if (!canPreparePost(item)) throw new Error('This feed item cannot be prepared as a post');
  const caption = item.body.trim();
  return {
    actionId: `prepare_post_${item.id}`,
    sourceItemId: item.id,
    action: 'prepare_post',
    title: 'Prepare this post',
    why: `Jhadina surfaced this item as relevant: ${item.title}`,
    platforms,
    caption,
    media: [],
    hashtags: [],
    requiresApproval: true,
    status: 'pending',
  };
}
