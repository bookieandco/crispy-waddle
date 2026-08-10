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
}

extension JhadinaNativePlaybackService: JhadinaPlaybackBackend {}
