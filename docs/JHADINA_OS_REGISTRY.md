# Jhadina OS Registry

The Integration Spine is the canonical registration point for domain implementations. Registration is deliberately separate from implementation so feature branches and external providers can be tracked without pretending they are already merged into `main`.

## Current registry

| Domain | Implementation | Status | Source |
|---|---|---|---|
| MusicOS | `@jhadina/music-core` | active | `packages/music-core` |
| DirectorOS | `@jhadina/shotlist-core` | external-branch | `feat/jhadina-shotlist-director-integration` / PR #8 |
| Commerce | PupsonStuff | external-branch | `pupsonstuff-import` / PR #9 |
| CampaignOS | Campaign domain contract | ready-to-wire | domain registration |
| OverageOS | Overage domain contract | ready-to-wire | domain registration |
| TVOS | TV domain contract | ready-to-wire | domain registration |
| PodcastOS | Podcast domain contract | ready-to-wire | domain registration |
| Creator Workstation | Workstation domain contract | ready-to-wire | domain registration |

## Rule

`active` means the implementation exists on the branch being built and can be attached to an `ActionHandler`.

`external-branch` means the implementation exists, but its source is an unmerged feature branch/PR. The registry records it without silently copying or merging that implementation.

`ready-to-wire` means the domain contract is registered and its capabilities are known, but a concrete implementation has not yet been found on `main`.

This prevents the Integration Spine from claiming that unfinished OS implementations are already production-connected.
