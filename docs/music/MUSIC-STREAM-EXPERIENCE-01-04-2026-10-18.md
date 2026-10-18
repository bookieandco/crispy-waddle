# MUSIC-STREAM.EXPERIENCE.01–.04 — local pilot experience

Date: 2026-10-18. Source-only until preview exact-head Vercel build is READY.

- Retains IndexedDB database jhadina-local-music-v1/audio from MUSIC-STREAM.QUICKPLAY; no migration deletes owner files.
- Premium, mobile-first Music surface on the private `/music/local` preview: Home, Discover, Search, Your Library, persistent mini-player, Now Playing and queue.
- Functional offline library: import/remove local audio, search parsed file/artist names, liked songs, locally stored playlists, radio stations, repeat, shuffle, seek, recent listening and skip controls. Generated gradients are placeholder art, never presented as original album artwork.
- Explicit separation of locally playable rights from planned authenticated Spotify and YouTube Music *metadata* integration, authorized licensed playback, and Pandora-style external discovery. A local Pandora-like station is not Pandora API access.
- Device selected files never upload to Supabase, YouTube, Spotify or Vercel. Preferences stored on this browser only; Safari may clear data. Keep originals backed up.
- `/music/local` remains the only SWLC auth-middleware exception and only on Vercel preview. Vercel Authentication protects preview. No production route/API authorization bypass or cross-tenant RLS changes.
- Do not merge or release before exact-head CI and owner iPhone acceptance. Native AirPlay, CarPlay, metadata parsing, actual artwork, cross-device sync, background audio and original-provider streaming are not certified.

## Owner testing
1. Open exact private preview `/music/local` on iPhone.
2. Confirm polished 4-tab home, no Jhadina global nav overlay.
3. Confirm old QuickPlay songs remain, add several MP3/M4A files, reload and check persistence.
4. Play/Pause/Seek/Next/Previous, Queue, shuffle/repeat, Like, create a playlist, add to playlist, stations, recently played.
5. Check Control Center / AirPlay / Bluetooth manually, lockscreen/background, Safari eviction/reload, and any incompatible formats.

No commercial stream, billing, playlist provider import, prod migration, external playback, or public release authorized.
