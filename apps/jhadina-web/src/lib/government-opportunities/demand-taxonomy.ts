export interface GovernmentDemandCategory {
  id: string
  label: string
  aliases: string[]
  signals: string[]
}

/**
 * Broad demand vocabulary seeded from observed federal/state/local procurement
 * categories. It is intentionally provider-neutral so the same vocabulary can
 * drive discovery, normalization, matching, and brokerage analysis.
 */
export const GOVERNMENT_DEMAND_TAXONOMY: GovernmentDemandCategory[] = [
  { id: 'construction', label: 'Construction & Infrastructure', aliases: ['construction', 'renovation', 'road', 'bridge', 'concrete', 'asphalt'], signals: ['IFB', 'RFP', 'IDIQ', 'JOC'] },
  { id: 'hvac', label: 'HVAC & Mechanical', aliases: ['HVAC', 'heating', 'air conditioning', 'mechanical'], signals: ['maintenance', 'replacement', 'commissioning'] },
  { id: 'plumbing-water', label: 'Plumbing, Sewer & Water', aliases: ['plumbing', 'sewer', 'waterline', 'stormwater', 'pump'], signals: ['rehabilitation', 'inspection', 'repair'] },
  { id: 'facilities', label: 'Facilities & Building Maintenance', aliases: ['janitorial', 'custodial', 'building maintenance', 'property management'], signals: ['recurring', 'facility management'] },
  { id: 'waste', label: 'Waste, Recycling & Disposal', aliases: ['waste removal', 'trash', 'recycling', 'disposal'], signals: ['hauling', 'collection', 'disposal'] },
  { id: 'landscaping', label: 'Landscaping, Grounds & Trees', aliases: ['landscaping', 'lawn care', 'tree trimming', 'irrigation'], signals: ['maintenance', 'grounds'] },
  { id: 'environmental', label: 'Environmental & Compliance', aliases: ['environmental', 'testing', 'remediation', 'hazmat'], signals: ['assessment', 'compliance', 'monitoring'] },
  { id: 'security', label: 'Security & Safety', aliases: ['security guard', 'access control', 'CCTV', 'fire safety'], signals: ['inspection', 'monitoring', 'guard'] },
  { id: 'transportation', label: 'Transportation, Freight & Fleet', aliases: ['trucking', 'freight', 'towing', 'moving', 'fleet'], signals: ['route', 'hauling', 'transportation'] },
  { id: 'education', label: 'Education & School Services', aliases: ['school supplies', 'education', 'e-learning', 'academic services'], signals: ['school district', 'university'] },
  { id: 'healthcare', label: 'Healthcare & Medical', aliases: ['medical', 'healthcare', 'ambulance', 'laboratory', 'medical staffing'], signals: ['clinical', 'staffing', 'supplies'] },
  { id: 'professional-services', label: 'Professional & Administrative Services', aliases: ['consulting', 'accounting', 'audit', 'staffing', 'marketing'], signals: ['professional services', 'on-call'] },
  { id: 'it', label: 'IT, Software & Telecommunications', aliases: ['IT', 'software', 'SaaS', 'network', 'fiber', 'telecommunications'], signals: ['subscription', 'implementation', 'support'] },
  { id: 'engineering', label: 'Architecture, Engineering & Surveying', aliases: ['architecture', 'civil engineering', 'surveying', 'GIS'], signals: ['design', 'engineering', 'on-call'] },
  { id: 'food', label: 'Food & Food Services', aliases: ['food service', 'food supply', 'catering', 'food equipment'], signals: ['meal', 'delivery', 'supply'] },
  { id: 'equipment', label: 'Equipment, Materials & Rental', aliases: ['equipment rental', 'office equipment', 'construction materials'], signals: ['rental', 'supply', 'OEM'] },
  { id: 'manufacturing', label: 'Manufacturing & Fabrication', aliases: ['metal fabrication', 'welding', 'plastics', 'uniforms', 'furniture'], signals: ['manufacturing', 'fabrication', 'OEM'] },
  { id: 'printing', label: 'Printing, Mail & Document Services', aliases: ['printing', 'mail', 'scanning', 'shredding', 'document management'], signals: ['print', 'mail', 'records'] },
]

export function findGovernmentDemandCategories(text: string): GovernmentDemandCategory[] {
  const haystack = text.toLowerCase()
  return GOVERNMENT_DEMAND_TAXONOMY.filter((category) =>
    category.aliases.some((alias) => haystack.includes(alias.toLowerCase()))
      || category.signals.some((signal) => haystack.includes(signal.toLowerCase())),
  )
}
