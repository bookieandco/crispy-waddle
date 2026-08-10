import AVFoundation
import Foundation

/// Reads the render clock exposed by AVAudioEngine without touching the audio
/// render callback. The synchronizer can use this as the audio-side clock
/// alongside AVPlayer.currentTime().
public final class JhadinaAudioClockProvider {
    private let engine: AVAudioEngine

    public init(engine: AVAudioEngine) {
        self.engine = engine
    }

    public func snapshot() -> JhadinaAudioClockSnapshot? {
        guard let renderTime = engine.outputNode.lastRenderTime else {
            return nil
        }

        let sampleTime = renderTime.sampleTime
        let hostTime = renderTime.hostTime
        let sampleRate = renderTime.sampleRate

        guard sampleRate > 0 else { return nil }

        return JhadinaAudioClockSnapshot(
            sampleTime: sampleTime,
            hostTime: hostTime,
            sampleRate: sampleRate,
            seconds: sampleTime / sampleRate
        )
    }
}

public struct JhadinaAudioClockSnapshot: Sendable {
    public let sampleTime: AVAudioFramePosition
    public let hostTime: UInt64
    public let sampleRate: Double
    public let seconds: TimeInterval

    public init(sampleTime: AVAudioFramePosition, hostTime: UInt64, sampleRate: Double, seconds: TimeInterval) {
        self.sampleTime = sampleTime
        self.hostTime = hostTime
        self.sampleRate = sampleRate
        self.seconds = seconds
    }
}
