import type { DomainOperatingContext } from './operating-model.js';

export interface DomainCapability {
  id: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface JhadinaDomain {
  context: DomainOperatingContext;
  capabilities: readonly DomainCapability[];
}

export class DomainRegistry {
  private readonly domains = new Map<string, JhadinaDomain>();

  register(domain: JhadinaDomain): void {
    if (!domain.context.domain.trim()) throw new Error('Domain name is required');
    if (this.domains.has(domain.context.domain)) throw new Error(`Domain already registered: ${domain.context.domain}`);
    this.domains.set(domain.context.domain, domain);
  }

  get(domain: string): JhadinaDomain | undefined {
    return this.domains.get(domain);
  }

  list(): readonly JhadinaDomain[] {
    return [...this.domains.values()];
  }
}
