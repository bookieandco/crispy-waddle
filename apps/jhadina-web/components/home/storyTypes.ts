export type FeedFilter = 'All' | 'Today' | 'Focus' | 'Saved';

export type StoryKind = 'music' | 'opportunity' | 'director' | 'social' | 'youtube' | 'jhadina' | 'growth';

export type StoryDetail = {
  label: string;
  value: string;
};

export type Story = {
  id: string;
  kind: StoryKind;
  source: string;
  title: string;
  body: string;
  age?: string;
  action?: { label: string; href?: string };
  details?: StoryDetail[];
  filters: FeedFilter[];
};

export function storyMatchesFilter(story: Story, filter: FeedFilter): boolean {
  return filter === 'All' || story.filters.includes(filter);
}
