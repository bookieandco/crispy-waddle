import {
  CoreCapabilityExecutor,
  CoreAuditEventAdapter,
  CoreAuditSink,
  CoreApprovalSink,
  InMemoryEventBus,
  MemoryCoreEventAdapter,
  createCoreOrchestrator,
  type ActionHandler,
  type CorePolicy,
} from '@jhadina/integration';
import { MemoryRepository } from '../repositories/MemoryRepository';
import { ReasoningEventRepository } from '../repositories/ReasoningEventRepository';
import { TimelineRepository } from '../repositories/TimelineRepository';
import { storage } from '../storage/InMemoryStorage';

export function createJhadinaIntegration(params: {
  policy: CorePolicy;
  approvalRepository: { create(request: Parameters<CoreApprovalSink['create']>[0]): Promise<void> };
  audit: (entry: Parameters<CoreAuditSink['record']>[0]) => Promise<void>;
  actionHandlers: readonly ActionHandler[];
}) {
  const events = new InMemoryEventBus();
  const memoryRepository = new MemoryRepository(storage);
  const reasoningRepository = new ReasoningEventRepository(storage);
  const timelineRepository = new TimelineRepository(storage);

  const memoryAdapter = new MemoryCoreEventAdapter(
    {
      memory: memoryRepository,
      reasoning: reasoningRepository,
      timeline: timelineRepository,
    },
    events,
  );

  const auditAdapter = new CoreAuditEventAdapter(
    timelineRepository,
    events,
  );

  const unsubscribeMemory = memoryAdapter.register();
  const unsubscribeAudit = auditAdapter.register();

  const orchestrator = createCoreOrchestrator({
    policy: params.policy,
    executor: new CoreCapabilityExecutor(params.actionHandlers),
    audit: new CoreAuditSink(params.audit),
    approvals: new CoreApprovalSink(params.approvalRepository),
    events,
  });

  return {
    orchestrator,
    events,
    memoryRepository,
    reasoningRepository,
    timelineRepository,
    dispose() {
      unsubscribeMemory();
      unsubscribeAudit();
    },
  };
}
