import Foundation

public struct StudioAudioTimelineIssue: Sendable, Equatable {
    public let severity: String
    public let message: String
    public let clipId: String?
}

public final class StudioAudioTimelineValidator {
    public init() {}

    public func validate(_ timeline: StudioAudioTimeline) -> [StudioAudioTimelineIssue] {
        var issues: [StudioAudioTimelineIssue] = []
        guard timeline.sampleRateHz > 0 else {
            issues.append(.init(severity: "error", message: "Audio timeline sample rate must be positive.", clipId: nil))
            return issues
        }
        for track in timeline.tracks {
            for clip in track.clips {
                if clip.startSeconds < 0 || clip.durationSeconds <= 0 {
                    issues.append(.init(severity: "error", message: "Audio clip has invalid timing.", clipId: clip.id))
                }
                if clip.kindIsDialogue(track.kind) && clip.characterId == nil {
                    issues.append(.init(severity: "review", message: "Dialogue clip has no character assignment; lip sync cannot be targeted.", clipId: clip.id))
                }
            }
        }
        return issues
    }
}

private extension StudioAudioClip {
    func kindIsDialogue(_ kind: StudioAudioTrackKind) -> Bool { kind == .dialogue }
}
