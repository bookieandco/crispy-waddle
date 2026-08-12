import type { JhadinaCommand, JhadinaResult } from './command-bus';

export type JhadinaCapability = {
  name: string;
  description: string;
  actions: string[];
  requiresApprovalByDefault: boolean;
  execute: (command: JhadinaCommand) => Promise<JhadinaResult>;
};

export const JHADINA_CAPABILITIES = [
  { name: 'director', description: 'Create, edit, extend, clip, and repurpose media.', actions: ['create_video', 'finish_scene', 'extend_video', 'find_hooks', 'make_short'], requiresApprovalByDefault: false },
  { name: 'growth', description: 'Prepare and distribute content across supported channels.', actions: ['create_campaign', 'prepare_post', 'schedule_post'], requiresApprovalByDefault: true },
  { name: 'knowledge', description: 'Ingest, digest, search, and cite source material.', actions: ['save_source', 'digest', 'search', 'extract'], requiresApprovalByDefault: false },
  { name: 'shopping', description: 'Prepare and execute authorized purchases.', actions: ['find_item', 'prepare_purchase', 'purchase'], requiresApprovalByDefault: true },
  { name: 'cooking', description: 'Assist with recipes, active cooking context, and timers.', actions: ['answer_recipe', 'start_timer', 'cancel_timer'], requiresApprovalByDefault: false },
  { name: 'music', description: 'Control music and restoration workflows.', actions: ['play', 'queue', 'restore'], requiresApprovalByDefault: false },
  { name: 'opportunities', description: 'Surface and manage opportunity workflows.', actions: ['review', 'qualify', 'open_case'], requiresApprovalByDefault: true },
  { name: 'memory', description: 'Propose and manage durable memory.', actions: ['propose', 'approve', 'reject', 'archive'], requiresApprovalByDefault: true },
] as const satisfies readonly Omit<JhadinaCapability, 'execute'>[];

export type JhadinaCapabilityName = (typeof JHADINA_CAPABILITIES)[number]['name'];
