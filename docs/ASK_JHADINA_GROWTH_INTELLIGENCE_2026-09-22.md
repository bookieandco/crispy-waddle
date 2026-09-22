# ASK-GROWTH.1 — Ask Jhadina Growth Intelligence

Date: 2026-09-22

## Objective

Connect durable Growth state to Jhadina's main intelligence so the user can ask natural-language questions about campaigns, audiences, pending approvals, provider performance, and operational attention without opening Growth first.

Examples:

- "Show me my Meta campaigns."
- "Which paid campaigns need attention?"
- "What is awaiting paid ad approval?"
- "Show me PupsonStuff audiences."
- "How are the campaigns performing?"
- "Give me a Growth overview."

## Main-intelligence context

`ContextPacket.domainContext.growth` is a provider-neutral read-only contribution containing:

- paid campaign summaries;
- audience inventory summaries;
- pending approval/outbox/lifecycle work;
- provider performance observations;
- deterministic campaign-attention evidence;
- uncertainty, limitations, and provenance.

The provider runs only when the active task is Growth/paid-media relevant.

## Privacy boundary

Ask Jhadina does not receive raw audience definitions, audience membership rows, customer IDs, customer keys, or raw customer-event history by default.

The general intelligence context receives only the minimum operational summaries necessary to answer Growth-state questions.

## Read routing

Read-only Growth questions are resolved before Social planning:

```
Ask Jhadina
-> Growth read intent?
   -> yes: authenticated durable Growth read
   -> no: Social/Director/general intelligence routing continues
```

Examples that are Growth reads:

```
Show me Meta campaigns
Which campaigns need attention?
What is awaiting paid ad approval?
Show me the current audiences
```

Examples intentionally not intercepted by the reader:

```
Launch a Meta campaign
Increase the campaign budget
Approve the pending ad
Which campaign should I run next?
Recommend a campaign strategy
```

Those continue to the governed planning/action path.

## Brand and channel scope

The reader narrows results when the user names a known brand or paid channel.

Examples:

```
Show me PupsonStuff campaigns
Show me Meta campaigns
Show me PupsonStuff Meta campaigns
```

No match returns uncertainty; the reader does not silently broaden the scope.

## Authority invariant

Growth intelligence is `READ_ONLY`.

It never:

- creates or modifies a campaign;
- changes a budget;
- approves or consumes a `paid-ad.publish` receipt;
- sends lifecycle actions;
- mutates audiences;
- publishes content;
- invokes a paid-media provider.

Consequential actions remain behind the existing Growth/Security/Action approval boundary.

## Attention queue

Campaign attention is based on operational evidence such as:

- failed or ambiguous campaign state;
- provider error;
- failed/ambiguous paid outbox jobs;
- in-flight provider dispatch;
- pending explicit paid-ad approval;
- missing/stale performance observations.

The score is an operational work queue, not a prediction of campaign ROI.

## Relationship to ASK-SOCIAL.1

ASK-SOCIAL.1 handles:

- connected Social accounts;
- Social character personalities;
- Social publication state;
- Social performance;
- Social -> Growth -> Director planning.

ASK-GROWTH.1 handles durable Growth state and read-only paid-media intelligence.

Together:

```
Ask Jhadina
-> Social accounts / characters
-> Growth campaigns / audiences / paid performance
-> Director creative production
-> existing governed action boundaries
```
