"use client";

import { useEffect, useRef } from "react";
import type { PlaybackState } from "@jhadina/music-core";

interface Props {
  playback: PlaybackState;
  sourceUri?: string;
  onPosition: (positionMs: number) => void;
  onEnded: () => void;
  onStarted?: () => void;
  onError?: () => void;
  onDuration?: (durationMs: number) => void;
}

export function AudioPlaybackBridge({
  playback, sourceUri, onPosition, onEnded, onStarted, onError, onDuration,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUri = useRef<string | undefined>(undefined);
  const lastTrackId = useRef<string | null>(null);
  const lastExternalPosition = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!playback.track || !sourceUri) {
      // Revoked or switched accounts must not retain a signed URL in the DOM.
      audio.pause();
      if (audio.hasAttribute("src")) {
        audio.removeAttribute("src");
        audio.load();
      }
      lastUri.current = undefined;
      lastTrackId.current = null;
      return;
    }

    const sourceChanged = lastUri.current !== sourceUri || lastTrackId.current !== playback.track.id;
    if (sourceChanged) {
      audio.pause();
      audio.src = sourceUri;
      lastUri.current = sourceUri;
      lastTrackId.current = playback.track.id;
      lastExternalPosition.current = playback.positionMs;
      audio.load();
      // Safari may not permit seeking before metadata is available.
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        try { audio.currentTime = playback.positionMs / 1000; } catch { /* retry on loadedmetadata */ }
      }
    }

    const delta = Math.abs(audio.currentTime * 1000 - playback.positionMs);
    if (!sourceChanged && delta > 1500
      && Math.abs(playback.positionMs - lastExternalPosition.current) > 1000) {
      try { audio.currentTime = playback.positionMs / 1000; } catch { /* wait for metadata */ }
    }
    lastExternalPosition.current = playback.positionMs;
    if (playback.playing) void audio.play().catch(() => onError?.());
    else audio.pause();
  }, [playback.track?.id, playback.playing, playback.positionMs, sourceUri]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  return <audio ref={audioRef} preload="metadata"
    onLoadedMetadata={event => {
      const audio = event.currentTarget;
      if (playback.positionMs > 0) {
        try { audio.currentTime = playback.positionMs / 1000; } catch { /* unsupported seek */ }
      }
      if (Number.isFinite(audio.duration)) onDuration?.(audio.duration * 1000);
    }}
    onTimeUpdate={event => onPosition(event.currentTarget.currentTime * 1000)}
    onPlay={onStarted} onError={onError} onEnded={onEnded} className="hidden" />;
}
