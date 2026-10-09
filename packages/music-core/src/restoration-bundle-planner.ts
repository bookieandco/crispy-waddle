/** DAW export splits large case archives into independently valid, small ZIPs.
 * Never re-encodes WAV/MIDI; oversized single artifacts must be direct-download,
 * not silently truncated or processed inside the Vercel response boundary.
 */
export interface RestorationBundlePart {
  number: number;
  artifactIds: string[];
  sourceBytes: number;
}
export interface RestorationBundlePlan {
  parts: RestorationBundlePart[];
  directArtifacts: Array<{ artifactId: string; sourceBytes: number }>;
  totalSourceBytes: number;
  partByteLimit: number;
}
const DEFAULT_PART_LIMIT = 96 * 1024 * 1024;

export function planRestorationBundleParts(
  tracks: Array<{ artifactId: string }>,
  artifacts: Array<{ id: string; sizeBytes: number }>,
  partByteLimit = DEFAULT_PART_LIMIT,
): RestorationBundlePlan {
  if (!Number.isSafeInteger(partByteLimit) || partByteLimit < 1024 * 1024 ||
      partByteLimit > 200 * 1024 * 1024) {
    throw new Error("MUSIC_BUNDLE_PART_SIZE_LIMIT_INVALID");
  }
  if (tracks.length > 512 || artifacts.length > 512) {
    throw new Error("MUSIC_BUNDLE_TRACK_COUNT_EXCEEDED");
  }
  const lookup = new Map(artifacts.map(a => [a.id, a.sizeBytes]));
  const seen = new Set<string>();
  const parts: RestorationBundlePart[] = [];
  const directArtifacts: RestorationBundlePlan["directArtifacts"] = [];
  let current: RestorationBundlePart = { number: 1, artifactIds: [], sourceBytes: 0 };
  let totalSourceBytes = 0;
  for (const track of tracks) {
    if (!track.artifactId?.trim() || seen.has(track.artifactId)) {
      throw new Error("MUSIC_BUNDLE_ARTIFACT_ID_DUPLICATE_OR_MISSING");
    }
    seen.add(track.artifactId);
    const sizeBytes = lookup.get(track.artifactId);
    if (sizeBytes === undefined || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
      throw new Error("MUSIC_BUNDLE_SOURCE_SIZE_UNVERIFIED");
    }
    totalSourceBytes += sizeBytes;
    if (!Number.isSafeInteger(totalSourceBytes)) throw new Error("MUSIC_BUNDLE_TOTAL_OVERFLOW");
    if (sizeBytes > partByteLimit) {
      directArtifacts.push({ artifactId: track.artifactId, sourceBytes: sizeBytes });
      continue;
    }
    if (current.sourceBytes + sizeBytes > partByteLimit && current.artifactIds.length) {
      parts.push(current);
      current = { number: parts.length + 1, artifactIds: [], sourceBytes: 0 };
    }
    current.sourceBytes += sizeBytes;
    current.artifactIds.push(track.artifactId);
  }
  if (current.artifactIds.length) parts.push(current);
  return { parts, directArtifacts, totalSourceBytes, partByteLimit };
}
