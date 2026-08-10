import Foundation

public enum JhadinaSyncState: String, Sendable {
    case locked
    case warning
    case correcting
    case recovered
    case failed
}

public struct JhadinaSyncPolicy: Sendable {
    public let warningMilliseconds: Double
    public let correctionMilliseconds: Double
    public let failureMilliseconds: Double
    public let recoveryMilliseconds: Double
    public let recoverySamplesRequired: Int

    public init(
        warningMilliseconds: Double = 5,
        correctionMilliseconds: Double = 15,
        failureMilliseconds: Double = 30,
        recoveryMilliseconds: Double = 5,
        recoverySamplesRequired: Int = 5
    ) {
        self.warningMilliseconds = warningMilliseconds
        self.correctionMilliseconds = correctionMilliseconds
        self.failureMilliseconds = failureMilliseconds
        self.recoveryMilliseconds = recoveryMilliseconds
        self.recoverySamplesRequired = max(1, recoverySamplesRequired)
    }
}

public struct JhadinaSyncDecision: Sendable {
    public let state: JhadinaSyncState
    public let driftMilliseconds: Double
    public let correctionRequested: Bool
    public let epochID: UUID

    public init(state: JhadinaSyncState, driftMilliseconds: Double, correctionRequested: Bool, epochID: UUID) {
        self.state = state
        self.driftMilliseconds = driftMilliseconds
        self.correctionRequested = correctionRequested
        self.epochID = epochID
    }
}

/// Deterministic policy/state machine. It does not mutate the audio render path.
public final class JhadinaDriftController {
    public private(set) var state: JhadinaSyncState = .locked

    private let policy: JhadinaSyncPolicy
    private var recoverySamples = 0

    public init(policy: JhadinaSyncPolicy = JhadinaSyncPolicy()) {
        self.policy = policy
    }

    public func reset() {
        state = .locked
        recoverySamples = 0
    }

    public func evaluate(driftMilliseconds: Double, epochID: UUID) -> JhadinaSyncDecision {
        let magnitude = abs(driftMilliseconds)

        guard magnitude.isFinite else {
            state = .failed
            recoverySamples = 0
            return JhadinaSyncDecision(state: state, driftMilliseconds: driftMilliseconds, correctionRequested: false, epochID: epochID)
        }

        if magnitude >= policy.failureMilliseconds {
            state = .failed
            recoverySamples = 0
            return JhadinaSyncDecision(state: state, driftMilliseconds: driftMilliseconds, correctionRequested: false, epochID: epochID)
        }

        if magnitude >= policy.correctionMilliseconds {
            state = .correcting
            recoverySamples = 0
            return JhadinaSyncDecision(state: state, driftMilliseconds: driftMilliseconds, correctionRequested: true, epochID: epochID)
        }

        if magnitude >= policy.warningMilliseconds {
            state = .warning
            recoverySamples = 0
            return JhadinaSyncDecision(state: state, driftMilliseconds: driftMilliseconds, correctionRequested: false, epochID: epochID)
        }

        if state == .correcting || state == .warning {
            recoverySamples += 1
            if recoverySamples >= policy.recoverySamplesRequired {
                state = .recovered
            }
        } else {
            state = .locked
        }

        return JhadinaSyncDecision(state: state, driftMilliseconds: driftMilliseconds, correctionRequested: false, epochID: epochID)
    }
}
