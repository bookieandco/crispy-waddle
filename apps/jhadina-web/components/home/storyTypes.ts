export type FeedSource =
  | 'All'
  | 'Social'
  | 'TikTok'
  | 'Facebook'
  | 'Snapchat'
  | 'Instagram'
  | 'YouTube'
  | 'Reddit'
  | 'X'
  | 'LinkedIn'
  | 'Threads'
  | 'Bluesky'
  | 'Tumblr'
  | 'VK'
  | 'Director'
  | 'JhadinaTV'
  | 'Opportunities'
  | 'Money'
  | 'Sports'
  | 'PupsonStuff';

export const HOME_FEED_SOURCES: FeedSource[] = [
  'All','Social','TikTok','Facebook','Snapchat','Instagram','YouTube','Reddit','X','LinkedIn','Threads','Bluesky','Tumblr','VK','Director','JhadinaTV','Opportunities','Money','Sports','PupsonStuff',
];

export type StoryKind = 'social' | 'youtube' | 'director' | 'jhadina' | 'tv' | 'opportunity' | 'money' | 'sports' | 'commerce';

export type StoryDetail = { label: string; value: string };

export type Story = {
  id: string;
  kind: StoryKind;
  source: Exclude<FeedSource, 'All'>;
  title: string;
  body: string;
  age?: string;
  action?: { label: string; href?: string };
  details?: StoryDetail[];
  media?: { type: 'image' | 'video'; src?: string; alt?: string };
};

export function storyMatchesSource(story: Story, source: FeedSource): boolean {
  return source === 'All' || story.source === source;
}
