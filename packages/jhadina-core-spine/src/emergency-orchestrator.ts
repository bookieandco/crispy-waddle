import type { EmergencyIncident, EmergencyProtocol } from './emergency-domain.js';
import type { EvidenceSession } from './emergency-evidence.js';
import type { BlackBoxCaptureAdapter } from './emergency-capture.js';
import type { BlackBoxPersistence } from './emergency-persistence.js';
import type { AuthorizedEvidenceRelease } from './emergency-release.js';

export interface EmergencyExecutionContext {
  readonly incident: EmergencyIncident;
  readonly protocol: EmergencyProtocol;
}

export interface EmergencyActionExecutor {
  startEvidenceCapture(context: EmergencyExecutionContext, adapter: BlackBoxCaptureAdapter): Promise<EvidenceSession>;
  persistEvidence(context: EmergencyExecutionContext, persistence: BlackBoxPersistence): Promise<void>;
  authorizeEvidenceRelease(context: EmergencyExecutionContext): Promise<AuthorizedEvidenceRelease | null>;
}

/**
 * Side-effect orchestration boundary. The executor may coordinate adapters,
 * but authorization remains deterministic and must already be granted by the
 * emergency policy before evidence release is executed.
 */
export interface EmergencyOrchestrator {
  execute(context: EmergencyExecutionContext): Promise<void>;
}
