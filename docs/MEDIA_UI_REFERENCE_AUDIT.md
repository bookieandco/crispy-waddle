# Media UI reference audit

## Amazon Vega Sports App
Reference: AmazonAppDev/vega-sports-app (MIT-0).
Use as a pattern source for TV-optimized focus/navigation, theming, catalog/service composition, and player lifecycle. Do not copy its provider or rights assumptions over JhadinaTV's authorization chain.

## VS Live Flutter
Reference: mixin27/vs-live-flutter (no repository license detected during audit).
Use only as a behavioral/UX reference for live-event cards, score/highlight state, notifications, and mobile sports presentation. Do not copy source code or introduce Flutter solely for this reference.

## Ownership boundary
Sports Core owns sports event/score/intelligence state. JhadinaTV owns authorized media discovery/playback. Entertainment continuity owns resume/device handoff. UI shells consume these ports and do not grant media rights.
