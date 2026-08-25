export type SourcePack = {
  id: string
  name: string
  authority: "official" | "research" | "community"
  domains: string[]
  capabilities: string[]
  caveats: string[]
}

export const AUTHORITATIVE_SOURCE_PACKS: SourcePack[] = [
  {
    id: "us-dotgov-registry",
    name: "CISA .gov Domain Registry",
    authority: "official",
    domains: ["government"],
    capabilities: ["government-source-discovery", "official-domain-verification", "government-entity-resolution"],
    caveats: ["Registered .gov domains do not guarantee that a domain provides an online service."],
  },
  {
    id: "courtlistener",
    name: "CourtListener",
    authority: "research",
    domains: ["legal", "government", "policy"],
    capabilities: ["case-law-search", "docket-research", "legal-citation-verification", "legal-alerts"],
    caveats: ["Legal records require jurisdiction, date, procedural posture, and source-context checks."],
  },
  {
    id: "fbi-ucr-crime-data",
    name: "FBI Uniform Crime Reporting Data",
    authority: "official",
    domains: ["crime", "public-safety", "government"],
    capabilities: ["crime-trend-analysis", "agency-level-data", "SRS", "NIBRS"],
    caveats: ["Participation and reporting coverage vary; historical API versions may be stale and should not be treated as current without verification."],
  },
  {
    id: "firstdata-source-catalog",
    name: "FirstData Source Catalog",
    authority: "research",
    domains: ["meta-source", "government", "finance", "research"],
    capabilities: ["source-discovery", "source-metadata", "authority-discovery", "documentation-discovery"],
    caveats: ["Catalog metadata is a discovery aid; each source must be independently verified before being treated as authoritative."],
  },
]

export function getSourcePack(id: string): SourcePack | undefined {
  return AUTHORITATIVE_SOURCE_PACKS.find((pack) => pack.id === id)
}
