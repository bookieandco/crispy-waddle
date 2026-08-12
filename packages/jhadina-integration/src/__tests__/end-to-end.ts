import { ActionExecutor } from '../action-executor';
import { createCreatorWorkstationAdapters, InMemoryCreatorProjectStore } from '../creator-workstation';
import { DeterministicPolicySecurityCore, CREATOR_WORKSTATION_POLICY } from '../policy-security';

export async function creatorWorkstationEndToEndSmokeTest() {
  const store = new InMemoryCreatorProjectStore();
  const executor = new ActionExecutor(createCreatorWorkstationAdapters(store));
  const policy = new DeterministicPolicySecurityCore(CREATOR_WORKSTATION_POLICY);

  const createRequest = {
    id: crypto.randomUUID(), domain: 'creator-workstation' as const, capability: 'project.create',
    input: { name: 'Jhadina E2E Test' }, requestedAt: new Date().toISOString(), requiresApproval: false,
  };
  const decision = await policy.authorize(createRequest);
  if (!decision.allowed || decision.requiresApproval) throw new Error('Project creation should be directly allowed.');
  const created = await executor.execute(createRequest);
  if (!created.ok || !created.output) throw new Error('Project creation failed.');

  const projectId = (created.output as { id: string }).id;
  const exportRequest = {
    id: crypto.randomUUID(), domain: 'creator-workstation' as const, capability: 'project.export',
    projectId, input: { projectId }, requestedAt: new Date().toISOString(), requiresApproval: false,
  };
  const exportDecision = await policy.authorize(exportRequest);
  if (!exportDecision.allowed || exportDecision.requiresApproval) throw new Error('Private project export should be allowed.');
  const exported = await executor.execute(exportRequest);
  if (!exported.ok) throw new Error('Project export failed.');

  const publishRequest = {
    id: crypto.randomUUID(), domain: 'creator-workstation' as const, capability: 'public.publish',
    projectId, input: { projectId }, requestedAt: new Date().toISOString(), requiresApproval: false,
  };
  const publishDecision = await policy.authorize(publishRequest);
  if (!publishDecision.allowed || !publishDecision.requiresApproval) throw new Error('Public publish must require approval.');

  return { createdProjectId: projectId, exported: true, publishApprovalRequired: true };
}
