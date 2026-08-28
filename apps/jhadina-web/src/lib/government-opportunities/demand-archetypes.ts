export type DemandArchetypeId =
  | 'MANDATED_COMPLIANCE_SERVICE'
  | 'RECURRING_ROUTE_SERVICE'
  | 'URGENT_SPECIALTY_REPAIR'
  | 'EQUIPMENT_ENABLED_SERVICE'
  | 'STAFFING_PLACEMENT'
  | 'BROKERED_FIELD_SERVICE'
  | 'PUBLICLY_FUNDED_SERVICE'
  | 'GOVERNMENT_PROCUREMENT'
  | 'SUBCONTRACTING'

export type DeliveryMode =
  | 'OWNER_OPERATOR'
  | 'EMPLOYEE_CREW'
  | 'INDEPENDENT_PROVIDER'
  | 'SUBCONTRACTOR'
  | 'PRIME_WITH_SUBCONTRACTORS'
  | 'BROKER'
  | 'TEAMING'

export interface DemandArchetype {
  id: DemandArchetypeId
  name: string
  recurring: boolean
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  regulatoryDependency: boolean
  assetIntensity: 'LOW' | 'MEDIUM' | 'HIGH'
  laborIntensity: 'LOW' | 'MEDIUM' | 'HIGH'
  deliveryModes: DeliveryMode[]
  signals: string[]
}

export const DEMAND_ARCHETYPES: DemandArchetype[] = [
  {
    id: 'MANDATED_COMPLIANCE_SERVICE',
    name: 'Mandated or required compliance service',
    recurring: true,
    urgency: 'HIGH',
    regulatoryDependency: true,
    assetIntensity: 'MEDIUM',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'INDEPENDENT_PROVIDER', 'SUBCONTRACTOR'],
    signals: ['inspection', 'testing', 'certification', 'permit', 'required', 'compliance', 'renewal'],
  },
  {
    id: 'RECURRING_ROUTE_SERVICE',
    name: 'Recurring route service',
    recurring: true,
    urgency: 'MEDIUM',
    regulatoryDependency: false,
    assetIntensity: 'MEDIUM',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'INDEPENDENT_PROVIDER', 'SUBCONTRACTOR'],
    signals: ['weekly', 'monthly', 'quarterly', 'route', 'pickup', 'scheduled service'],
  },
  {
    id: 'URGENT_SPECIALTY_REPAIR',
    name: 'Urgent specialty repair',
    recurring: false,
    urgency: 'HIGH',
    regulatoryDependency: false,
    assetIntensity: 'MEDIUM',
    laborIntensity: 'HIGH',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'SUBCONTRACTOR'],
    signals: ['emergency', 'same day', 'repair', 'downtime', 'outage', 'preventive maintenance'],
  },
  {
    id: 'EQUIPMENT_ENABLED_SERVICE',
    name: 'Equipment-enabled field service',
    recurring: true,
    urgency: 'MEDIUM',
    regulatoryDependency: true,
    assetIntensity: 'HIGH',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'SUBCONTRACTOR'],
    signals: ['truck', 'vacuum', 'specialized equipment', 'hauling', 'disposal', 'recycling'],
  },
  {
    id: 'STAFFING_PLACEMENT',
    name: 'Staffing or placement',
    recurring: false,
    urgency: 'HIGH',
    regulatoryDependency: true,
    assetIntensity: 'LOW',
    laborIntensity: 'LOW',
    deliveryModes: ['BROKER', 'TEAMING', 'SUBCONTRACTOR'],
    signals: ['recruiting', 'placement', 'staffing', 'qualified workers', 'temporary labor'],
  },
  {
    id: 'BROKERED_FIELD_SERVICE',
    name: 'Brokered local field service',
    recurring: true,
    urgency: 'MEDIUM',
    regulatoryDependency: true,
    assetIntensity: 'LOW',
    laborIntensity: 'LOW',
    deliveryModes: ['BROKER', 'INDEPENDENT_PROVIDER', 'PRIME_WITH_SUBCONTRACTORS'],
    signals: ['local provider', 'service area', 'licensed contractor', 'dispatch', 'lead flow'],
  },
  {
    id: 'PUBLICLY_FUNDED_SERVICE',
    name: 'Publicly funded or reimbursed service',
    recurring: true,
    urgency: 'MEDIUM',
    regulatoryDependency: true,
    assetIntensity: 'MEDIUM',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'INDEPENDENT_PROVIDER', 'SUBCONTRACTOR'],
    signals: ['reimbursement', 'Medicaid', 'insurance', 'grant funded', 'public funding'],
  },
  {
    id: 'GOVERNMENT_PROCUREMENT',
    name: 'Direct government procurement',
    recurring: false,
    urgency: 'MEDIUM',
    regulatoryDependency: true,
    assetIntensity: 'MEDIUM',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['OWNER_OPERATOR', 'EMPLOYEE_CREW', 'PRIME_WITH_SUBCONTRACTORS', 'TEAMING'],
    signals: ['RFP', 'RFQ', 'IFB', 'solicitation', 'bid', 'purchase order', 'contract'],
  },
  {
    id: 'SUBCONTRACTING',
    name: 'Prime or government subcontracting',
    recurring: true,
    urgency: 'MEDIUM',
    regulatoryDependency: true,
    assetIntensity: 'LOW',
    laborIntensity: 'MEDIUM',
    deliveryModes: ['SUBCONTRACTOR', 'TEAMING', 'BROKER'],
    signals: ['subcontract', 'teaming', 'supplier', 'prime contractor', 'subcontracting plan'],
  },
]

export function classifyDemandArchetypes(text: string): DemandArchetype[] {
  const normalized = text.toLowerCase()
  return DEMAND_ARCHETYPES.filter((archetype) =>
    archetype.signals.some((signal) => normalized.includes(signal.toLowerCase())),
  )
}

export function rankForOwnerLeverage(archetype: DemandArchetype): number {
  const deliveryLeverage = archetype.deliveryModes.includes('BROKER') ||
    archetype.deliveryModes.includes('PRIME_WITH_SUBCONTRACTORS')
    ? 30
    : archetype.deliveryModes.includes('SUBCONTRACTOR') || archetype.deliveryModes.includes('INDEPENDENT_PROVIDER')
      ? 20
      : 0

  const recurring = archetype.recurring ? 25 : 0
  const regulatory = archetype.regulatoryDependency ? 20 : 0
  const lowLabor = archetype.laborIntensity === 'LOW' ? 15 : archetype.laborIntensity === 'MEDIUM' ? 8 : 0
  const urgency = archetype.urgency === 'HIGH' ? 10 : archetype.urgency === 'MEDIUM' ? 5 : 0

  return Math.min(100, deliveryLeverage + recurring + regulatory + lowLabor + urgency)
}
