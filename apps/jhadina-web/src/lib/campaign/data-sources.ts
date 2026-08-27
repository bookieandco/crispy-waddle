export type CampaignDataSource = {
  id: string
  name: string
  category:
    | "polling"
    | "public_opinion"
    | "elections"
    | "government_data"
    | "local_reporting"
    | "public_feedback"
  access: "public" | "api_key" | "subscription" | "connector"
  refresh: "manual" | "scheduled" | "realtime"
  authority: "primary" | "secondary"
  notes: string
}

/**
 * Initial registry for public political evidence. Credentials and ingestion
 * adapters stay outside this registry; this is the normalized source map.
 */
export const CAMPAIGN_DATA_SOURCES: CampaignDataSource[] = [
  {
    id: "pew",
    name: "Pew Research Center",
    category: "public_opinion",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Public polling, issue attitudes, methodology and downloadable tables.",
  },
  {
    id: "gallup",
    name: "Gallup",
    category: "public_opinion",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Long-running public opinion and issue trend research.",
  },
  {
    id: "ap-norc",
    name: "AP-NORC",
    category: "polling",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Public-use polling files, toplines and methodology.",
  },
  {
    id: "census",
    name: "U.S. Census Bureau",
    category: "government_data",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Population, household, income, housing and demographic statistics.",
  },
  {
    id: "bls",
    name: "U.S. Bureau of Labor Statistics",
    category: "government_data",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Employment, wages, prices and labor-market statistics.",
  },
  {
    id: "bea",
    name: "U.S. Bureau of Economic Analysis",
    category: "government_data",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Income, GDP, consumer spending and regional economic accounts.",
  },
  {
    id: "fec",
    name: "Federal Election Commission",
    category: "elections",
    access: "public",
    refresh: "scheduled",
    authority: "primary",
    notes: "Campaign finance filings, receipts, disbursements and candidate committees.",
  },
  {
    id: "ap-elections",
    name: "AP Elections API",
    category: "elections",
    access: "api_key",
    refresh: "realtime",
    authority: "primary",
    notes: "National, state and local election results; credentials required.",
  },
  {
    id: "local-news",
    name: "Local reporting network",
    category: "local_reporting",
    access: "public",
    refresh: "scheduled",
    authority: "secondary",
    notes: "Local reporting is triangulated and never treated as a standalone fact source.",
  },
]
