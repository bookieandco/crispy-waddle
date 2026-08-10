import Foundation

public struct JhadinaCorrectionPlan: Sendable {
    public let requestedRate: Double
    public let durationSeconds: TimeInterval
    public let direction: Int

    public init(requestedRate: Double, durationSeconds: TimeInterval, direction: Int) {
        self.requestedRate = requestedRate
        self.durationSeconds = durationSeconds
        self.direction = direction
    }
}

/// Converts measured drift into a small, bounded playback-rate adjustment.
/// The planner does not touch AVPlayer/AVAudioEngine directly; the native
/// playback adapter owns application of the plan and can reject it if the
/// route/backend cannot safely support rate correction.
public struct JhadinaDriftCorrectionPlanner: Sendable {
    public let maximumRateOffset: Double
    public let maximumDurationSeconds: TimeInterval
    public let minimumDurationSeconds: TimeInterval

    public init(
        maximumRateOffset: Double = 0.005,
        minimumDurationSeconds: TimeInterval = 0.05,
        maximumDurationSeconds: TimeInterval = 0.5
    ) {
        self.maximumRateOffset = max(0, maximumRateOffset)
        self.minimumDurationSeconds = max(0.01, minimumDurationSeconds)
        self.maximumDurationSeconds = max(self.minimumDurationSeconds, maximumDurationSeconds)
    }

    public func plan(driftMilliseconds: Double) -> JhadinaCorrectionPlan? {
        guard driftMilliseconds.isFinite else { return nil }
        let magnitude = abs(driftMilliseconds)
        guard magnitude > 0 else { return nil }

        let normalized = min(magnitude / 30.0, 1.0)
        let offset = max(0.0005, normalized * maximumRateOffset)
        let duration = min(
            maximumDurationSeconds,
            max(minimumDurationSeconds, magnitude / 1000.0)
        )

        // Positive drift means the audio clock is ahead of the player clock;
        // temporarily slow the audio path. Negative drift means speed it up.
        let direction = driftMilliseconds > 0 ? -1 : 1
        let rate = 1.0 + (Double(direction) * offset)

        return JhadinaCorrectionPlan(
            requestedRate: rate,
            durationSeconds: duration,
            direction: direction
        )
    }
}
