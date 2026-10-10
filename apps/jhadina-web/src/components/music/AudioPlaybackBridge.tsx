"use client";

import { useEffect, useRef } from "react";
import type { PlaybackState } from "@jhadina/music-core";

export function AudioPlaybackBridge({ playback, sourceUri, onPosition, onEnded, onStarted, onError, onDuration }: { playback: PlaybackState; sourceUri?: string; onPosition: (positionMs: number) => void; onEnded: () => void; onStarted?: () => void; onError?: () => void; onDuration?: (durationMs: number) => void; }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUri = useRef<string | undefined>(undefined);
  const lastExternalPosition = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sourceUri && sourceUri !== lastUri.current) {
      audio.src = sourceUri;
      audio.currentTime = playback.positionMs / 1000;
      lastUri.current = sourceUri;
      lastExternalPosition.current = playback.positionMs;
    }
    if (!playback.track || !sourceUri) { audio.pause(); return; }
    const delta = Math.abs(audio.currentTime * 1000 - playback.positionMs);
    if (delta > 1500 && Math.abs(playback.positionMs - lastExternalPosition.current) > 1000) audio.currentTime = playback.positionMs / 1000;
    lastExternalPosition.current = playback.positionMs;
    if (playback.playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [playback.track?.id, playback.playing, playback.positionMs, sourceUri]);

  return <audio ref={audioRef} preload="metadata" onLoadedMetadata={(event) => Number.isFinite(event.currentTarget.duration) && onDuration?.(event.currentTarget.duration * 1000)} onTimeUpdate={(event) => onPosition(event.currentTarget.currentTime * 1000)} onPlay={onStarted} onError={onError} onEnded={onEnded} className="hidden" />;
}
