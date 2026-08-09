import {
  ActionExecutor,
  CoreAuditEventAdapter,
  CoreAuditSink,
  CoreApprovalSink,
  DeterministicPolicySecurityCore,
  InMemoryCreatorProjectStore,
  InMemoryEventBus,
  MemoryCoreEventAdapter,
  createCoreOrchestrator,
  createCreatorWorkstationAdapters,
  CREATOR_WORKSTATION_POLICY,
  type ActionAdapter,
  type CorePolicy,
  type ActionHandler,
} from '@jhadina/integration';
import { MemoryRepository } from '../repositories/MemoryRepository';
import { ReasoningEventRepository } from '../repositories/ReasoningEventRepository';
import { TimelineRepository } from '../repositories/TimelineRepository';
import { storage } from '../storage/InMemoryStorage';

export function createJhadinaIntegration(params?: {
  policy?: CorePolicy;
  approvalRepository?: { create(request: Parameters<CoreApprovalSink['create']>[0]): Promise<void> };
  audit?: (entry: Parameters<CoreAuditSink['record']>[0]) => Promise<void>;
  actionHandlers?: readonly ActionHandler[];
  actionAdapters?: readonly ActionAdapter[];
}) {
  const events = new InMemoryEventBus();
  const memoryRepository = new MemoryRepository(storage);
  const reasoningRepository = new ReasoningEventRepository(storage);
  const timelineRepository = new TimelineRepository(storage);
  const creatorProjects = new InMemoryCreatorProjectStore();

  const memoryAdapter = new MemoryCoreEventAdapter(
    { memory: memoryRepository, reasoning: reasoningRepository, timeline: timelineRepository },
    events,
  );
  const auditAdapter = new CoreAuditEventAdapter(timelineRepository, events);
  const unsubscribeMemory = memoryAdapter.register();
  const unsubscribeAudit = auditAdapter.register();

  const adapters = params?.actionAdapters ?? createCreatorWorkstationAdapters(creatorProjects);
  const executor = new ActionExecutor(adapters);
  const policy = params?.policy ?? new DeterministicPolicySecurityCore(CREATOR_WORKSTATION_POLICY);

  const approvalRepository = params?.approvalRepository ?? {
    async create(request: Parameters<CoreApprovalSink['create']>[0]) {
      await events.publish({
        id: crypto.randomUUID(),
        type: 'APPROVAL_REQUESTED',
        source: 'core',
        occurredAt: new Date().toISOString(),
        projectId: request.projectId,
        payload: request,
      });
    },
  };

  const audit = params?.audit ?? (async (entry: Parameters<CoreAuditSink['record']>[0]) => {
    await timelineRepository.record({
      id: entry.id,
      userId: 'jhadina',
      eventType: `audit.${entry.outcome}`,
      payload: entry,
      timestamp: entry.occurredAt,
    });
  });

  const orchestrator = createCoreOrchestrator({
    policy,
    executor,
    audit: new CoreAuditSink(audit),
    approvals: new CoreApprovalSink(approvalRepository),
    events,
  });

  return {
    orchestrator,
    executor,
    events,
    creatorProjects,
    memoryRepository,
    reasoningRepository,
    timelineRepository,
    dispose() {
      unsubscribeMemory();
      unsubscribeAudit();
    },
  };
}
