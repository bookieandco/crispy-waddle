export type DependencyTrust = 'approved' | 'review' | 'blocked';

export type DependencyArtifact = {
  name: string;
  version: string;
  integrity?: string;
  source: 'registry' | 'git' | 'local' | 'url';
  lifecycleScripts?: readonly string[];
  provenanceVerified: boolean;
};

export type SupplyChainPolicy = {
  allowSources: readonly DependencyArtifact['source'][];
  requireIntegrity: boolean;
  requireProvenance: boolean;
  allowLifecycleScripts: boolean;
};

export type DependencyDecision = {
  trust: DependencyTrust;
  reasons: readonly string[];
};

export function evaluateDependency(
  dependency: DependencyArtifact,
  policy: SupplyChainPolicy,
): DependencyDecision {
  const reasons: string[] = [];
  if (!policy.allowSources.includes(dependency.source)) reasons.push('source_not_allowed');
  if (policy.requireIntegrity && !dependency.integrity) reasons.push('integrity_missing');
  if (policy.requireProvenance && !dependency.provenanceVerified) reasons.push('provenance_unverified');
  if (!policy.allowLifecycleScripts && (dependency.lifecycleScripts?.length ?? 0) > 0) reasons.push('lifecycle_script_present');
  return reasons.length ? { trust: 'blocked', reasons } : { trust: 'approved', reasons: [] };
}

export const DEFAULT_SUPPLY_CHAIN_POLICY: SupplyChainPolicy = {
  allowSources: ['registry'],
  requireIntegrity: true,
  requireProvenance: true,
  allowLifecycleScripts: false,
};
