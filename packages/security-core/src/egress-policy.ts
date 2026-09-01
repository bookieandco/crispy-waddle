export type EgressDataClass = 'public' | 'internal' | 'pii' | 'secret';

export type EgressRequest = {
  requestId: string;
  actorId: string;
  capability: string;
  destination: string;
  method?: string;
  dataClass?: EgressDataClass;
  payloadBytes?: number;
  issuedAt: number;
  expiresAt: number;
};

export type EgressRule = {
  capability: string;
  hosts: readonly string[];
  protocols?: readonly ('http' | 'https')[];
  ports?: readonly number[];
  maxPayloadBytes?: number;
  allowedDataClasses?: readonly EgressDataClass[];
};

export type EgressDecision = {
  decision: 'allow' | 'deny';
  reason: string;
  policyVersion: string;
  normalizedDestination?: string;
};

export type EgressResolver = {
  resolve(hostname: string): Promise<readonly string[]>;
};

const POLICY_VERSION = 'egress-v1';
const BLOCKED_HOSTNAMES = new Set([
  'localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback',
  'metadata.google.internal', 'metadata', 'instance-data.ec2.internal',
]);

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function ipv4Number(value: string): number | null {
  if (!isIpv4(value)) return null;
  return value.split('.').reduce((n, p) => (n * 256) + Number(p), 0);
}

function blockedIpv4(value: string): boolean {
  const n = ipv4Number(value);
  if (n === null) return false;
  const first = Number(value.split('.')[0]);
  const second = Number(value.split('.')[1]);
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first >= 224) || n === 0xA9FEA9FE || n === 0xA9FEA9FE;
}

function blockedIpv6(value: string): boolean {
  const h = value.toLowerCase();
  if (!h.includes(':')) return false;
  const compact = h.replace(/^\[|\]$/g, '');
  if (compact === '::' || compact === '::1' || compact === '0:0:0:0:0:0:0:1') return true;
  const first = compact.split(':')[0] || '0';
  const firstNum = parseInt(first, 16);
  return firstNum === 0 || (firstNum >= 0xfc00 && firstNum <= 0xfdff)
    || (firstNum >= 0xfe80 && firstNum <= 0xfebf)
    || (firstNum >= 0xff00 && firstNum <= 0xffff)
    || compact.startsWith('::ffff:') && blockedIpv4(compact.slice(7));
}

function hostnameIsBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return BLOCKED_HOSTNAMES.has(host) || isIpv4(host) && blockedIpv4(host) || blockedIpv6(host);
}

function normalizeDestination(raw: string): URL | null {
  if (!raw || raw.length > 2048 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.pathname.includes('\\') || url.hostname.includes('\\')) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function matchesHost(hostname: string, allowed: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const rule = allowed.toLowerCase().replace(/\.$/, '');
  return host === rule;
}

export class EgressPolicy {
  constructor(private readonly rules: readonly EgressRule[], private readonly resolver?: EgressResolver) {}

  async authorize(request: EgressRequest): Promise<EgressDecision> {
    const deny = (reason: string): EgressDecision => ({ decision: 'deny', reason, policyVersion: POLICY_VERSION });
    const url = normalizeDestination(request.destination);
    if (!url) return deny('invalid_or_ambiguous_destination');
    if (!request.requestId || !request.actorId || !request.capability) return deny('missing_security_binding');
    if (!Number.isFinite(request.issuedAt) || !Number.isFinite(request.expiresAt) || request.expiresAt <= Date.now() || request.issuedAt > Date.now() + 30_000) return deny('expired_or_invalid_lifetime');
    if (hostnameIsBlocked(url.hostname)) return deny('private_or_metadata_destination');

    const rule = this.rules.find((candidate) => candidate.capability === request.capability && candidate.hosts.some((host) => matchesHost(url.hostname, host)));
    if (!rule) return deny('destination_not_allowlisted');

    const protocol = url.protocol === 'https:' ? 'https' : 'http';
    if (rule.protocols && !rule.protocols.includes(protocol)) return deny('protocol_not_allowed');
    const port = url.port ? Number(url.port) : protocol === 'https' ? 443 : 80;
    if (rule.ports && !rule.ports.includes(port)) return deny('port_not_allowed');
    if (request.dataClass === 'secret') return deny('secret_egress_denied');
    if (request.dataClass && rule.allowedDataClasses && !rule.allowedDataClasses.includes(request.dataClass)) return deny('data_class_not_allowed');
    if (request.payloadBytes !== undefined && (!Number.isSafeInteger(request.payloadBytes) || request.payloadBytes < 0 || request.payloadBytes > (rule.maxPayloadBytes ?? 1_048_576))) return deny('payload_limit_exceeded');

    if (this.resolver) {
      let addresses: readonly string[];
      try { addresses = await this.resolver.resolve(url.hostname); } catch { return deny('destination_resolution_failed'); }
      if (addresses.length === 0 || addresses.some(hostnameIsBlocked)) return deny('resolved_private_or_metadata_destination');
    }

    return { decision: 'allow', reason: 'allowlisted_destination', policyVersion: POLICY_VERSION, normalizedDestination: url.toString() };
  }
}

export const JHADINA_DEFAULT_EGRESS_RULES: readonly EgressRule[] = [
  { capability: 'research.run', hosts: ['api.github.com', 'raw.githubusercontent.com'], protocols: ['https'], ports: [443], maxPayloadBytes: 1_048_576, allowedDataClasses: ['public'] },
];
