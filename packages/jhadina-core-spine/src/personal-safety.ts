export type SafetyThreat =
  | 'personal-danger'
  | 'medical'
  | 'accident'
  | 'security'
  | 'missing'
  | 'environmental'
  | 'custom';

export type SafetyContactRole =
  | 'primary-safety'
  | 'secondary-safety'
  | 'family'
  | 'medical'
  | 'legal'
  | 'security'
  | 'business';

export interface PersonalSafetyContact {
  readonly id: string;
  readonly role: SafetyContactRole;
  readonly displayName: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly channels: readonly ('push' | 'sms' | 'email' | 'call')[];
}

export interface SafetyCodeWordBinding {
  readonly id: string;
  readonly protocolId: string;
  /** Store only a verifier/reference; never persist plaintext code words here. */
  readonly verifierRef: string;
  readonly enabled: boolean;
  readonly triggerMode: 'explicit' | 'silent';
}

export interface SafetyInformationPolicy {
  readonly shareLocation: boolean;
  readonly shareIncidentSummary: boolean;
  readonly shareAudio: boolean;
  readonly shareVideo: boolean;
  readonly shareMedicalProfile: boolean;
}

export interface PersonalSafetyProfile {
  readonly id: string;
  readonly ownerId: string;
  readonly contacts: readonly PersonalSafetyContact[];
  readonly codeWords: readonly SafetyCodeWordBinding[];
  readonly informationPolicyByContact: Readonly<Record<string, SafetyInformationPolicy>>;
  readonly defaultCheckInSeconds?: number;
}

export interface SafetyProtocolSelection {
  readonly profileId: string;
  readonly threat: SafetyThreat;
  readonly protocolId: string;
  readonly selectedAt: string;
}
