import type { Track } from "./types.js";
import type { PlaybackState } from "./player.js";
import type { AudioOutputDevice, MusicAudioOutput } from "./audio-output.js";
import type { CatalogItem } from "./catalog-search.js";
import type { CatalogHydrator } from "./catalog-hydration.js";
import { searchCatalog, type CatalogSearchProvider, type CatalogSearchResult } from "./catalog-search.js";
import { hydrateCatalogItemToQueue } from "./catalog-hydration-queue.js";
import { playCatalogItem } from "./catalog-playback.js";
import type { JhadinaMusicPlaybackAdapter } from "./jhadina-music-playback-adapter.js";
import { OfflineDownloadManager, type OfflineDownloadState } from "./offline-downloads.js";

export type MusicTrack = Track;

export interface MusicCore {
  search(query: string): Promise<MusicTrack[]>;
  play(track: MusicTrack): Promise<PlaybackState>;
  pause(): Promise<PlaybackState>;
  resume(): Promise<PlaybackState>;
  next(): Promise<PlaybackState>;
  previous(): Promise<PlaybackState>;
  getPlaybackState(): Promise<PlaybackState>;
}

export type MusicAction =
  | { type: "music.search"; query: string }
  | { type: "music.play"; track: MusicTrack }
  | { type: "music.play-catalog"; item: Extract<CatalogItem, { kind: "track" }> }
  | { type: "music.queue-catalog"; item: CatalogItem; sourceId: string; replace?: boolean }
  | { type: "music.offline-status"; userId: string; track: MusicTrack }
  | { type: "music.pause" }
  | { type: "music.resume" }
  | { type: "music.next" }
  | { type: "music.previous" }
  | { type: "music.status" }
  | { type: "music.outputs" }
  | { type: "music.select-output"; outputId: string };

export type MusicActionResult = {
  results?: MusicTrack[] | CatalogSearchResult[];
  playback?: PlaybackState;
  outputs?: AudioOutputDevice[];
  output?: AudioOutputDevice;
  queue?: Track[];
  offline?: OfflineDownloadState | null;
};

export interface JhadinaMusicCatalogOptions {
  searchProviders?: CatalogSearchProvider[];
  hydrators?: CatalogHydrator[];
}

export class JhadinaMusicCapability {
  constructor(
    private readonly music: MusicCore,
    private readonly audioOutput?: MusicAudioOutput,
    private readonly playbackAdapter?: JhadinaMusicPlaybackAdapter,
    private readonly downloadManager?: OfflineDownloadManager,
    private readonly catalog: JhadinaMusicCatalogOptions = {},
  ) {}

  async execute(action: MusicAction): Promise<MusicActionResult> {
    switch (action.type) {
      case "music.search":
        return { results: await searchCatalog(action.query, this.catalog.searchProviders ?? [], await this.music.search(action.query)) };
      case "music.play": return { playback: await this.music.play(action.track) };
      case "music.play-catalog":
        if (!this.playbackAdapter) throw new Error("Music playback bridge unavailable");
        await playCatalogItem(action.item, this.playbackAdapter);
        return { playback: await this.music.getPlaybackState() };
      case "music.queue-catalog": {
        if (!this.playbackAdapter) throw new Error("Music playback bridge unavailable");
        if (!this.catalog.hydrators?.length) throw new Error("Music catalog hydrator unavailable");
        const state = await hydrateCatalogItemToQueue(this.playbackAdapter.getState(), action.item, action.sourceId, this.catalog.hydrators, action.replace);
        this.playbackAdapter.setState(state);
        return { queue: state.queue, playback: await this.music.getPlaybackState() };
      }
      case "music.offline-status":
        if (!this.downloadManager) throw new Error("Offline download manager unavailable");
        return { offline: await this.downloadManager.getState(action.userId, action.track) };
      case "music.pause": return { playback: await this.music.pause() };
      case "music.resume": return { playback: await this.music.resume() };
      case "music.next": return { playback: await this.music.next() };
      case "music.previous": return { playback: await this.music.previous() };
      case "music.status": return { playback: await this.music.getPlaybackState() };
      case "music.outputs":
        if (!this.audioOutput) throw new Error("Audio output bridge unavailable");
        return { outputs: await this.audioOutput.devices() };
      case "music.select-output":
        if (!this.audioOutput) throw new Error("Audio output bridge unavailable");
        return { output: await this.audioOutput.select(action.outputId) };
    }
  }
}
