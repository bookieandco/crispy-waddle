import Foundation

/// Coordinates measured drift, correction gating, native playback mutation,
/// and QC lifecycle events. It is deliberately outside the audio render path.
@MainActor
public final class JhadinaCorrectionCoordinator {
    private let playback: JhadinaNativePlaybackService
    private let gate: JhadinaCorrectionGate
    private let planner: JhadinaDriftCorrectionPlanner
    private let reporter: JhadinaPlaybackQCCorrectionReporter

    public init(
        playback: JhadinaNativePlaybackService,
        gate: JhadinaCorrectionGate = JhadinaCorrectionGate(),
        planner: JhadinaDriftCorrectionPlanner = JhadinaDriftCorrectionPlanner(),
        reporter: JhadinaPlaybackQCCorrectionReporter
    ) {
        self.playback = playback
        self.gate = gate
        self.planner = planner
        self.reporter = reporter
    }

    public func reset() {
        gate.reset()
        playback.recoverCorrection()
    }

    public func evaluate(
        driftMilliseconds: Double,
        epochID: UUID,
        now: TimeInterval = ProcessInfo.processInfo.systemUptime
    ) -> JhadinaCorrectionGateDecision {
        let decision = gate.evaluate(driftMilliseconds: driftMilliseconds, now: now)

        if decision.shouldApply,
           let plan = planner.plan(driftMilliseconds: driftMilliseconds),
           playback.applyCorrection(plan) {
            reporter.correctionApplied(
                epochID: epochID,
                driftMilliseconds: driftMilliseconds,
                correctionRate: plan.requestedRate
            )
        }

        if decision.shouldRecover {
            playback.recoverCorrection()
            reporter.correctionRecovered(
                epochID: epochID,
                driftMilliseconds: driftMilliseconds
            )
        }

        return decision
    }
}
