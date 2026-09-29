import { HttpRestorationRuntimeClient } from "@jhadina/music-core";

export function createMusicRestorationRuntimeClient(): HttpRestorationRuntimeClient {
  const url = process.env.MUSIC_RESTORATION_WORKER_URL?.trim() ?? "";
  const token = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  if (!url || !token) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  return new HttpRestorationRuntimeClient(url, token);
}
