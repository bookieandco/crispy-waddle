import type { JhadinaFeedItem } from './types';

export const mockFeed: JhadinaFeedItem[] = [
  {
    id: 'opp-atlanta-01', type: 'opportunity', source: 'Opportunity Intelligence', timestamp: '18m ago', score: 96, state: 'unread',
    title: 'Community event opportunity in Atlanta',
    summary: 'A local organization is looking for a community partner this Friday. It aligns with your current campaign work.',
    reason: 'Surfaced because it matches your current campaign focus and has a near-term deadline.',
    impact: { label: 'Potential reach', value: '1,200+', severity: 'high' },
    tags: ['Campaign', 'Community'],
    actions: [{ id: 'review', label: 'Review', kind: 'primary' }, { id: 'save', label: 'Save', kind: 'secondary' }, { id: 'dismiss', label: 'Dismiss', kind: 'neutral' }],
  },
  {
    id: 'video-strategy-01', type: 'video', source: 'YouTube', timestamp: '42m ago', score: 88, state: 'unread',
    title: 'How modern campaigns are changing',
    summary: 'A video Jhadina found while researching campaign strategy.',
    reason: 'You recently asked Jhadina to research campaign media and voter engagement.',
    media: { provider: 'youtube', videoId: 'ScMzIvxBSi4', duration: '12:43' },
    actions: [{ id: 'watch', label: 'Watch', kind: 'primary' }, { id: 'save', label: 'Save', kind: 'secondary' }],
  },
  {
    id: 'approval-video-01', type: 'approval', source: 'Content Studio', timestamp: '1h ago', score: 84, state: 'unread',
    title: 'Campaign video is ready to publish',
    summary: 'The draft has finished processing and is waiting for your approval.',
    reason: 'This item is surfaced because a publishable asset is waiting for a decision.',
    media: { provider: 'jhadina_tv', videoId: 'ScMzIvxBSi4', duration: '0:31' },
    actions: [{ id: 'approve', label: 'Approve', kind: 'primary' }, { id: 'edit', label: 'Edit', kind: 'secondary' }, { id: 'reject', label: 'Reject', kind: 'danger' }],
  },
  {
    id: 'tv-live-01', type: 'tv', source: 'Jhadina TV', timestamp: 'Live now', score: 72, state: 'unread',
    title: 'Now Playing',
    summary: 'Preview what is currently playing on your connected TV channel.',
    reason: 'You have Jhadina TV connected and this channel is currently live.',
    media: { provider: 'jhadina_tv', videoId: 'ScMzIvxBSi4', live: true },
    actions: [{ id: 'expand', label: 'Expand', kind: 'primary' }, { id: 'save', label: 'Save', kind: 'secondary' }],
  },
  {
    id: 'research-01', type: 'research', source: 'Jhadina Research', timestamp: '2h ago', score: 64, state: 'unread',
    title: 'Five things worth knowing this morning',
    summary: 'Jhadina found several developments that may affect your current priorities.',
    reason: 'Surfaced from your active research topics and recent saved items.',
    tags: ['Research', 'For you'],
    actions: [{ id: 'read', label: 'Read', kind: 'primary' }, { id: 'save', label: 'Save', kind: 'secondary' }, { id: 'dismiss', label: 'Dismiss', kind: 'neutral' }],
  },
  {
    id: 'social-01', type: 'social_post', source: 'Facebook', timestamp: '3h ago', score: 57, state: 'unread',
    title: 'Community page posted an event update',
    summary: 'The event time changed and the organizer is asking partners to reshare the announcement.',
    reason: 'This source is connected and the post matches a current opportunity.',
    actions: [{ id: 'open', label: 'Open', kind: 'primary' }, { id: 'save', label: 'Save', kind: 'secondary' }, { id: 'dismiss', label: 'Dismiss', kind: 'neutral' }],
  },
];
