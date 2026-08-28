# OCE-6 — Government Opportunity Intelligence

## Objective

Expand the existing canonical Opportunity Commerce Engine into a geographic
and source-aware government demand graph. Do not create a competing
opportunity model or repository.

## Money / demand lanes

### 1. Direct procurement
- Federal solicitations: SAM.gov
- Federal forecasts: GSA Forecast of Contracting Opportunities + agency forecasts
- State procurement portals and state purchasing departments
- County purchasing departments
- Municipal purchasing departments
- School districts
- Universities and community colleges
- Transit authorities
- Airports and ports
- Utilities and water districts
- Housing authorities
- Public hospitals / health systems
- Special districts and authorities

### 2. Historical spend / market intelligence
- USAspending / federal award data
- State and local award tabs and contract registers
- Vendor award histories
- Expiring contracts / option years / recompetes
- Budget documents and capital improvement plans
- Board/council agendas and procurement approvals

### 3. Subcontracting / teaming
- SBA SUBNet
- Prime-contractor subcontracting directories
- Agency small-business offices / OSDBU / OSBP
- GSA subcontracting directory
- Mentor-protege and teaming ecosystems

### 4. Assistance / money programs
- Grants.gov
- SBA programs
- State grant portals
- Local economic-development programs
- Workforce and training subsidies
- Agriculture / energy / infrastructure assistance
- Disaster and recovery programs

### 5. Regulation-created demand
- Required inspections
- Required testing
- Required certifications
- Environmental compliance
- Waste / hazardous-material disposal
- Fire and life-safety compliance
- Backflow / water compliance
- Elevator and equipment inspections
- Building and occupational compliance
- Licensed recurring services

### 6. Tax / incentive intelligence
- Federal tax incentives
- State tax credits
- Local abatements / exemptions
- Equipment and investment incentives
- Industry-specific incentives

## Discovery order

Country → State → County → Municipality → Government Entity → Department /
Agency → Procurement Portal / Official Source → Notice / Forecast / Award /
Requirement.

The hierarchy is a discovery and filtering dimension; the canonical Opportunity
remains the downstream commerce object.

## Source registry requirements

Each source records:
- jurisdiction and government entity
- government entity type
- official URL
- procurement URL when distinct
- source kind
- portal/platform
- discovery capabilities
- evidence freshness
- active status
- last verification

## Opportunity normalization

Every discovered item should retain provenance and normalize into the existing
Opportunity boundary. Preserve the original source URL, source identifier,
notice/solicitation identifier, issuing entity, geography, dates, value/range,
requirements, set-aside, and source evidence.

## Brokerage / middleman guardrail

A discovered opportunity may be routed to PRIME, SUBCONTRACT, TEAMING,
PARTNER, BROKER_REVIEW, or PASS. `BROKER_REVIEW` is not permission to resell
a government contract. Before recommending an intermediary structure, research
must verify solicitation terms, limitations on subcontracting, licensing,
insurance/bonding, required self-performance, and any flow-down requirements.

## Initial source universe

Federal official sources are the authoritative starting point: SAM.gov,
USAspending, GSA forecasts, Acquisition.gov agency forecasts, SBA SUBNet and
agency small-business offices. GSA explicitly points small businesses to these
sources for finding opportunities and subcontracting paths.

State/local coverage should be built as a registry of official agency sources
and portal mappings. Aggregators may be used for discovery/coverage checks, but
an official issuing source remains the verification authority.

## Provider graph

Future OCE-6 phases should maintain a separate provider/supply graph:
provider → capability → geography → license/certification → capacity →
government experience → opportunity match.

This graph feeds the existing FIND_PARTNER research path rather than creating a
second execution workflow.

## Phase plan

- OCE-6.1: Government Source Registry + geographic entity contract
- OCE-6.2: Federal source adapters / forecast + award intelligence
- OCE-6.3: State/county/municipal portal registry and adapters
- OCE-6.4: Special government entities (schools, universities, utilities,
  transit, airports, ports, housing authorities, hospitals)
- OCE-6.5: Provider intelligence graph
- OCE-6.6: Opportunity/provider matching + brokerage review
- OCE-6.7: Money Command Center projection and geographic search
- OCE-6.8: Regulatory-demand and tax-incentive intelligence

## Current implementation

OCE-6.1 begins with a pure TypeScript source-registry contract and in-memory
implementation. It intentionally does not write a new persistence schema or
replace the canonical Opportunity repository.
