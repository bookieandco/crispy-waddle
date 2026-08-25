export const feedSources = ['All', 'TikTok', 'Facebook', 'Snapchat', 'Instagram', 'YouTube', 'Reddit', 'Director'] as const;

export type FeedSource = (typeof feedSources)[number];
