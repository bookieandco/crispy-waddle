# SH TikTok Shop / Creator Outreach reference audit

Date: 2026-09-21
Branch: feat/sh-tiktok-shop-growth-outreach
Disposition: HIGH_VALUE / OFFICIAL_API_FIRST

References:
- tiktok/tiktok-business-api-sdk
- Zeeshanahmad4/TikTok-Shop-Affiliate-Outreach-Bot
- vooltex8egp/tiktok-shop-scraper
- mehmetkirkoca/social-media-manager
- aaron-he-zhu/aaron-marketing-skills
- YINDEEINDY/chatbot-builder

## Executive finding

TikTok Shop should be modeled as a distinct commerce/growth channel layered over the already-certified Side Hustle stack.

The correct authority path is:

Opportunity
-> TikTok Shop / creator evidence
-> Growth campaign + creator selection
-> governed brand/channel voice realization
-> Social / Business Messaging / TikTok Shop official connector
-> Commerce order/product truth
-> Attribution
-> Money actuals
-> Opportunity learning

No external repo should become a second Social, Growth, Personality, Commerce, or Action authority.

## Official TikTok surfaces worth prioritizing

### TikTok Shop Affiliate APIs
TikTok has publicly announced general availability of Shop Affiliate APIs. This is the preferred creator/affiliate integration surface where applicable.

Potential Jhadina use:
- creator/affiliate discovery
- collaboration-state normalization
- creator campaign evidence
- offer/product linkage
- affiliate performance outcomes
- seller/creator communication workflow where supported

### TikTok API for Business
Official Business APIs currently cover:
- authentication / account access
- campaign creation/management
- audiences / lookalikes
- reporting
- conversion/Events API
- creative operations
- TikTok One / creator-marketplace surfaces
- Business Messaging APIs
- Business Messaging webhooks
- account/content APIs

This should be the default production connector family for paid TikTok growth.

### Business Messaging
Official Business Messaging supports conversation and message APIs plus webhooks and automatic messages for eligible/verified Business Accounts.

Jhadina should not assume unrestricted cold-DM capability. Each provider operation must check platform capability/eligibility and current provider constraints before send.

### Research / observed evidence
TikTok's official research APIs now expose TikTok Shop product/shop information under approved research access. Prefer supported data APIs over unverified scraper infrastructure when available.

## Repo disposition

### 1. tiktok/tiktok-business-api-sdk — HIGH VALUE / OFFICIAL

Use:
- authentication patterns
- generated API clients
- campaign management
- reporting
- account/audience/creative operations
- conversion APIs
- official error/rate-limit semantics

Do not:
- import the full generated SDK wholesale into core packages;
- let provider SDK types become Jhadina domain types;
- let provider mutation bypass Action Core.

Correct placement:
Growth connector -> TikTok Business adapter -> canonical Growth events/campaign state.

### 2. TikTok-Shop-Affiliate-Outreach-Bot — CONCEPT / WORKFLOW ONLY

The public GitHub repository contains README/media material rather than the implementation.

Useful concepts:
- large creator roster
- creator filtering
- open vs targeted collaboration
- personalized messages
- brand-voice adaptation
- duplicate prevention
- product cards
- follow-up tracking
- multi-shop operation
- sample-request / conversion funnel reporting

Reject as architecture:
- unsupported sales-growth claims
- "human-like typing" / VA mimicry as an anti-detection strategy
- blind mass messaging
- external creator/email database as trusted truth without source/consent/eligibility provenance

Correct Jhadina pattern:
creator discovery
-> evidence + fit
-> outreach plan
-> exact current-touch approval/eligibility
-> official provider message connector
-> response/outcome
-> Growth learning.

### 3. vooltex8egp/tiktok-shop-scraper — REFERENCE ONLY

Current repository root contains no implementation beyond repository/license material despite its scraper description.

Do not treat it as code evidence.

Potential concept only:
- shop/product/seller/price/rating/availability observations.

Prefer:
- TikTok-supported Shop/Research APIs;
- authorized Shop partner surfaces;
- licensed/terms-compliant commercial data providers.

### 4. social-media-manager — ARCHITECTURE REFERENCE

Useful patterns:
- per-platform provider services
- unified feed
- cross-platform scheduling
- platform-specific content adaptation
- job queue
- independent platform connectors

Jhadina already has Social Core, durable publication proposals, outbox, approval receipts, and reconciliation.

Adapt only:
- provider service isolation
- feed aggregation UX
- platform formatting contract
- schedule/dashboard concepts.

Do not import:
- separate Mongo/RabbitMQ/Redis social authority;
- parallel scheduler/publisher infrastructure.

### 5. aaron-marketing-skills — HIGH VALUE KNOWLEDGE REFERENCE

Strongest reusable material:
- creator discovery
- creator fit scoring
- outreach manager
- campaign planner
- creator-content auditing
- brand narrative / voice dossier
- claims registry
- consent/suppression concepts
- paid-ad / attribution / experiment loops
- explicit separation between reversible drafting and consequential sending

Particularly useful outreach principles:
- stable creator identity
- evidence-backed personalization
- no invented personal facts
- deduplication
- scoped decline / stop-contact state
- one currently-due touch at a time
- explicit approval before send
- fresh eligibility/suppression check
- preserve outcome lineage
- negotiation / offer tracking

Do not copy the repo as a new marketing runtime. Map its useful skills into existing Growth/Social/Attribution/Action architecture.

### 6. chatbot-builder — UX / CONVERSATION-OPERATIONS REFERENCE

Useful:
- visual conversation flow editor
- reusable blocks
- contact tags/custom fields
- broadcast planning
- analytics
- live human takeover
- encrypted provider tokens
- Messenger/Instagram connector examples

Correct Jhadina use:
- visual outreach/response-flow designer
- inbox triage
- human takeover/escalation
- reusable channel conversation blocks

Do not import:
- a second auth system
- a second contacts database
- a second broadcast executor
- unrestricted bulk sends.

## Cross-platform personality design

Do NOT create mutable independent agent personalities that can diverge from Jhadina governance.

Use:

Jhadina PersonalityState
-> Behavioral Kernel
-> Expression Kernel
-> BrandVoiceProfile
-> ChannelVoiceProfile
-> recipient/campaign context
-> final message draft

### BrandVoiceProfile

Suggested fields:
- voiceProfileId
- brandId
- version
- toneTraits[]
- vocabularyPreferences[]
- prohibitedPhrases[]
- claimRefs[]
- disclosureRules[]
- escalationRules[]
- approvedAt
- evidenceRefs[]

### ChannelVoiceProfile

Suggested fields:
- channel
- version
- formality
- maxLength
- emojiDensity
- pacing
- CTAStyle
- hookStyle
- formatPreferences[]
- prohibitedPatterns[]
- platformPolicyRef
- observedAt

Examples:
TikTok:
- concise
- creator-native
- conversational
- short hooks
- low-friction CTA

Instagram:
- visual/contextual
- polished but conversational

LinkedIn:
- concise professional
- proof/ROI-forward

Email:
- subject-line aware
- slightly more formal
- explicit opt-out/suppression behavior where required

The profile changes expression, not facts, policy, claims, consent, identity, or PersonalityState.

## Creator outreach architecture

Opportunity / Growth discovery
-> CreatorEvidence
-> CreatorFitAssessment
-> CampaignOffer
-> OutreachPlan
-> BrandVoiceProfile + ChannelVoiceProfile
-> MessageDraft
-> Policy / claims / eligibility / suppression checks
-> Action Core exact-current-touch approval
-> official Social/Business Messaging connector
-> DeliveryReceipt
-> ResponseObservation
-> CollaborationState
-> Attribution / affiliate outcomes
-> Growth learning.

## New canonical contract families recommended

### CreatorEvidence
- creatorRef
- platform
- sourceRef
- observedAt
- follower/audience observations
- engagement observations
- category/niche
- product/category affinity
- prior collaboration evidence
- contact eligibility state

### CreatorFitAssessment
Keep evidence read separate from campaign-specific commercial fit.

### OutreachPlan
- campaignId
- creatorRef
- brandId
- channel
- offerRef
- voiceProfileRef
- messageDraftRefs
- nextTouchWindow
- maxTouches
- stopState
- eligibilityEvidenceRefs

### OutreachTouch
- touchId
- creatorRef
- conversationRef
- channel
- exactMessageFingerprint
- dueAt
- approvalReceiptId
- providerMessageId
- deliveryState
- observedAt

Future touches stay drafts until due.

### ConversationState
- creator/customer ref
- provider conversation ref
- current stage
- last inbound/outbound timestamps
- sentiment/classification
- humanTakeoverRequired
- stop/contact preference state
- commercial terms refs

## TikTok Shop role in the Side Hustle stack

TikTok Shop is not only a storefront.

It can become:
1. a product-demand observation source;
2. a sales channel;
3. an affiliate creator distribution channel;
4. a paid-media channel;
5. a creator-collaboration funnel;
6. an attribution source;
7. a creator-generated creative engine.

That makes it a bridge between Commerce, Growth, Social, Director/Creative, Attribution, and Money.

## Recommended roadmap

SH-TTS.1 — TikTok capability map
Map official Shop Affiliate, Business, Messaging, Research, Content and webhook surfaces to Jhadina authorities.

SH-TTS.2 — Creator evidence contract
Add provider-neutral creator evidence and identity refs.

SH-TTS.3 — Creator fit / opportunity intelligence
Evidence-backed audience/product/category fit; no automatic outreach.

SH-TTS.4 — Brand/channel voice profiles
Versioned expression profiles; no PersonalityState mutation.

SH-TTS.5 — Outreach planning contract
Dedup, currently-due-touch semantics, stop/contact-preference states.

SH-TTS.6 — Governed direct-message capability
Add a social message proposal/outbox equivalent to governed publication with exact recipient/message fingerprint and Action Core approval.

SH-TTS.7 — TikTok official connector
Implement official Business Messaging / Shop Affiliate adapter surfaces that the account is actually entitled to use.

SH-TTS.8 — TikTok Shop research / product intelligence
Use supported Shop/Research data to feed Opportunity and Competitive Intelligence.

SH-TTS.9 — Affiliate/creator attribution
Link creator collaboration -> product/content -> orders/revenue/cost/commission -> Money actuals.

SH-TTS.10 — empirical certification
Sandbox/live-provider tests for permissions, rate limits, webhook signatures, duplicate events, message capability, publication, affiliate states, attribution, failures and reconciliation.

## Priority decision

Highest value:
1. TikTok Shop Affiliate + creator evidence
2. governed creator outreach
3. brand/channel voice profiles
4. TikTok Business paid-media connector/reporting
5. official messaging + inbox/human-takeover
6. TikTok Shop product intelligence

Reference only:
- mass cold-message claims
- anti-detection/human-mimic automation
- unverified scraped email/creator databases
- scraper repositories with no inspectable implementation
- duplicate social schedulers/databases.
