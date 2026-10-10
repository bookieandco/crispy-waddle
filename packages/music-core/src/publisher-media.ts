import type { MusicRepository } from "./repository.js";
import type { MediaAsset, MusicSource, Track } from "./types.js";
import { validatePlaybackAsset } from "./playback-ticket.js";

/** Radio/podcast entries require separately reviewed permission to play publisher streams. */
export type PublisherMediaKind = "internet_radio" | "podcast_episode";
export interface PublisherMediaAdmission {
  kind: PublisherMediaKind;
  publisherId: string;
  itemId: string;
  title: string;
  creator: string;
  streamUri: string;
  durationMs?: number;
  expiresAt?: string;
  /** References an independently reviewed grant, stream publisher terms, or ownership receipt. */
  rightsEvidenceRef: string;
  rightsReviewedBy: string;
  rightsReviewedAt: string;
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;
function validateAdmission(manifest: PublisherMediaAdmission) {
  if (!ID.test(manifest.publisherId) || !ID.test(manifest.itemId)
    || !manifest.title?.trim() || manifest.title.length > 250
    || !manifest.creator?.trim() || manifest.creator.length > 200
    || !manifest.rightsEvidenceRef?.trim() || manifest.rightsEvidenceRef.length > 500
    || !manifest.rightsReviewedBy?.trim()
    || !Number.isFinite(Date.parse(manifest.rightsReviewedAt))
    || (manifest.durationMs !== undefined && (!Number.isInteger(manifest.durationMs) || manifest.durationMs < 0))) {
    throw new Error("Publisher media lacks complete reviewed metadata and rights provenance");
  }
}
/**
 * Operator-side admission, not an anonymous URL-submission endpoint.
 * Nothing fetches or copies publisher bytes. A verified grant is a deployment prerequisite.
 */
export async function admitPublisherMedia(
  repo: MusicRepository, userId: string, manifest: PublisherMediaAdmission,
) {
  validateAdmission(manifest);
  if (!userId) throw new Error("Authenticated owner identity required");
  const mediaId = manifest.kind === "internet_radio"
    ? `radio:${manifest.publisherId}:${manifest.itemId}`
    : `podcast:${manifest.publisherId}:${manifest.itemId}`;
  const sourceId = `publisher:${manifest.kind}:${manifest.publisherId}`;
  const source: MusicSource = {
    id: sourceId, userId, kind: "authorized_service", name: manifest.creator, authorized: true,
    metadata: {
      role: "publisher-direct-media", mediaKind: manifest.kind,
      rightsEvidenceRef: manifest.rightsEvidenceRef, rightsReviewedBy: manifest.rightsReviewedBy,
      rightsReviewedAt: manifest.rightsReviewedAt,
    },
  };
  const track: Track = {
    id: mediaId, title: manifest.title, artistIds: [],
    ...(manifest.durationMs === undefined ? {} : { durationMs: manifest.durationMs }),
  };
  const asset: MediaAsset = {
    id: `published:${mediaId}`, trackId: mediaId, sourceId, kind: "stream",
    uri: manifest.streamUri,
    provenance: {
      playbackAuthorized: true, rightsEvidenceRef: manifest.rightsEvidenceRef,
      rightsReviewedBy: manifest.rightsReviewedBy,
      ...(manifest.expiresAt ? { expiresAt: manifest.expiresAt } : {}),
    },
  };
  // Validate stream scheme, endpoint, and expiry before ANY record is admitted.
  if (!validatePlaybackAsset(userId, mediaId, [source], asset)) {
    throw new Error("Publisher media has an unsafe, expiring, or unauthorized playback URI");
  }
  await repo.upsertSource(source);
  await repo.upsertTrack(userId, track);
  await repo.addAsset(userId, asset);
  return { track, source };
}
