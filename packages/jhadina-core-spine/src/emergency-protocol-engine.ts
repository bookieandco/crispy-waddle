import type {
  EmergencyIncident,
  EmergencyProtocol,
  EmergencyThreatAssessment,
  EmergencyTrigger,
  IncidentEvent,
  IncidentStatus,
  ProtocolAction,
  Severity,
} from './emergency-domain.js';

const severityRank: Record<Severity, number> = {
  info: 0,
  warning: 1,
  serious: 2,
  critical: 3,
};

const transitionTable: Record<IncidentStatus, readonly IncidentStatus[]> = {
  detected: ['verifying', 'active', 'cancelled'],
  verifying: ['active', 'cancelled'],
  active: ['escalating', 'resolved', 'cancelled'],
  escalating: ['resolved', 'cancelled'],
  resolved: [],
  cancelled: [],
};

export interface ProtocolDispatch {
  readonly incidentId: string;
  readonly action: ProtocolAction;
}

export interface ProtocolTransition {
  readonly incident: EmergencyIncident;
  readonly event: IncidentEvent;
}

export interface EmergencyProtocolEngineOptions {
  readonly now?: () => string;
  readonly idFactory?: () => string;
}

/**
 * Pure, deterministic emergency policy execution.
 *
 * This engine never sends a message, records media, captures location, or
 * calls an external service. It only validates state, selects an authorized
 * protocol, and emits the actions that an external executor may perform.
 */
export class EmergencyProtocolEngine {
  private readonly now: () => string;
  private readonly idFactory: () => string;

  public constructor(options: EmergencyProtocolEngineOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory =
      options.idFactory ??
      (() => `incident-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  }

  public selectProtocol(
    assessment: EmergencyThreatAssessment,
    protocols: readonly EmergencyProtocol[],
  ): EmergencyProtocol | undefined {
    return protocols
      .filter(
        (protocol) =>
          protocol.threat === assessment.threat &&
          severityRank[assessment.severity] >= severityRank[protocol.minimumSeverity],
      )
      .sort(
        (left, right) =>
          severityRank[right.minimumSeverity] - severityRank[left.minimumSeverity],
      )[0];
  }

  public createIncident(
    trigger: EmergencyTrigger,
    assessment: EmergencyThreatAssessment,
    protocols: readonly EmergencyProtocol[],
  ): EmergencyIncident {
    const protocol = this.selectProtocol(assessment, protocols);
    if (!protocol) {
      throw new Error(
        `No emergency protocol is authorized for threat=${assessment.threat} severity=${assessment.severity}`,
      );
    }

    return {
      id: this.idFactory(),
      createdAt: this.now(),
      trigger,
      assessment,
      protocolId: protocol.id,
      status: 'detected',
    };
  }

  public transition(
    incident: EmergencyIncident,
    nextStatus: IncidentStatus,
  ): ProtocolTransition {
    if (!transitionTable[incident.status].includes(nextStatus)) {
      throw new Error(
        `Invalid emergency transition: ${incident.status} -> ${nextStatus}`,
      );
    }

    const eventType: IncidentEvent['type'] =
      nextStatus === 'active'
        ? 'protocol-started'
        : nextStatus === 'escalating'
          ? 'escalated'
          : nextStatus === 'cancelled'
            ? 'cancelled'
            : nextStatus === 'resolved'
              ? 'resolved'
              : nextStatus === 'verifying'
                ? 'verification-requested'
                : 'detected';

    return {
      incident: { ...incident, status: nextStatus },
      event: {
        incidentId: incident.id,
        occurredAt: this.now(),
        type: eventType,
      },
    };
  }

  public dispatchableActions(
    incident: EmergencyIncident,
    protocol: EmergencyProtocol,
  ): readonly ProtocolDispatch[] {
    if (incident.protocolId !== protocol.id) {
      throw new Error('Incident protocol does not match the supplied protocol.');
    }

    if (incident.status !== 'active' && incident.status !== 'escalating') {
      return [];
    }

    return protocol.actions.map((action) => ({
      incidentId: incident.id,
      action,
    }));
  }

  public actionsAfter(
    incident: EmergencyIncident,
    protocol: EmergencyProtocol,
    elapsedSeconds: number,
  ): readonly ProtocolDispatch[] {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error('elapsedSeconds must be a non-negative finite number.');
    }

    if (incident.protocolId !== protocol.id) {
      throw new Error('Incident protocol does not match the supplied protocol.');
    }

    if (incident.status !== 'active' && incident.status !== 'escalating') {
      return [];
    }

    return protocol.actions
      .filter((action) => action.escalation && elapsedSeconds >= action.escalation.afterSeconds)
      .map((action) => ({
        incidentId: incident.id,
        action,
      }));
  }
}
