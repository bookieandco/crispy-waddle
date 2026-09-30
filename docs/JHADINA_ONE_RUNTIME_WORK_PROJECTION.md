# JHADINA ONE-RUNTIME — aggregate work projection

This forward-port preserves the unique aggregate WorkSession read model from stale PR #713 on current main.

It reports total tasks, automatically progressing tasks, human-attention count, terminal count, counts by status and domain, bounded recent task summaries, and the canonical runtime attention projection.

The projection intentionally excludes task payloads and authority internals from the presentation model.

Cross-domain lineage is not reintroduced here: that functionality already landed through merged PR #718 and remains canonical there.

This module is read-only and grants no execution authority.
