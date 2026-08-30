import type { SshCredentialRef } from './credentials.js';

export type SshSecurityPolicy = Readonly<{
  allowedHosts: readonly string[];
  allowedPorts: readonly number[];
  requireHostKeyVerification: boolean;
  credentialRef: SshCredentialRef;
  allowedCommands: readonly string[];
}>;

export type SshPolicyRequest = Readonly<{
  host: string;
  port: number;
  command?: string;
  credentialRef?: SshCredentialRef;
  hostKeyVerified?: boolean;
}>;

export type SshPolicyDecision = Readonly<{
  allowed: boolean;
  reason?: 'host-not-allowed' | 'port-not-allowed' | 'credential-required' | 'host-key-unverified' | 'command-not-allowed';
}>;

export function evaluateSshPolicy(policy: SshSecurityPolicy, request: SshPolicyRequest): SshPolicyDecision {
  if (!policy.allowedHosts.includes(request.host)) return { allowed: false, reason: 'host-not-allowed' };
  if (!policy.allowedPorts.includes(request.port)) return { allowed: false, reason: 'port-not-allowed' };
  if (!request.credentialRef || request.credentialRef.id !== policy.credentialRef.id) {
    return { allowed: false, reason: 'credential-required' };
  }
  if (policy.requireHostKeyVerification && request.hostKeyVerified !== true) {
    return { allowed: false, reason: 'host-key-unverified' };
  }
  if (request.command !== undefined && !policy.allowedCommands.includes(request.command)) {
    return { allowed: false, reason: 'command-not-allowed' };
  }
  return { allowed: true };
}
