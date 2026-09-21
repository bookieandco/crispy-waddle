# Jhadina Intelligence Fabric

## Purpose

Provide one collection, normalization, change-detection and daily-report layer that can feed every Jhadina OS rather than building separate scrapers inside each product.

## Engines

- **Firecrawl** — web search/map/crawl and structured extraction.
- **Crawlee** — scalable TypeScript crawler runtime, queues, retries and browser automation.
- **Scrapling** — adaptive Python parsing/fetching fallback for changing sites.
- **changedetection.io** — persistent URL monitoring and change events.

These are collection engines. None is itself a source of truth.

## Pipeline

```text
Watchlist / Source Registry
        |
        v
Collection Router
  |       |       |       |
Firecrawl Crawlee Scrapling changedetection
        |
        v
Raw Capture + Provenance
        |
        v
Normalizer / Deduplicator
        |
        v
Evidence Ledger
        |
        +--> Entity Resolution
        +--> Topic / Event Extraction
        +--> Change Detection
        +--> Cross-source Corroboration
        |
        v
Intelligence Signals
        |
        v
Jhadina Daily Log
        |
        +--> CampaignOS
        +--> SocialOS
        +--> Money Core
        +--> OverageOS
        +--> Music / Media
        +--> General Jhadina
```

## Daily log contract

Every daily log should answer:

1. What changed?
2. What is new?
3. What is still unresolved?
4. Which sources corroborate the signal?
5. Which sources disagree?
6. What requires human review?
7. What action or follow-up is worth considering?

The system must preserve source URLs, timestamps, hashes and provenance so Jhadina can distinguish observed facts from derived interpretations.

## Change-first collection

Do not recrawl everything every day. Maintain watchlists and use change detection for known sources. Escalate changed pages into deeper extraction. This reduces cost and noise.

## Cross-OS examples

### OverageOS

Watch county surplus-property pages, auction notices, unclaimed-property lists, recorder/treasurer pages and local reporting. A change becomes an evidence candidate and can update an opportunity.

### Money Core

Watch official company releases, filings, market notices and selected public commentary. Social chatter is a secondary signal and never an automatic trade instruction.

### CampaignOS

Watch public candidate communications, official government data, public polling, legislation, election information and local reporting. Jhadina separates public conversation from verified outcomes.

### SocialOS

Watch the user's own authorized/public accounts, competitor/public accounts where permitted, platform trend pages and campaign/brand references. Convert changes into content-performance and trend signals.

## Safety and compliance boundary

Only collect sources through permitted public access, official APIs, licensed data or authorized connectors. Do not bypass authentication, paywalls, access controls or platform restrictions. Do not infer sensitive personal attributes from scraped data. Do not use the fabric to automate individual-level political persuasion or financial trading decisions.
