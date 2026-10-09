# TRUCKER-COMMUNITY.01 — Facebook-style Truckers Community foundation

This changes the product contract to a genuine opt-in social network: feed, driver profiles, friend requests/acceptance, posts, place reviews and recommendations, trucker groups, invitation-scoped meetups, blocks, moderation reports, and future Crew-Up.

**Status:** Pure in-memory domain service and regression tests; NOT a deployable social platform.

**Safety:** social starts OFF; discoverability starts OFF; Crew-Up starts OFF. No automatic publication of live location, stop presence, routes, hours of service, financial information, or customer data. Reviews are driver opinions, not verified parking/clearance/amenity facts. Drivers can disable participation, hiding their content from feeds. No public HTTP endpoints until authenticated identity, durable permission-scoped storage, moderation/abuse workflows and rate limits.

**Next build order**
1. COMMUNITY.02 identity/auth per carrier/driver; audit receipts; persistent SQLite-first schema and adapter; no Supabase requirement now.
2. COMMUNITY.03 phone-first feed/profiles/friends/groups UI, media posts, comments, reactions; account settings and delete/export tools.
3. COMMUNITY.04 place-linked reviews with report dates, provenance, fraud checks and FunFinder integration (never upgrade crowdsourcing to verified truck access).
4. COMMUNITY.05 Crew-Up voluntary stop-based lobby, expiring presence, scoped visibility and check-out; verified public stop only; no passive location broadcasting.
5. COMMUNITY.06 opt-in meetups, RSVPs, recommendations and messaging with block, report, anti-spam, restrictions for driving state and privacy controls.
6. COMMUNITY.07 moderation, notifications, community search, production security, accessibility and real-phone tests.
7. COMMUNITY.FINAL staged launch and verified backups/restore, monitoring, abuse/incident response.

No load booking, payments, telematics updates, automatic tracking, or driver-to-driver location sharing in this module.
