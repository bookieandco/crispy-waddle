import XCTest
@testable import JhadinaStudioNative

final class StudioAVSyncQCTests: XCTestCase {
    func testPassesWithinConfiguredThresholds() {
        let report = StudioAVSyncReport(status: "pass", audioDurationSeconds: 10, videoDurationSeconds: 10.01, durationDeltaMilliseconds: 10, firstVideoPTSSeconds: 0, lastVideoPTSSeconds: 10.01, firstAudioPTSSeconds: 0.005, lastAudioPTSSeconds: 10.02, startDeltaMilliseconds: 5, endDeltaMilliseconds: 10, warnings: [])
        XCTAssertEqual(report.status, "pass")
        XCTAssertLessThanOrEqual(report.durationDeltaMilliseconds, 20)
        XCTAssertLessThanOrEqual(report.startDeltaMilliseconds, 20)
        XCTAssertLessThanOrEqual(report.endDeltaMilliseconds, 40)
    }

    func testFailsWhenDurationAndTimestampDriftExceedThresholds() {
        let report = StudioAVSyncReport(status: "fail", audioDurationSeconds: 10, videoDurationSeconds: 10.2, durationDeltaMilliseconds: 200, firstVideoPTSSeconds: 0, lastVideoPTSSeconds: 10.2, firstAudioPTSSeconds: 0.1, lastAudioPTSSeconds: 10, startDeltaMilliseconds: 100, endDeltaMilliseconds: 200, warnings: ["Audio/video duration delta exceeds threshold.", "Audio/video start timestamp delta exceeds threshold.", "Audio/video end timestamp delta exceeds threshold."])
        XCTAssertEqual(report.status, "fail")
        XCTAssertGreaterThan(report.durationDeltaMilliseconds, 20)
        XCTAssertGreaterThan(report.startDeltaMilliseconds, 20)
        XCTAssertGreaterThan(report.endDeltaMilliseconds, 40)
        XCTAssertEqual(report.warnings.count, 3)
    }
}
