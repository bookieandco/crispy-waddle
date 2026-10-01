import type { CommerceCapabilityBinding } from "@jhadina/opportunity-contracts";

export interface CommerceExecutionReceipt {
  receiptId: string;
  capabilityName: string;
  capabilityVersion: number;
  connectionId: string;
  bindingFingerprint: string;
  issuedAt: string;
  expiresAt: string;
}

export interface CommerceExecutionAuthorizer {
  issue(binding: CommerceCapabilityBinding, ttlMs?: number): CommerceExecutionReceipt;
  verify(receipt: CommerceExecutionReceipt, binding: CommerceCapabilityBinding): boolean;
}

export class DeterministicCommerceExecutionAuthorizer implements CommerceExecutionAuthorizer {
  issue(binding: CommerceCapabilityBinding, ttlMs = 60_000): CommerceExecutionReceipt {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    return {
      receiptId: `receipt:${binding.connectionId}:${binding.capabilityName}:${issuedAt.getTime()}`,
      capabilityName: binding.capabilityName,
      capabilityVersion: binding.capabilityVersion,
      connectionId: binding.connectionId,
      bindingFingerprint: this.fingerprint(binding),
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  verify(receipt: CommerceExecutionReceipt, binding: CommerceCapabilityBinding): boolean {
    const now = Date.now();
    const expiry = Date.parse(receipt.expiresAt);
    return (
      expiry > now &&
      receipt.capabilityName === binding.capabilityName &&
      receipt.capabilityVersion === binding.capabilityVersion &&
      receipt.connectionId === binding.connectionId &&
      receipt.bindingFingerprint === this.fingerprint(binding)
    );
  }

  private fingerprint(binding: CommerceCapabilityBinding): string {
    return [
      binding.capabilityName,
      binding.capabilityVersion,
      binding.provider,
      binding.connectionId,
      binding.adapterName,
      binding.adapterStatus,
      binding.declaredRisk,
    ].join("|");
  }
}
