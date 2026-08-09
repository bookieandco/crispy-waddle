"use client";

import { useEffect, useRef } from "react";
import type { PlaybackState } from "@jhadina/music-core";

export function AudioPlaybackBridge({ playback, sourceUri, onPosition, onEnded }: { playback: PlaybackState; sourceUri?: string; onPosition: (positionMs: number) => void; onEnded: () => void; }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUri = useRef<string | undefined>(undefined);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sourceUri && sourceUri !== lastUri.current) {
      audio.src = sourceUri;
      audio.currentTime = playback.positionMs / 1000;
      lastUri.current = sourceUri;
    }
    if (!playback.track || !sourceUri) { audio.pause(); return; }
    if (playback.playing) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [playback.track?.id, playback.playing, playback.positionMs, sourceUri]);

  return <audio ref={audioRef} preload="metadata" onTimeUpdate={(event) => onPosition(event.currentTarget.currentTime * 1000)} onEnded={onEnded} className="hidden" />;
}
