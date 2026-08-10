import AVFoundation
import Foundation

public struct JhadinaDriftSample: Sendable {
    public let timestamp: TimeInterval
    public let playerTime: TimeInterval
    public let audioHostTime: UInt64
    public let driftMilliseconds: Double
    public let epochID: UUID

    public init(timestamp: TimeInterval, playerTime: TimeInterval, audioHostTime: UInt64, driftMilliseconds: Double, epochID: UUID) {
        self.timestamp = timestamp
        self.playerTime = playerTime
        self.audioHostTime = audioHostTime
        self.driftMilliseconds = driftMilliseconds
        self.epochID = epochID
    }
}

/// Observes the relationship between AVPlayer time and the native audio clock.
/// It deliberately reports measurements only; correction and persistence belong
/// outside the real-time observation path.
public final class JhadinaSyncMonitor {
    public typealias SampleHandler = @Sendable (JhadinaDriftSample) -> Void

    private let player: AVPlayer
    private let sampleInterval: TimeInterval
    private let handler: SampleHandler
    private var timer: DispatchSourceTimer?
    private var epochID = UUID()
    private let queue = DispatchQueue(label: "com.jhadina.music.sync-monitor", qos: .userInitiated)

    public init(player: AVPlayer, sampleInterval: TimeInterval = 0.1, handler: @escaping SampleHandler) {
        self.player = player
        self.sampleInterval = max(0.05, sampleInterval)
        self.handler = handler
    }

    public func startNewEpoch() {
        queue.async { [weak self] in
            self?.epochID = UUID()
        }
    }

    public func start() {
        stop()
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: sampleInterval)
        timer.setEventHandler { [weak self] in
            self?.sample()
        }
        self.timer = timer
        timer.resume()
    }

    public func stop() {
        timer?.setEventHandler {}
        timer?.cancel()
        timer = nil
    }

    private func sample() {
        guard player.timeControlStatus == .playing else { return }
        let playerSeconds = player.currentTime().seconds
        guard playerSeconds.isFinite else { return }

        let hostTime = mach_absolute_time()
        let timestamp = ProcessInfo.processInfo.systemUptime

        // The audio-engine host-time mapping is intentionally supplied by the
        // native audio adapter when it is available. Until that adapter exists,
        // this monitor records the player clock and host clock independently.
        let sample = JhadinaDriftSample(
            timestamp: timestamp,
            playerTime: playerSeconds,
            audioHostTime: hostTime,
            driftMilliseconds: 0,
            epochID: epochID
        )
        handler(sample)
    }
}
