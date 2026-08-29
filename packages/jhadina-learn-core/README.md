# @jhadina/learn-core

Explicit user-directed learning for Jhadina.

## Input

`Jhadina Learn` accepts an optional natural-language instruction plus zero or more sources:

- text
- files (represented by a file reference and optional MIME type)
- videos (represented by a URL or media reference)
- hyperlinks / URLs

Sources are intentionally represented as references at this boundary. Fetching, parsing, transcription, OCR, embedding, and model-specific extraction belong to downstream ingestion adapters.

## Governance

Explicit teaching has `authority: "user"`, but starts as `proposed`. Applying behavioral or operational changes remains governed by Jhadina Evolution Core and existing policy/value boundaries.

This package does not let an LLM directly mutate Jhadina behavior.
