import { InMemoryActionLedger, type ActionHandler, type ActionRequest, AllowAllActionPolicy } from './action-executor.js';
import { StaticIdentityVerifier, VerifiedActionExecutor } from './verified-action-executor.js';

const handler: ActionHandler<{ value: string }, string> = {
  supports: (type) => type === 'test.action',
  execute: async (action) => action.value,
};

const request: ActionRequest<{ value: string }> = {
  id: 'verified-action-test',
  userId: 'user-a',
  type: 'test.action',
  action: { value: 'ok' },
  requestedAt: new Date().toISOString(),
};

const ledger = new InMemoryActionLedger();
const executor = new VerifiedActionExecutor(
  new StaticIdentityVerifier({ userId: 'user-a', sessionId: 'session-a' }),
  new AllowAllActionPolicy(),
  ledger,
  [handler],
);

const result = await executor.execute(request);
if (result !== 'ok') throw new Error('VERIFIED_EXECUTOR_FAILED');

const mismatch = new VerifiedActionExecutor(
  new StaticIdentityVerifier({ userId: 'user-b', sessionId: 'session-b' }),
  new AllowAllActionPolicy(),
  ledger,
  [handler],
);

try {
  await mismatch.execute(request);
  throw new Error('IDENTITY_MISMATCH_NOT_BLOCKED');
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'Action identity mismatch') throw error;
}
