export type FeedSource = 'All' | 'TikTok' | 'Facebook' | 'Snapchat' | 'Instagram' | 'YouTube' | 'Reddit' | 'Director';

export type StoryKind = 'social' | 'youtube' | 'director' | 'jhadina';

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
