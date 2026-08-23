export type EmergencyMessageChannel = 'push' | 'sms' | 'email' | 'call';

export interface EmergencyMessageTemplate {
  readonly id: string;
  readonly threat: string;
  readonly severity: string;
  readonly body: string;
  readonly channels: readonly EmergencyMessageChannel[];
}

export interface EmergencyNotificationRecipient {
  readonly id: string;
  readonly priority: number;
  readonly channels: readonly EmergencyMessageChannel[];
  readonly messageTemplateId: string;
}

export interface EmergencyEscalationStep {
  readonly afterSeconds: number;
  readonly recipients: readonly EmergencyNotificationRecipient[];
  readonly requireAcknowledgment: boolean;
}

export interface EmergencyNotificationPlan {
  readonly protocolId: string;
  readonly steps: readonly EmergencyEscalationStep[];
}

export interface EmergencyNotificationDelivery {
  readonly recipientId: string;
  readonly channel: EmergencyMessageChannel;
  readonly accepted: boolean;
  readonly deliveredAt?: string;
  readonly acknowledgedAt?: string;
  readonly providerReference?: string;
}

export interface EmergencyNotificationExecutor {
  send(
    plan: EmergencyNotificationPlan,
    incidentId: string,
    stepIndex: number,
  ): Promise<readonly EmergencyNotificationDelivery[]>;
}

/**
 * Notification execution is downstream of deterministic protocol selection.
 * The executor delivers an already-authorized plan; it does not classify the
 * threat or invent recipients/messages at runtime.
 */
export interface EmergencyNotificationRuntime {
  execute(plan: EmergencyNotificationPlan, incidentId: string): Promise<readonly EmergencyNotificationDelivery[]>;
}
