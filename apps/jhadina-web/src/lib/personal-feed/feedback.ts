import type { FeedItem } from './core';

export type FeedFeedbackAction = 'more_like_this' | 'less_like_this' | 'not_relevant' | 'watch_topic';

export interface FeedFeedbackEvent {
  id: string;
  userId: string;
  itemId: string;
  action: FeedFeedbackAction;
  kind: FeedItem['kind'];
  platform?: FeedItem['platform'];
  topic?: string;
  createdAt: string;
}

export function createFeedFeedbackEvent(input: Omit<FeedFeedbackEvent, 'id' | 'createdAt'>): FeedFeedbackEvent {
  return { ...input, id: `feed_feedback_${input.userId}_${input.itemId}_${input.action}_${Date.now()}`, createdAt: new Date().toISOString() };
}

export function feedbackRelevanceDelta(action: FeedFeedbackAction): number {
  switch (action) {
    case 'more_like_this': return 12;
    case 'less_like_this': return -12;
    case 'not_relevant': return -30;
    case 'watch_topic': return 18;
  }
}

export function feedbackLabel(action: FeedFeedbackAction): string {
  switch (action) {
    case 'more_like_this': return 'More like this';
    case 'less_like_this': return 'Less like this';
    case 'not_relevant': return 'Not relevant';
    case 'watch_topic': return 'Watch this topic';
  }
}
