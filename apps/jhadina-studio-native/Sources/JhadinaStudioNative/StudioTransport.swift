import Foundation

public enum StudioTransportState: String, Codable, Sendable {
    case stopped
    case playing
    case paused
    case scrubbing
}

public struct StudioTransportSnapshot: Codable, Sendable, Equatable {
    public let state: StudioTransportState
    public let playheadSeconds: Double
    public let rate: Double
    public let generation: UInt64
}

public final class StudioTransport {
    private var state: StudioTransportState = .stopped
    private var playhead: Double = 0
    private var rate: Double = 1
    private var generation: UInt64 = 0

    public init() {}

    public func play(from seconds: Double? = nil) -> StudioTransportSnapshot {
        if let seconds { playhead = max(0, seconds) }
        state = .playing
        generation &+= 1
        return snapshot()
    }

    public func pause() -> StudioTransportSnapshot {
        state = .paused
        generation &+= 1
        return snapshot()
    }

    public func stop() -> StudioTransportSnapshot {
        state = .stopped
        playhead = 0
        generation &+= 1
        return snapshot()
    }

    public func scrub(to seconds: Double) -> StudioTransportSnapshot {
        state = .scrubbing
        playhead = max(0, seconds)
        generation &+= 1
        return snapshot()
    }

    public func setRate(_ value: Double) -> StudioTransportSnapshot {
        rate = min(max(value, 0.25), 2.0)
        generation &+= 1
        return snapshot()
    }

    public func snapshot() -> StudioTransportSnapshot {
        .init(state: state, playheadSeconds: playhead, rate: rate, generation: generation)
    }
}
