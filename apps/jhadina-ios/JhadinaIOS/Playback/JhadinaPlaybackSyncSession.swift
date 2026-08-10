import Foundation

/// Owns the live PLAY -> SYNC -> CORRECTION -> QC observation loop.
///
/// The session depends on the playback backend contract rather than reaching
/// into a concrete AVPlayer implementation. A backend may therefore be backed
/// by AVPlayer today and a different media engine later.
@MainActor
public final class JhadinaPlaybackSyncSession {
    private let playback: JhadinaPlaybackBackend
    private let monitor: JhadinaSyncMonitor
    private let coordinator: JhadinaCorrectionCoordinator
    private let audioClock: JhadinaAudioClockProvider?

    public init(
        playback: JhadinaPlaybackBackend,
        audioClock: JhadinaAudioClockProvider?,
        coordinator: JhadinaCorrectionCoordinator,
        sampleInterval: TimeInterval = 0.1
    ) {
        self.playback = playback
        self.audioClock = audioClock
        self.coordinator = coordinator
        self.monitor = JhadinaSyncMonitor(
            playerTime: { playback.snapshot().playerTime },
            isPlaying: { playback.snapshot().state == .playing },
            audioClock: audioClock,
            sampleInterval: sampleInterval
        ) { [weak coordinator] sample in
            guard let coordinator else { return }
            coordinator.handle(sample)
        }
    }

    public var correctionEnabled: Bool {
        audioClock != nil
    }

    public func startNewEpoch() {
        coordinator.reset()
        monitor.startNewEpoch()
    }

    public func start() {
        startNewEpoch()
        monitor.start()
    }

    public func stop() {
        monitor.stop()
        coordinator.reset()
    }
}

private extension JhadinaCorrectionCoordinator {
    nonisolated func handle(_ sample: JhadinaDriftSample) {
        Task { @MainActor [weak self] in
            guard let self, sample.driftMilliseconds.isFinite else { return }
            _ = self.evaluate(
                driftMilliseconds: sample.driftMilliseconds,
                epochID: sample.epochID,
                now: sample.timestamp
            )
        }
    }
}
