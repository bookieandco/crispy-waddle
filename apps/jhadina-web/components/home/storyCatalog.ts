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
  {
    id: 'money-command-center',
    kind: 'money',
    source: 'Money',
    title: 'Money is one tap away.',
    body: 'Open the governed Financial Command Center for connected accounts, transaction intelligence, and decisions that need attention.',
    age: 'Live surface',
    action: { label: 'Open Money', href: '/money/command-center' },
  },
  {
    id: 'sports-intelligence',
    kind: 'sports',
    source: 'Sports',
    title: 'Sports Intelligence',
    body: 'Game perception, simulations, model disagreement, clips, and evidence-backed win paths live in this world.',
    age: 'World',
    action: { label: 'Open Sports', href: '/worlds/sports' },
  },
  {
    id: 'pupsonstuff-commerce',
    kind: 'commerce',
    source: 'PupsonStuff',
    title: 'PupsonStuff creative & commerce',
    body: 'Product creation, mockups, ads, and commerce work stay connected to Jhadina through this world.',
    age: 'World',
    action: { label: 'Open PupsonStuff', href: '/worlds/pupsonstuff' },
  },
];
