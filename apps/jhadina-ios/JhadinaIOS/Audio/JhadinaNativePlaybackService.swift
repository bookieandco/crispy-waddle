import AVFoundation
import Foundation

/// Native iOS implementation boundary for Jhadina Music Core.
///
/// This adapter owns AVPlayer/AVAudioSession lifecycle concerns. It deliberately
/// does not perform policy decisions, persistence, or LLM work on audio threads.
@MainActor
public final class JhadinaNativePlaybackService: NSObject {
    public enum State: Equatable {
        case idle
        case loading
        case ready
        case playing
        case paused
        case failed(String)
    }

    public private(set) var state: State = .idle
    public private(set) var currentTime: TimeInterval = 0
    public private(set) var rate: Float = 0

    private let audioSession: AVAudioSession
    private var player: AVPlayer?

    public init(audioSession: AVAudioSession = .sharedInstance()) {
        self.audioSession = audioSession
        super.init()
    }

    public func load(url: URL) throws {
        state = .loading
        try configureAudioSession()
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        self.player = player
        state = .ready
        currentTime = 0
        rate = 0
    }

    public func play() {
        guard let player else { return }
        player.play()
        state = .playing
        rate = player.rate
    }

    public func pause() {
        guard let player else { return }
        player.pause()
        state = .paused
        currentTime = player.currentTime().seconds
        rate = 0
    }

    public func seek(to seconds: TimeInterval) async {
        guard let player else { return }
        let target = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        await player.seek(to: target)
        currentTime = player.currentTime().seconds
    }

    public func stop() {
        player?.pause()
        player = nil
        state = .idle
        currentTime = 0
        rate = 0
    }

    public func snapshot() -> Snapshot {
        let playerTime = player?.currentTime().seconds ?? currentTime
        return Snapshot(
            state: state,
            playerTime: playerTime,
            rate: player?.rate ?? rate,
            sampleRate: audioSession.sampleRate,
            outputLatency: audioSession.outputLatency,
            bufferDuration: audioSession.ioBufferDuration,
            route: audioSession.currentRoute.outputs.map(\.portType.rawValue).joined(separator: ",")
        )
    }

    private func configureAudioSession() throws {
        try audioSession.setCategory(.playback, mode: .default, options: [])
        try audioSession.setActive(true)
    }

    public struct Snapshot: Sendable {
        public let state: State
        public let playerTime: TimeInterval
        public let rate: Float
        public let sampleRate: Double
        public let outputLatency: TimeInterval
        public let bufferDuration: TimeInterval
        public let route: String
    }
}
