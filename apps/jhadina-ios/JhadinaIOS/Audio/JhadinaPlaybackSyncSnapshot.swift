import Foundation

/// Clock/QC input captured away from the audio render path.
public struct JhadinaPlaybackSyncSnapshot: Sendable, Equatable {
    public let epochID: UUID
    public let capturedAt: Date
    public let playerTime: TimeInterval
    public let audioHostTime: UInt64
    public let audioSampleTime: Int64
    public let sampleRate: Double
    public let outputLatency: TimeInterval
    public let route: String

    public init(
        epochID: UUID,
        capturedAt: Date = Date(),
        playerTime: TimeInterval,
        audioHostTime: UInt64,
        audioSampleTime: Int64,
        sampleRate: Double,
        outputLatency: TimeInterval,
        route: String
    ) {
        self.epochID = epochID
        self.capturedAt = capturedAt
        self.playerTime = playerTime
        self.audioHostTime = audioHostTime
        self.audioSampleTime = audioSampleTime
        self.sampleRate = sampleRate
        self.outputLatency = outputLatency
        self.route = route
    }
}
