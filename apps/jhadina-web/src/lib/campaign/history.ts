/**
 * JH-CAMPAIGN.HISTORY.01–.08 — source-linked comparative civic history.
 * Educational, descriptive, read-only. Neither policy adoption nor political action authority.
 * Source links were manually reviewed on 2026-10-18; they are NOT live feeds.
 */
export const HISTORY_AS_OF = "2026-10-18"

export type ReferenceSource = {
  id: string
  title: string
  publisher: string
  sourceFamily: "USHMM" | "NPS" | "FEC" | "IRS" | "NARA"
  scope: "HISTORICAL_REFERENCE" | "CURRENT_OFFICIAL_GUIDANCE"
  url: string
  reviewedAt: string
}
export type HistoricalClaim = {
  id: string
  period: string
  kind: "DOCUMENTED_EVENT" | "INTERPRETIVE_QUESTION"
  text: string
  sourceIds: string[]
  limitation: string
}
export type HistoricalCase = {
  id: "weimar" | "montgomery" | "suffrage"
  title: string
  place: string
  period: string
  frame: "DEMOCRATIC_COLLAPSE" | "CIVIC_CHANGE"
  context: string
  outcome: string
  guardrail: string
  claims: HistoricalClaim[]
  questions: string[]
}

export const HISTORY_SOURCES: readonly ReferenceSource[] = [
  { id:"ushmm-rise", title:"Adolf Hitler and the Nazi Rise to Power, 1918–1933", publisher:"United States Holocaust Memorial Museum", sourceFamily:"USHMM", scope:"HISTORICAL_REFERENCE", url:"https://encyclopedia.ushmm.org/content/en/article/the-nazi-rise-to-power", reviewedAt:HISTORY_AS_OF },
  { id:"ushmm-appointment", title:"Hitler Comes to Power", publisher:"United States Holocaust Memorial Museum", sourceFamily:"USHMM", scope:"HISTORICAL_REFERENCE", url:"https://encyclopedia.ushmm.org/content/en/article/hitler-comes-to-power", reviewedAt:HISTORY_AS_OF },
  { id:"ushmm-enabling", title:"The Enabling Act of 1933", publisher:"United States Holocaust Memorial Museum", sourceFamily:"USHMM", scope:"HISTORICAL_REFERENCE", url:"https://encyclopedia.ushmm.org/content/en/article/the-enabling-act", reviewedAt:HISTORY_AS_OF },
  { id:"nps-montgomery", title:"Bricklayers Hall and the Montgomery Improvement Association", publisher:"National Park Service", sourceFamily:"NPS", scope:"HISTORICAL_REFERENCE", url:"https://www.nps.gov/places/bricklayers-hall.htm", reviewedAt:HISTORY_AS_OF },
  { id:"nps-suffrage", title:"19th Amendment", publisher:"National Park Service", sourceFamily:"NPS", scope:"HISTORICAL_REFERENCE", url:"https://www.nps.gov/subjects/womenshistory/19th-amendment.htm", reviewedAt:HISTORY_AS_OF },
  { id:"fec-candidate", title:"House, Senate and presidential candidate registration", publisher:"Federal Election Commission", sourceFamily:"FEC", scope:"CURRENT_OFFICIAL_GUIDANCE", url:"https://www.fec.gov/help-candidates-and-committees/registering-candidate/house-senate-president-candidate-registration/", reviewedAt:HISTORY_AS_OF },
  { id:"nara-electors", title:"Legal Provisions Relevant to the Electoral College Process", publisher:"National Archives", sourceFamily:"NARA", scope:"CURRENT_OFFICIAL_GUIDANCE", url:"https://www.archives.gov/electoral-college/provisions", reviewedAt:HISTORY_AS_OF },
  { id:"irs-charity", title:"Restriction of political campaign intervention by Section 501(c)(3) tax-exempt organizations", publisher:"Internal Revenue Service", sourceFamily:"IRS", scope:"CURRENT_OFFICIAL_GUIDANCE", url:"https://www.irs.gov/charities-non-profits/charitable-organizations/restriction-of-political-campaign-intervention-by-section-501c3-tax-exempt-organizations", reviewedAt:HISTORY_AS_OF },
]

export const HISTORY_CASES: readonly HistoricalCase[] = [
  {
    id:"weimar", title:"Weimar Germany and the Nazi seizure of power", place:"Germany",
    period:"1918–1933", frame:"DEMOCRATIC_COLLAPSE",
    context:"Economic crisis and weak coalitions interacted with organized propaganda, intimidation and political violence. The Nazi movement was anti-democratic; these practices are historical warnings, not a toolkit.",
    outcome:"After the January 1933 appointment, emergency decrees and the March 1933 Enabling Act dismantled democratic checks.",
    guardrail:"Never equate an election, an appointment, legal formalities or media attention with democratic legitimacy when opposition and civil liberties are being suppressed.",
    claims:[
      { id:"weimar-election", period:"July–November 1932", kind:"DOCUMENTED_EVENT", text:"The Nazi Party received approximately 37% of the July 1932 parliamentary vote, falling to approximately 33% in November; neither result was a majority.", sourceIds:["ushmm-appointment"], limitation:"German parliamentary shares are not comparable to modern US presidential electoral-vote requirements." },
      { id:"weimar-appointment", period:"January 30, 1933", kind:"DOCUMENTED_EVENT", text:"President Paul von Hindenburg appointed Hitler chancellor following negotiations among political leaders; Hitler was not directly elected chancellor.", sourceIds:["ushmm-appointment"], limitation:"A Weimar appointment mechanism is not the US presidential election process." },
      { id:"weimar-enabling", period:"March 23, 1933", kind:"DOCUMENTED_EVENT", text:"The Enabling Act was passed amid arrests and intimidation, giving the government lawmaking powers that bypassed parliament.", sourceIds:["ushmm-enabling"], limitation:"Calling this simply lawful change conceals systematic coercion and denial of opposition representation." },
      { id:"weimar-causation", period:"1918–1933", kind:"INTERPRETIVE_QUESTION", text:"How did economic conditions, institutional bargains, propaganda and organized coercion interact?", sourceIds:["ushmm-rise"], limitation:"This is a research question, not a quantified causal finding." },
    ],
    questions:[
      "What separates popularity, votes, appointment and effective control of state institutions?",
      "Which safeguards failed when legal formalities were combined with intimidation?",
      "What evidence would distinguish economic grievance from scapegoating and disinformation?"
    ],
  },
  {
    id:"montgomery", title:"Montgomery bus boycott", place:"Montgomery, Alabama, USA",
    period:"1955–1956", frame:"CIVIC_CHANGE",
    context:"Black residents, local organizations and civic leaders pursued nonviolent public protest and legal challenges to segregation.",
    outcome:"The sustained boycott and federal litigation contributed to the end of segregated buses in Montgomery.",
    guardrail:"Protect voluntary participation, equal rights and peaceful dissent; do not reduce collective action to a single charismatic leader.",
    claims:[
      { id:"montgomery-formation", period:"December 5, 1955", kind:"DOCUMENTED_EVENT", text:"The Montgomery Improvement Association was formed four days after Rosa Parks was arrested.", sourceIds:["nps-montgomery"], limitation:"The source describes a specific local civil-rights campaign, not an electoral candidate campaign." },
      { id:"montgomery-length", period:"1955–1956", kind:"DOCUMENTED_EVENT", text:"Black residents of Montgomery boycotted municipal buses for 381 days.", sourceIds:["nps-montgomery"], limitation:"Duration describes sustained civic action, not a universally transferable formula." },
      { id:"montgomery-lawsuit", period:"1956", kind:"DOCUMENTED_EVENT", text:"The federal case Gayle v. Browder reached the Supreme Court, which struck down bus segregation laws.", sourceIds:["nps-montgomery"], limitation:"Legal and grassroots efforts must be understood in their particular historical setting." },
    ],
    questions:[
      "What roles did community organizations, legal institutions and sustained public participation play?",
      "How did the campaign protect civic rights while challenging unjust institutions?",
      "Whose contributions disappear when this history is told only through prominent individuals?"
    ],
  },
  {
    id:"suffrage", title:"US women's suffrage and the 19th Amendment", place:"United States",
    period:"1848–1920", frame:"CIVIC_CHANGE",
    context:"A decades-long movement encompassed different organizations, strategies and disagreements over equality and political rights.",
    outcome:"The Nineteenth Amendment prohibited denial of voting rights on account of sex, although discriminatory barriers continued to restrict many women's actual access to the vote.",
    guardrail:"Study both achievements and exclusions; a constitutional change does not automatically secure equal access in practice.",
    claims:[
      { id:"suffrage-origins", period:"1848", kind:"DOCUMENTED_EVENT", text:"The Seneca Falls convention helped catalyze an organized national women's suffrage movement.", sourceIds:["nps-suffrage"], limitation:"Many earlier activists and other contemporaneous movements also influenced suffrage history." },
      { id:"suffrage-ratification", period:"August 1920", kind:"DOCUMENTED_EVENT", text:"The Nineteenth Amendment was ratified in August 1920 after decades of organizing.", sourceIds:["nps-suffrage"], limitation:"Formal ratification did not remove all discriminatory voting restrictions." },
      { id:"suffrage-differences", period:"1848–1920", kind:"DOCUMENTED_EVENT", text:"Suffrage organizers differed in their methods and priorities.", sourceIds:["nps-suffrage"], limitation:"Avoid representing the movement as uniformly organized or inclusive." },
    ],
    questions:[
      "How did organizations cooperate despite disagreements?",
      "How did legal amendment work differ from informal public advocacy?",
      "Which groups still faced barriers even after the formal constitutional change?"
    ],
  },
]

export const HISTORY_GUARDRAILS: readonly string[] = [
  "Study authoritarian propaganda and intimidation as documented failure modes, not transferable campaign instructions.",
  "No deception, synthetic grassroots identity, intimidation, political violence or suppression of peaceful opposition.",
  "No voter profiling, sensitive-attribute inference, personalized political persuasion or electoral outcome optimization.",
  "Public records and historical evidence remain descriptive; no automatic publishing, spending, fundraising or outreach.",
  "Maintain independent civic and candidate records, especially where charitable resources and campaign activity might overlap.",
  "Never convert a sourced historical account into a claimed prediction about a modern election.",
]

export const CIVIC_REFERENCE_NOTES = [
  { label:"Constitution and Electoral College", text:"The US presidential process differs fundamentally from Weimar parliamentary appointments.", sourceId:"nara-electors" },
  { label:"Federal candidacy", text:"FEC guidance generally discusses a $5,000 contribution/expenditure threshold and subsequent registration duties; actual activity and timing matter.", sourceId:"fec-candidate" },
  { label:"Charity separation", text:"Section 501(c)(3) organizations are prohibited from intervening on behalf of or against a candidate; nonpartisan education can be treated differently based on the facts.", sourceId:"irs-charity" },
] as const

export function historySourcesForClaim(claim: HistoricalClaim): ReferenceSource[] {
  const uniqueIds = Array.from(new Set(claim.sourceIds))
  return uniqueIds.flatMap(id => HISTORY_SOURCES.filter(source => source.id === id))
}

export function auditHistoryCases(cases: readonly HistoricalCase[], sources: readonly ReferenceSource[] = HISTORY_SOURCES): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const sourceIds = new Set<string>()
  for (const source of sources) {
    if (!source.id || sourceIds.has(source.id)) problems.push("duplicate-or-empty-source:" + source.id)
    sourceIds.add(source.id)
    try { if (new URL(source.url).protocol !== "https:") problems.push("non-https-source:" + source.id) }
    catch { problems.push("invalid-source-url:" + source.id) }
    if (!Number.isFinite(Date.parse(source.reviewedAt))) problems.push("missing-review-date:" + source.id)
  }
  const caseIds = new Set<string>()
  for (const item of cases) {
    if (caseIds.has(item.id)) problems.push("duplicate-case:" + item.id)
    caseIds.add(item.id)
    if (!item.context.trim() || !item.guardrail.trim() || !item.outcome.trim()) problems.push("incomplete-case:" + item.id)
    for (const claim of item.claims) {
      if (!claim.id || ids.has(claim.id)) problems.push("duplicate-or-empty-claim:" + claim.id)
      ids.add(claim.id)
      if (!claim.period.trim() || !claim.text.trim() || !claim.limitation.trim()) problems.push("incomplete-claim:" + claim.id)
      if (!claim.sourceIds.length) problems.push("unsupported-claim:" + claim.id)
      for (const id of claim.sourceIds) if (!sourceIds.has(id)) problems.push("unknown-source:" + claim.id + ":" + id)
    }
  }
  return problems
}
