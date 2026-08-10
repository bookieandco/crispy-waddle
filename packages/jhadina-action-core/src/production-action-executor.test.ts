import { createProductionActionExecutor } from './production-action-executor.js';
import type { ActionHandler, ActionPolicy } from './action-executor.js';
import type { ActionIdentityVerifier } from './verified-action-executor.js';

type Action = { value: string };

const identityVerifier: ActionIdentityVerifier = {
  async verify() {
    return { userId: 'user-1', sessionId: 'session-1' };
  },
};

const policy: ActionPolicy<Action> = {
  async evaluate() {
    return 'allow';
  },
};

const handler: ActionHandler<Action, string> = {
  supports(type) {
    return type === 'test.action';
  },
  async execute(action) {
    return action.value;
  },
};

let rpcCalls = 0;
const supabase = {
  async rpc() {
    rpcCalls += 1;
    return { data: { event_id: `event-${rpcCalls}` }, error: null };
  },
};

const executor = createProductionActionExecutor({
  identityVerifier,
  policy,
  handlers: [handler],
  supabase,
});

const result = await executor.execute({
  id: 'request-1',
  userId: 'user-1',
  type: 'test.action',
  action: { value: 'ok' },
  requestedAt: new Date().toISOString(),
});

if (result !== 'ok') throw new Error('PRODUCTION_EXECUTOR_RESULT_FAILED');
if (rpcCalls !== 2) throw new Error(`PRODUCTION_AUDIT_CALL_COUNT_FAILED:${rpcCalls}`);

console.log('Production Action Executor passed');
