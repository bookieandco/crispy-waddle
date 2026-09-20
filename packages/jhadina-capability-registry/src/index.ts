export type CapabilityRisk = 'read' | 'write' | 'external' | 'financial' | 'destructive';

/**
 * Canonical capability definition.
 *
 * Registration metadata captured here drives Policy evaluation — Policy
 * reads risk, approvalRequired, and auditRequired from the registered
 * definition rather than inspecting arbitrary functions or routes.
 *
 * IMPORTANT: Registration ≠ Authorization.
 * Registering a capability makes it known to the system; it does not
 * grant any actor permission to invoke it.  Authorization is always
 * evaluated separately by the Policy boundary using this metadata.
 */
export interface CapabilityDefinition {
  readonly name: string;
  readonly description: string;
  readonly risk: CapabilityRisk;
  readonly version: number;
  /**
   * When true, Policy must require an ApprovalReceipt before the capability
   * can be executed.  The registry sets the *default* expectation; Policy
   * may require approval for additional capabilities at evaluation time.
   */
  readonly approvalRequired?: boolean;
  /**
   * When true, every execution of this capability must be written to the
   * durable ActionAuditLedger.  High-risk capabilities should set this
   * explicitly to true.  'destructive' and 'financial' capabilities default
   * to requiring audit even if this field is absent.
   */
  readonly auditRequired?: boolean;
  /**
   * Executor identifier — the capability handler key or route that should
   * be dispatched to when this capability is authorized.  Used by the
   * composition root to wire a registered capability to its implementation
   * without hard-coding strings at call sites.
   */
  readonly executor?: string;
  /**
   * Human-readable description of the idempotency semantics.
   * e.g. "safe to retry — create-or-update on unique key",
   *      "not idempotent — creates a new record on each call".
   */
  readonly idempotency?: string;
}

export class CapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition): void {
    if (!definition.name.trim()) throw new Error('Capability name is required');
    if (!Number.isInteger(definition.version) || definition.version < 1) {
      throw new Error(`Invalid capability version: ${definition.name}`);
    }
    if (this.definitions.has(definition.name)) {
      throw new Error(`Capability already registered: ${definition.name}`);
    }
    this.definitions.set(definition.name, Object.freeze({ ...definition }));
  }

  get(name: string): CapabilityDefinition | undefined {
    return this.definitions.get(name);
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  list(): readonly CapabilityDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns true when the registered capability's risk level or
   * approvalRequired flag means Policy must demand approval before execution.
   *
   * This is a read-only advisory derived from registration metadata.  It does
   * NOT grant or deny authorization — that is Policy's job.
   */
  requiresApprovalByDefault(name: string): boolean {
    const def = this.definitions.get(name);
    if (!def) return false;
    return !!(def.approvalRequired || def.risk === 'destructive' || def.risk === 'financial');
  }

  /**
   * Returns true when the capability should always be written to the durable
   * audit ledger — either because auditRequired is explicitly set, or because
   * the risk level implies it.
   */
  requiresAudit(name: string): boolean {
    const def = this.definitions.get(name);
    if (!def) return false;
    return !!(def.auditRequired || def.risk === 'destructive' || def.risk === 'financial' || def.risk === 'external');
  }
}
