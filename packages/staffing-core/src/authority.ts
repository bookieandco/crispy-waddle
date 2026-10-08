export const STAFFING_CANONICAL_AUTHORITY = {
  system: "StaffingOS",
  packageName: "@staffing/core",
  owns: [
    "organizations",
    "memberships",
    "jobs",
    "applications",
    "candidate-pipeline",
    "placements",
    "timesheets",
    "invoices",
    "payments",
    "financial-ledgers",
  ],
  placementCoreRole: "compatibility-facade",
  placementCoreMayOwnCanonicalStaffingState: false,
} as const;

export type StaffingCanonicalAuthority = typeof STAFFING_CANONICAL_AUTHORITY;
