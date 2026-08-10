import Foundation

public enum JhadinaPlaybackQCEventType: String, Sendable {
    case correctionApplied = "CORRECTION_APPLIED"
    case correctionRecovered = "CORRECTION_RECOVERED"
}

public struct JhadinaPlaybackQCEvent: Sendable {
    public let id: UUID
    public let sessionID: UUID
    public let epochID: UUID
    public let timestamp: TimeInterval
    public let type: JhadinaPlaybackQCEventType
    public let driftMilliseconds: Double
    public let correctionRate: Double?
    public let correctionDuration: TimeInterval?

    public init(
        id: UUID = UUID(),
        sessionID: UUID,
        epochID: UUID,
        timestamp: TimeInterval = ProcessInfo.processInfo.systemUptime,
        type: JhadinaPlaybackQCEventType,
        driftMilliseconds: Double,
        correctionRate: Double? = nil,
        correctionDuration: TimeInterval? = nil
    ) {
        self.id = id
        self.sessionID = sessionID
        self.epochID = epochID
        self.timestamp = timestamp
        self.type = type
        self.driftMilliseconds = driftMilliseconds
        self.correctionRate = correctionRate
        self.correctionDuration = correctionDuration
    }
}

public protocol JhadinaPlaybackQCEventSink: Sendable {
    func record(_ event: JhadinaPlaybackQCEvent)
}

/// Bridges correction lifecycle events into Playback QC without performing
/// persistence or audio work on the render/monitoring path.
public final class JhadinaPlaybackQCCorrectionReporter {
    private let sessionID: UUID
    private let sink: JhadinaPlaybackQCEventSink
    private var correctionStartedAt: TimeInterval?

    public init(sessionID: UUID, sink: JhadinaPlaybackQCEventSink) {
        self.sessionID = sessionID
        self.sink = sink
    }

    public func correctionApplied(
        epochID: UUID,
        driftMilliseconds: Double,
        correctionRate: Double
    ) {
        correctionStartedAt = ProcessInfo.processInfo.systemUptime
        sink.record(JhadinaPlaybackQCEvent(
            sessionID: sessionID,
            epochID: epochID,
            type: .correctionApplied,
            driftMilliseconds: driftMilliseconds,
            correctionRate: correctionRate
        ))
    }

    public func correctionRecovered(
        epochID: UUID,
        driftMilliseconds: Double
    ) {
        let now = ProcessInfo.processInfo.systemUptime
        let duration = correctionStartedAt.map { max(0, now - $0) }
        correctionStartedAt = nil

        sink.record(JhadinaPlaybackQCEvent(
            sessionID: sessionID,
            epochID: epochID,
            type: .correctionRecovered,
            driftMilliseconds: driftMilliseconds,
            correctionDuration: duration
        ))
    }
}
