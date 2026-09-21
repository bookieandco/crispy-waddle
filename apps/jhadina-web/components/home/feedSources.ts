export const feedSources = [
  'All',
  'Social',
  'TikTok',
  'Facebook',
  'Instagram',
  'YouTube',
  'Reddit',
  'Snapchat',
  'X',
  'LinkedIn',
  'Threads',
  'Bluesky',
  'Tumblr',
  'VK',
  'Director',
] as const;

export type FeedSource = (typeof feedSources)[number];
