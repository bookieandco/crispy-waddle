export type OpportunityAllocationMeasurement = Readonly<{
  requestId: string
  opportunityId: string
  executionId?: string
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'UNKNOWN'
  plannedSpend: number
  actualSpend: number
  plannedResourceUnits: number
  actualResourceUnits: number
}>
