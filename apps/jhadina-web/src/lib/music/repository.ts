import { InMemoryMusicRepository } from "@jhadina/music-core";

// Keep the repository instance shared across music API routes in the web process.
// The underlying repository remains user-scoped; production persistence can replace
// this implementation without changing the feed adapter contract.
export const musicRepository = new InMemoryMusicRepository();
