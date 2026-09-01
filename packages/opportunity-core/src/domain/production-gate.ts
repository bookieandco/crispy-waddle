export type GateStatus = 'PASS' | 'PASS_WITH_REMEDIATION' | 'BLOCKED'

export type GateFinding = {
  stage: string
  category: 'CONTRACT' | 'EVIDENCE' | 'IDENTITY' | 'PERSISTENCE' | 'INTEGRATION' | 'TEST' | 'BUILD'
  severity: 'INFO' | 'WARNING' | 'BLOCKER'
  message: string
  remediation?: string
}

export type ProductionGateReport = {
  status: GateStatus
  stages: Record<string, 'CONFIRMED' | 'UNCONFIRMED' | 'MISSING'>
  findings: GateFinding[]
  generatedAt: string
  gateVersion: string
}

export function deriveGateStatus(findings: GateFinding[]): GateStatus {
  if (findings.some(finding => finding.severity === 'BLOCKER')) return 'BLOCKED'
  if (findings.some(finding => finding.severity === 'WARNING')) return 'PASS_WITH_REMEDIATION'
  return 'PASS'
}

export function createProductionGateReport(
  stages: ProductionGateReport['stages'],
  findings: GateFinding[],
  generatedAt: string,
  gateVersion = '6.0.0',
): ProductionGateReport {
  return { status: deriveGateStatus(findings), stages, findings: [...findings], generatedAt, gateVersion }
}
