import Foundation

public struct StudioLipSyncJob: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let clipId: String
    public let characterId: String
    public let audioURL: URL
    public let startSeconds: Double
    public let durationSeconds: Double
}

public final class StudioLipSyncTimelineBridge {
    public init() {}

    public func jobs(from timeline: StudioAudioTimeline) -> [StudioLipSyncJob] {
        timeline.tracks.filter { $0.kind == .dialogue }.flatMap { track in
            track.clips.compactMap { clip in
                guard let characterId = clip.characterId else { return nil }
                return StudioLipSyncJob(id: UUID().uuidString, clipId: clip.id, characterId: characterId, audioURL: clip.assetURL, startSeconds: clip.startSeconds, durationSeconds: clip.durationSeconds)
            }
        }
    }
}
