import { InMemoryActionLedger, type ActionHandler, type ActionPolicy, type ActionRequest, AllowAllActionPolicy } from './action-executor.js';
import { InMemoryApprovalReceiptStore, createApprovalReceiptVerifier, createApprovalRequestService } from './approval-receipt.js';
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


const approvalStore = new InMemoryApprovalReceiptStore();
const approvalPolicy: ActionPolicy<{ value: string }> = {
  evaluate: async () => 'approval_required',
};
const fingerprint = (candidate: { id: string; userId: string; type: string; action: { value: string } }) =>
  `${candidate.id}:${candidate.userId}:${candidate.type}:${candidate.action.value}`;
const approvalService = createApprovalRequestService(approvalStore, fingerprint);
const receipt = await approvalService.requestApproval(request);
const approved = await approvalService.approve(receipt.id, request.userId);
const approvalExecutor = new VerifiedActionExecutor(
  new StaticIdentityVerifier({ userId: 'user-a', sessionId: 'session-a' }),
  approvalPolicy,
  new InMemoryActionLedger(),
  [handler],
  createApprovalReceiptVerifier(approvalStore, fingerprint),
);
const approvedResult = await approvalExecutor.execute({ ...request, approvalReceiptId: approved.id });
if (approvedResult !== 'ok') throw new Error('VERIFIED_APPROVAL_EXECUTOR_FAILED');

try {
  await approvalExecutor.execute({ ...request, approvalReceiptId: approved.id });
  throw new Error('APPROVAL_REPLAY_NOT_BLOCKED');
} catch (error) {
  if (!(error instanceof Error) || error.message !== 'Invalid approval receipt: test.action') throw error;
}
