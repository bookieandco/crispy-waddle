export const feedSources = ['All', 'TikTok', 'Facebook', 'Snapchat', 'Instagram', 'YouTube', 'Director'] as const;

export type FeedSource = (typeof feedSources)[number];
