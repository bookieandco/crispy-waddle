import Foundation
import AVFoundation

public struct StudioAVSyncReport: Sendable, Equatable {
    public let status: String
    public let audioDurationSeconds: Double
    public let videoDurationSeconds: Double
    public let durationDeltaMilliseconds: Double
    public let firstVideoPTSSeconds: Double
    public let lastVideoPTSSeconds: Double
    public let firstAudioPTSSeconds: Double
    public let lastAudioPTSSeconds: Double
    public let startDeltaMilliseconds: Double
    public let endDeltaMilliseconds: Double
    public let warnings: [String]
}

public struct StudioAVSyncThresholds: Sendable {
    public let durationDeltaMilliseconds: Double
    public let startDeltaMilliseconds: Double
    public let endDeltaMilliseconds: Double

    public init(durationDeltaMilliseconds: Double = 20, startDeltaMilliseconds: Double = 20, endDeltaMilliseconds: Double = 40) {
        self.durationDeltaMilliseconds = durationDeltaMilliseconds
        self.startDeltaMilliseconds = startDeltaMilliseconds
        self.endDeltaMilliseconds = endDeltaMilliseconds
    }
}

public final class StudioAVSyncQC {
    private let thresholds: StudioAVSyncThresholds

    public init(thresholds: StudioAVSyncThresholds = .init()) {
        self.thresholds = thresholds
    }

    public func inspect(url: URL) async throws -> StudioAVSyncReport {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)

        guard let video = videoTracks.first else {
            return .init(status: "blocked", audioDurationSeconds: 0, videoDurationSeconds: duration.seconds, durationDeltaMilliseconds: 0, firstVideoPTSSeconds: 0, lastVideoPTSSeconds: 0, firstAudioPTSSeconds: 0, lastAudioPTSSeconds: 0, startDeltaMilliseconds: 0, endDeltaMilliseconds: 0, warnings: ["No video track."])
        }
        guard let audio = audioTracks.first else {
            return .init(status: "review", audioDurationSeconds: 0, videoDurationSeconds: duration.seconds, durationDeltaMilliseconds: 0, firstVideoPTSSeconds: 0, lastVideoPTSSeconds: 0, firstAudioPTSSeconds: 0, lastAudioPTSSeconds: 0, startDeltaMilliseconds: 0, endDeltaMilliseconds: 0, warnings: ["No audio track; synchronization cannot be fully verified."])
        }

        let videoDuration = try await video.load(.timeRange).duration.seconds
        let audioDuration = try await audio.load(.timeRange).duration.seconds
        let delta = abs(videoDuration - audioDuration) * 1000

        let videoStart = try await video.load(.timeRange).start.seconds
        let audioStart = try await audio.load(.timeRange).start.seconds
        let videoEnd = videoStart + videoDuration
        let audioEnd = audioStart + audioDuration
        let startDelta = abs(videoStart - audioStart) * 1000
        let endDelta = abs(videoEnd - audioEnd) * 1000

        var warnings: [String] = []
        if delta > thresholds.durationDeltaMilliseconds { warnings.append("Audio/video duration delta exceeds threshold.") }
        if startDelta > thresholds.startDeltaMilliseconds { warnings.append("Audio/video start timestamp delta exceeds threshold.") }
        if endDelta > thresholds.endDeltaMilliseconds { warnings.append("Audio/video end timestamp delta exceeds threshold.") }

        return .init(
            status: warnings.isEmpty ? "pass" : "fail",
            audioDurationSeconds: audioDuration,
            videoDurationSeconds: videoDuration,
            durationDeltaMilliseconds: delta,
            firstVideoPTSSeconds: videoStart,
            lastVideoPTSSeconds: videoEnd,
            firstAudioPTSSeconds: audioStart,
            lastAudioPTSSeconds: audioEnd,
            startDeltaMilliseconds: startDelta,
            endDeltaMilliseconds: endDelta,
            warnings: warnings
        )
    }
}
