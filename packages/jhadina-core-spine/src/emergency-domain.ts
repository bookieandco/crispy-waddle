export type ThreatKind =
  | 'personal-danger'
  | 'medical'
  | 'accident'
  | 'security'
  | 'missing-or-unresponsive'
  | 'environmental'
  | 'custom';

export type Severity = 'info' | 'warning' | 'serious' | 'critical';

export type TriggerKind =
  | 'manual'
  | 'code-word'
  | 'voice'
  | 'shake'
  | 'check-in-timeout'
  | 'sensor'
  | 'system';

export type IncidentStatus =
  | 'detected'
  | 'verifying'
  | 'active'
  | 'escalating'
  | 'resolved'
  | 'cancelled';

export type ProtocolActionKind =
  | 'start-evidence-session'
  | 'capture-location'
  | 'notify-contact-group'
  | 'request-acknowledgement'
  | 'start-escalation-timer'
  | 'enter-protective-mode'
  | 'record-ledger-event';

export type ContactRole =
  | 'primary-safety'
  | 'secondary-safety'
  | 'family'
  | 'medical'
  | 'legal'
  | 'security'
  | 'technical'
  | 'custom';

export type InformationScope =
  | 'emergency-status'
  | 'location'
  | 'medical-summary'
  | 'incident-summary'
  | 'evidence-reference';

export interface EmergencyTrigger {
  readonly kind: TriggerKind;
  readonly occurredAt: string;
  readonly codeWordId?: string;
  readonly sourceId?: string;
}

export interface EmergencyThreatAssessment {
  readonly threat: ThreatKind;
  readonly severity: Severity;
  readonly confidence: number;
  readonly reasonCode: string;
}

export interface EmergencyContact {
  readonly id: string;
  readonly role: ContactRole;
  readonly priority: number;
  readonly displayName: string;
  readonly channels: readonly ('push' | 'sms' | 'email' | 'call')[];
}

export interface NotificationPolicy {
  readonly contactGroupId: string;
  readonly allowedInformation: readonly InformationScope[];
  readonly requireAcknowledgement: boolean;
}

export interface EscalationRule {
  readonly afterSeconds: number;
  readonly action: ProtocolActionKind;
  readonly contactGroupId?: string;
}

export interface EvidencePolicy {
  readonly audio: boolean;
  readonly video: boolean;
  readonly location: boolean;
  readonly retentionSeconds: number;
}

export interface ProtocolAction {
  readonly kind: ProtocolActionKind;
  readonly notification?: NotificationPolicy;
  readonly escalation?: EscalationRule;
}

export interface EmergencyProtocol {
  readonly id: string;
  readonly name: string;
  readonly threat: ThreatKind;
  readonly minimumSeverity: Severity;
  readonly actions: readonly ProtocolAction[];
  readonly evidencePolicy: EvidencePolicy;
}

export interface EmergencyIncident {
  readonly id: string;
  readonly createdAt: string;
  readonly trigger: EmergencyTrigger;
  readonly assessment: EmergencyThreatAssessment;
  readonly protocolId: string;
  readonly status: IncidentStatus;
}

export interface CodeWordBinding {
  readonly id: string;
  readonly protocolId: string;
  readonly enabled: boolean;
  /** Store a verifier/reference, never the plaintext code word. */
  readonly verifier: string;
}

export interface IncidentEvent {
  readonly incidentId: string;
  readonly occurredAt: string;
  readonly type:
    | 'detected'
    | 'verification-requested'
    | 'protocol-started'
    | 'action-dispatched'
    | 'contact-acknowledged'
    | 'escalated'
    | 'evidence-started'
    | 'resolved'
    | 'cancelled';
  readonly action?: ProtocolActionKind;
  readonly contactId?: string;
}
