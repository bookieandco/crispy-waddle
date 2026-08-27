"use client";

import {
  BrowserPlaybackHost,
  JhadinaMusicCapability,
  JhadinaMusicPlaybackAdapter,
  type MusicCore,
  type MusicTrack,
  type PlaybackState,
} from "@jhadina/music-core";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/client";
import { SupabaseMusicRepository } from "./supabase-music-repository";
import { SupabaseSourceAssetResolver } from "./supabase-source-asset-resolver";

/** Browser-only composition root. Identity is obtained from Supabase Auth. */
export async function createMusicCapability(
  onPlaybackState?: (state: PlaybackState) => void,
): Promise<JhadinaMusicCapability | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const repository = new SupabaseMusicRepository(createClient());
  const resolver = new SupabaseSourceAssetResolver(userId);
  let adapter: JhadinaMusicPlaybackAdapter;

  const host = new BrowserPlaybackHost({
    onEnded: async () => {
      await adapter.next();
      onPlaybackState?.(adapter.getState());
    },
    onStateChange: () => onPlaybackState?.(adapter.getState()),
  });

  adapter = new JhadinaMusicPlaybackAdapter(
    userId,
    { resolve: (source, track) => resolver.resolve(source, track) },
    host,
  );

  const music: MusicCore = {
    async search(query: string): Promise<MusicTrack[]> {
      const normalized = query.trim().toLocaleLowerCase();
      if (!normalized) return [];
      const tracks = await repository.listTracks(userId);
      return tracks.filter((track) =>
        track.title.toLocaleLowerCase().includes(normalized) ||
        track.artistIds.some((id) => id.toLocaleLowerCase().includes(normalized)),
      );
    },
    async play(track) { await adapter.play(track); return adapter.getState(); },
    async pause() { await adapter.pause(); return adapter.getState(); },
    async resume() { await adapter.play(); return adapter.getState(); },
    async next() { await adapter.next(); return adapter.getState(); },
    async previous() { await adapter.previous(); return adapter.getState(); },
    async getPlaybackState() { return adapter.getState(); },
  };

  return new JhadinaMusicCapability(music, undefined, adapter);
}
