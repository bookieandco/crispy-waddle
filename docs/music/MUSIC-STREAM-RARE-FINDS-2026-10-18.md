# MUSIC-STREAM.RARE-FINDS.01–.04 — owner-only, official player

Provenance: `spotDL/spotify-downloader` (MIT, reference architecture for owner-audio metadata, non-downloading), `maxrave-dev/SimpMusic` (GPL-3.0, conceptual UX/reference only, **no source transplanted**).

## Added
- YouTube and YouTube Music **video links** can be pasted into a local Rare Finds collection with owner-chosen song/artist labels.
- Strict hostname/scheme/ID parser, spoofed URL rejection, no iframe URL formed from unvalidated data, regression tests.
- LocalStorage saved bookmark IDs only. Display the original YouTube video in a **visible** 16:9 standard iframe when YouTube permits embedding; never auto-start, extract, transcode, download, or cache media. Clearly identify provenance and offer original YouTube link.
- Listen coordination: opening the embedded video pauses Jhadina's local audio; starting Jhadina audio unmounts the YouTube iframe. No hidden or background YouTube playback.
- The original MP3/M4A owner-file system and production audio/RLS remain untouched. Existing private preview route `/music/local` is the only SWLC exception.

## Boundaries
- YouTube API developer rules prohibit audio separation, API-based downloader and invisible/background players. iframe availability, ads and restrictions are controlled by YouTube. This adds private bookmarks, **not** rights to audio copies. spotDL binary downloader and SimpMusic hidden/unofficial streaming APIs are **not** imported.
- Personal uploads to YouTube Music are private to the uploader, not distributable by adding to a playlist. Official manual upload is supported on a computer via music.youtube.com. Public access to owned original recordings requires distribution or channel publishing with applicable rights, and separate operator approval.
- No Spotify OAuth, provider cookies, Supabase migrations, posting, account access, spending or production release.

## Next steps (separate explicit permission)
1. Owner tests iPhone adding a YouTube Music watch URL, reload, tap Play, close, local audio focus, open in YouTube.
2. Add separately authorized YouTube playlist lookup/search via Data API only after OAuth/quota/terms review; source-bound metadata and explicit missing track status.
3. Add local-file metadata tagging / import from owned authorized downloads using spotDL-inspired matching, not its YouTube media downloader.
4. Deeper provider account sync needs real supported API access, no unofficial scraper dependency.
