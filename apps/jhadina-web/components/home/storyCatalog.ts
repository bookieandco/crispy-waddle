import type { Story } from './storyTypes';

export const baseStories: Story[] = [
  {
    id: 'jhadina-day-at-a-glance', kind: 'jhadina', source: 'Jhadina',
    title: 'Your day, at a glance.',
    body: 'A mixed stream for music, opportunities, media, social, and Jhadina activity.',
    age: 'Now',
    details: [{ label: 'Stream', value: 'Unified' }, { label: 'Sources', value: 'Connected' }, { label: 'Posting', value: 'Paused' }],
    filters: ['All', 'Today'],
  },
  { id: 'music-ready', kind: 'music', source: 'Music', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', age: 'Recent', action: { label: 'Open Music', href: '/music' }, filters: ['All', 'Today', 'Saved'] },
  { id: 'opportunity-attention', kind: 'opportunity', source: 'Opportunity', title: 'A business opportunity needs your attention.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', age: 'Recent', action: { label: 'Review', href: '/opportunity' }, filters: ['All', 'Today', 'Focus'] },
  { id: 'director-review', kind: 'director', source: 'Director', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', age: 'Recent', action: { label: 'Watch' }, filters: ['All', 'Today', 'Focus'] },
  { id: 'youtube-space', kind: 'youtube', source: 'YouTube', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', age: 'Not connected', action: { label: 'Connect' }, filters: ['All'] },
  { id: 'social-world', kind: 'social', source: 'Social', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', age: 'Connections', action: { label: 'Connect' }, filters: ['All', 'Today', 'Saved'] },
];
