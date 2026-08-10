import Foundation

/// Stable playback contract used by Music Core and the synchronization layer.
/// Concrete media engines (AVPlayer today, FFmpeg-capable backend later) stay
/// behind this boundary so policy and QC do not depend on a specific engine.
@MainActor
public protocol JhadinaPlaybackBackend: AnyObject {
    var state: JhadinaNativePlaybackService.State { get }
    var currentTime: TimeInterval { get }
    var rate: Float { get }

    func load(url: URL) throws
    func play()
    func pause()
    func seek(to seconds: TimeInterval) async
    func stop()
    func applyCorrection(_ plan: JhadinaCorrectionPlan) -> Bool
    func recoverCorrection()
    func snapshot() -> JhadinaNativePlaybackService.Snapshot
    func playbackClockSnapshot() -> JhadinaPlaybackClockSnapshot
}

public struct JhadinaPlaybackClockSnapshot: Sendable {
    public let mediaTime: TimeInterval
    public let hostTime: UInt64?
    public let rate: Double
    public let isPlaying: Bool
    public let epochID: UUID

    public init(
        mediaTime: TimeInterval,
        hostTime: UInt64? = nil,
        rate: Double,
        isPlaying: Bool,
        epochID: UUID
    ) {
        self.mediaTime = mediaTime
        self.hostTime = hostTime
        self.rate = rate
        self.isPlaying = isPlaying
        self.epochID = epochID
    }
}

extension JhadinaNativePlaybackService: JhadinaPlaybackBackend {
    public func playbackClockSnapshot() -> JhadinaPlaybackClockSnapshot {
        let snapshot = snapshot()
        return JhadinaPlaybackClockSnapshot(
            mediaTime: snapshot.playerTime,
            rate: Double(snapshot.rate),
            isPlaying: snapshot.state == .playing,
            epochID: UUID()
        )
    }
}
