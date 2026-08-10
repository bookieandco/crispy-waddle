import AVFoundation
import Foundation

public struct JhadinaDriftSample: Sendable {
    public let timestamp: TimeInterval
    public let playerTime: TimeInterval
    public let audioTime: TimeInterval
    public let audioHostTime: UInt64
    public let driftMilliseconds: Double
    public let epochID: UUID

    public init(timestamp: TimeInterval, playerTime: TimeInterval, audioTime: TimeInterval = .nan, audioHostTime: UInt64, driftMilliseconds: Double, epochID: UUID) {
        self.timestamp = timestamp
        self.playerTime = playerTime
        self.audioTime = audioTime
        self.audioHostTime = audioHostTime
        self.driftMilliseconds = driftMilliseconds
        self.epochID = epochID
    }
}

/// Correlates AVPlayer's media clock with the AVAudioEngine render clock.
/// The first valid pair establishes an epoch-relative anchor. Subsequent
/// samples measure relative drift; fixed route latency is therefore not
/// mistaken for clock drift.
public final class JhadinaSyncMonitor {
    public typealias SampleHandler = @Sendable (JhadinaDriftSample) -> Void

    private let player: AVPlayer
    private let audioClock: JhadinaAudioClockProvider?
    private let sampleInterval: TimeInterval
    private let handler: SampleHandler
    private var timer: DispatchSourceTimer?
    private var epochID = UUID()
    private var anchorPlayerTime: TimeInterval?
    private var anchorAudioTime: TimeInterval?
    private let queue = DispatchQueue(label: "com.jhadina.music.sync-monitor", qos: .userInitiated)

    public init(player: AVPlayer, audioClock: JhadinaAudioClockProvider? = nil, sampleInterval: TimeInterval = 0.1, handler: @escaping SampleHandler) {
        self.player = player
        self.audioClock = audioClock
        self.sampleInterval = max(0.05, sampleInterval)
        self.handler = handler
    }

    public func startNewEpoch() {
        queue.async { [weak self] in
            guard let self else { return }
            self.epochID = UUID()
            self.anchorPlayerTime = nil
            self.anchorAudioTime = nil
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
        let audioSnapshot = audioClock?.snapshot()

        if let audioSnapshot {
            if anchorPlayerTime == nil || anchorAudioTime == nil {
                anchorPlayerTime = playerSeconds
                anchorAudioTime = audioSnapshot.seconds
            }

            let playerDelta = playerSeconds - (anchorPlayerTime ?? playerSeconds)
            let audioDelta = audioSnapshot.seconds - (anchorAudioTime ?? audioSnapshot.seconds)
            let driftMs = (playerDelta - audioDelta) * 1000.0

            handler(JhadinaDriftSample(
                timestamp: timestamp,
                playerTime: playerSeconds,
                audioTime: audioSnapshot.seconds,
                audioHostTime: audioSnapshot.hostTime,
                driftMilliseconds: driftMs,
                epochID: epochID
            ))
            return
        }

        // Until an audio clock is supplied, publish an explicit unknown value
        // rather than fabricating a zero-drift measurement.
        handler(JhadinaDriftSample(
            timestamp: timestamp,
            playerTime: playerSeconds,
            audioTime: .nan,
            audioHostTime: hostTime,
            driftMilliseconds: .nan,
            epochID: epochID
        ))
    }
}
