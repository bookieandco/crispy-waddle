# @jhadina/music-core

Initial Music Core domain layer for JhadinaMusic/JhadinaTunes.

## Scope

- normalized artists, albums, tracks and playlists
- user-scoped music sources and media assets
- artwork and lyrics records
- listening events
- import job model
- repository boundary with an in-memory adapter
- deterministic track-to-asset matching

## Integration boundary

Music Core deliberately does not call Spotify, YouTube, streaming services, downloaders, or LLMs. Provider integrations will implement source adapters above this package and persist normalized records through `MusicRepository`.

The repository is user-scoped to preserve Jhadina's existing data-isolation rule.
