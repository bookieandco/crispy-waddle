import type { Story } from './storyTypes';

export const baseStories: Story[] = [
  {
    id: 'jhadina-day-at-a-glance',
    kind: 'jhadina',
    source: 'Social',
    title: 'Your day, at a glance.',
    body: 'Authorized social activity and Jhadina proposals appear here with their real source and status.',
    age: 'Now',
    details: [
      { label: 'Stream', value: 'Social + Media' },
      { label: 'Authority', value: 'Human gated' },
      { label: 'Publishing', value: 'Approval required' },
    ],
  },
  {
    id: 'director-review',
    kind: 'director',
    source: 'Director',
    title: 'Director work appears here before publishing.',
    body: 'Creative output can move from Director to Growth planning and then into the governed Social publication queue.',
    age: 'Workspace',
    action: { label: 'Open Workstation', href: '/workstation' },
  },
];
