# ASK-SOCIAL.1 — Ask Jhadina Social Intelligence Integration

Date: 2026-09-22

## Goal

Make Social/Growth/Director capabilities available from Ask Jhadina without turning the LLM into an execution authority.

Users can type requests such as:

- "Show me the social character personalities I can use."
- "Which social accounts should I work on right now?"
- "Use the Atwood Bookie personality on Instagram and TikTok."
- "Research Meta ad concepts for PupsonStuff on Instagram."
- "Make a TikTok video for PupsonStuff using the PupsonStuff personality."
- "Analyze performance on my LinkedIn account."
- "Prepare a paid Meta campaign for PupsonStuff."

## Identity separation

Two different personality concepts remain separate:

1. **Jhadina PersonalityState**
   - learned from governed patterns/memory;
   - controls how Jhadina interacts with the user;
   - cannot be directly mutated by an LLM.

2. **SocialCharacterProfile**
   - explicit public-facing brand/character expression profile;
   - controls brand voice/tone/point-of-view for social content;
   - authority is always `EXPRESSION_ONLY`;
   - never grants account, publishing, outreach, identity, or spend authority.

## Main intelligence context

`ContextPacket.domainContext.social` is now a read-only contribution containing:

- authenticated connected accounts;
- available Social character profiles;
- pending publication/delivery work;
- recent performance observations;
- deterministic operational-attention evidence;
- uncertainty/limitations/provenance.

The production provider only reads Social state when the active Ask task is Social/marketing relevant.

## Natural-language routing

Ask Jhadina resolves Social commands before the generic Director video shortcut.

Example:

```
"Make a TikTok video for PupsonStuff"
-> detect Social creative intent
-> resolve PupsonStuff brand/character
-> resolve real connected TikTok account(s)
-> produce Social work plan
-> next boundary = Director
```

A generic request such as:

```
"Make a cinematic video about a lighthouse"
```

continues to use the existing Director shortcut.

Unknown handles, missing accounts, and ambiguous character names fail closed and return real connected alternatives instead of invented IDs.

## Account attention

"Which social accounts should I work on?" ranks connected accounts using operational evidence only:

- failed/ambiguous delivery jobs;
- pending publication approvals;
- missing performance observations;
- stale performance observations.

The score is an attention queue, not a claim about causal growth opportunity.

## Character lineage

Selected characters can be persisted on `ContentProject` as:

- `characterProfileRef`
- `voiceProfileRef`

Those refs are carried into Director production intent and remain expression constraints only.

Brand mismatch is rejected. For example, an Atwood Bookie character cannot be attached to a PupsonStuff ContentProject.

## Authority boundaries

```
Ask Jhadina
-> READ_ONLY / PLANNING_ONLY Social work plan
-> Growth research OR Director production OR Social publication OR paid media
-> existing subsystem policy/approval/action boundary
```

Never:

```
Ask text
-> direct publish
Ask text
-> direct ad spend
character selection
-> account authority
character selection
-> Jhadina PersonalityState mutation
```

Publishing still requires `public.publish`.
Paid campaigns still require `paid-ad.publish`.
Director still owns generation/QC/review authority.
