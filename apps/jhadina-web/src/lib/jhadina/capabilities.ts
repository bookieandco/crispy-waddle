export const JHADINA_CAPABILITIES = [
  { name: 'director', actions: ['create_video', 'finish_scene', 'extend_video', 'find_hooks', 'make_short'], requiresApprovalByDefault: false },
  { name: 'growth', actions: ['create_campaign', 'prepare_post', 'schedule_post'], requiresApprovalByDefault: true },
  { name: 'knowledge', actions: ['save_source', 'digest', 'search', 'extract'], requiresApprovalByDefault: false },
  { name: 'shopping', actions: ['find_item', 'prepare_purchase', 'purchase'], requiresApprovalByDefault: true },
  { name: 'cooking', actions: ['answer_recipe', 'start_timer', 'cancel_timer'], requiresApprovalByDefault: false },
  { name: 'music', actions: ['play', 'queue', 'restore'], requiresApprovalByDefault: false },
  { name: 'opportunities', actions: ['review', 'qualify', 'open_case'], requiresApprovalByDefault: true },
  { name: 'memory', actions: ['propose', 'approve', 'reject', 'archive'], requiresApprovalByDefault: true },
] as const;
