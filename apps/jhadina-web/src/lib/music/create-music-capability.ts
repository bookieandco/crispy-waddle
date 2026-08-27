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

/**
 * Browser-only composition root for the listening surface.
 * Identity is obtained once from Supabase Auth and passed explicitly through
 * every user-scoped Music Core boundary; the UI never supplies a user id.
 */
export async function createMusicCapability(): Promise<JhadinaMusicCapability | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const repository = new SupabaseMusicRepository(createClient());
  const resolver = new SupabaseSourceAssetResolver(userId);
  let adapter: JhadinaMusicPlaybackAdapter;

  const host = new BrowserPlaybackHost({
    onEnded: async () => {
      await adapter.next();
    },
  });

  adapter = new JhadinaMusicPlaybackAdapter(userId, {
    resolve: (source, track) => resolver.resolve(source, track),
  }, host);

  const music: MusicCore = {
    async search(query: string): Promise<MusicTrack[]> {
      const normalized = query.trim().toLocaleLowerCase();
      if (!normalized) return [];
      const tracks = await repository.listTracks(userId);
      return tracks.filter((track) => {
        const title = track.title.toLocaleLowerCase();
        return title.includes(normalized) || track.artistIds.some((id) => id.toLocaleLowerCase().includes(normalized));
      });
    },
    async play(track: MusicTrack): Promise<PlaybackState> {
      await adapter.play(track);
      return adapter.getState();
    },
    async pause(): Promise<PlaybackState> {
      await adapter.pause();
      return adapter.getState();
    },
    async resume(): Promise<PlaybackState> {
      await adapter.play();
      return adapter.getState();
    },
    async next(): Promise<PlaybackState> {
      await adapter.next();
      return adapter.getState();
    },
    async previous(): Promise<PlaybackState> {
      await adapter.previous();
      return adapter.getState();
    },
    async getPlaybackState(): Promise<PlaybackState> {
      return adapter.getState();
    },
  };

  return new JhadinaMusicCapability(music, undefined, adapter);
}
