import Foundation

public struct JhadinaCorrectionGatePolicy: Sendable {
    public let enterThresholdMilliseconds: Double
    public let exitThresholdMilliseconds: Double
    public let cooldown: TimeInterval
    public let minimumCorrectionDuration: TimeInterval

    public init(
        enterThresholdMilliseconds: Double = 15,
        exitThresholdMilliseconds: Double = 5,
        cooldown: TimeInterval = 1.0,
        minimumCorrectionDuration: TimeInterval = 0.5
    ) {
        self.enterThresholdMilliseconds = max(0, enterThresholdMilliseconds)
        self.exitThresholdMilliseconds = min(max(0, exitThresholdMilliseconds), self.enterThresholdMilliseconds)
        self.cooldown = max(0, cooldown)
        self.minimumCorrectionDuration = max(0, minimumCorrectionDuration)
    }
}

public struct JhadinaCorrectionGateDecision: Sendable {
    public let shouldApply: Bool
    public let shouldRecover: Bool
    public let reason: String

    public init(shouldApply: Bool, shouldRecover: Bool, reason: String) {
        self.shouldApply = shouldApply
        self.shouldRecover = shouldRecover
        self.reason = reason
    }
}

/// Prevents correction thrashing. It is intentionally independent of AVPlayer
/// and can therefore be exercised with deterministic timing tests.
public final class JhadinaCorrectionGate {
    private let policy: JhadinaCorrectionGatePolicy
    private var correctionStartedAt: TimeInterval?
    private var lastCorrectionEndedAt: TimeInterval?

    public init(policy: JhadinaCorrectionGatePolicy = JhadinaCorrectionGatePolicy()) {
        self.policy = policy
    }

    public func reset() {
        correctionStartedAt = nil
        lastCorrectionEndedAt = nil
    }

    public func evaluate(driftMilliseconds: Double, now: TimeInterval) -> JhadinaCorrectionGateDecision {
        guard driftMilliseconds.isFinite else {
            return JhadinaCorrectionGateDecision(shouldApply: false, shouldRecover: false, reason: "invalid_drift")
        }

        let magnitude = abs(driftMilliseconds)

        if let started = correctionStartedAt {
            if magnitude <= policy.exitThresholdMilliseconds,
               now - started >= policy.minimumCorrectionDuration {
                correctionStartedAt = nil
                lastCorrectionEndedAt = now
                return JhadinaCorrectionGateDecision(shouldApply: false, shouldRecover: true, reason: "recovery_band_reached")
            }

            return JhadinaCorrectionGateDecision(shouldApply: false, shouldRecover: false, reason: "correction_in_progress")
        }

        guard magnitude >= policy.enterThresholdMilliseconds else {
            return JhadinaCorrectionGateDecision(shouldApply: false, shouldRecover: false, reason: "inside_hysteresis_band")
        }

        if let ended = lastCorrectionEndedAt, now - ended < policy.cooldown {
            return JhadinaCorrectionGateDecision(shouldApply: false, shouldRecover: false, reason: "cooldown")
        }

        correctionStartedAt = now
        return JhadinaCorrectionGateDecision(shouldApply: true, shouldRecover: false, reason: "enter_correction_band")
    }
}