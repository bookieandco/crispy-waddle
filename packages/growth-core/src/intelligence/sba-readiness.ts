export interface SbaSizeStandard {
  naicsCode: string
  industryDescription: string
  sizeStandard: number
  unit: "employees" | "annual_receipts"
  effectiveDate?: string
}

export interface GovernmentReadinessProfile {
  naicsCode: string
  smallBusinessEligible: boolean | "unknown"
  sizeStandard?: SbaSizeStandard
  missingCapabilities: string[]
  evidence: string[]
}

/** Deterministic first-pass eligibility helper; advisory only. */
export function assessGovernmentReadiness(input: {
  naicsCode: string
  annualReceipts?: number
  employees?: number
  sizeStandard?: SbaSizeStandard
  registeredInSam?: boolean
  requiredCertification?: string
}): GovernmentReadinessProfile {
  const missingCapabilities: string[] = []
  if (!input.registeredInSam) missingCapabilities.push("sam_registration")
  if (input.requiredCertification) missingCapabilities.push(`certification:${input.requiredCertification}`)

  let smallBusinessEligible: boolean | "unknown" = "unknown"
  if (input.sizeStandard) {
    const measure = input.sizeStandard.unit === "employees" ? input.employees : input.annualReceipts
    smallBusinessEligible = typeof measure === "number" ? measure <= input.sizeStandard.sizeStandard : "unknown"
  }

  return {
    naicsCode: input.naicsCode,
    smallBusinessEligible,
    sizeStandard: input.sizeStandard,
    missingCapabilities,
    evidence: [
      `SBA size-standard check for NAICS ${input.naicsCode}`,
      input.registeredInSam ? "SAM registration reported" : "SAM registration not confirmed",
      input.requiredCertification ? `Certification requirement: ${input.requiredCertification}` : "No certification requirement supplied",
    ],
  }
}
