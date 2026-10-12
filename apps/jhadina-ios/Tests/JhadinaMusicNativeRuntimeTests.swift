import XCTest
@testable import JhadinaSafety

/// Simulator contract checks only. Physical iPhone, signing, interruptions and
/// authorized network playback remain separate commissioning requirements.
@MainActor
final class JhadinaMusicNativeRuntimeTests: XCTestCase {
    func testNativeHostRejectsUnsecuredAudioBeforeTouchingAudioSession() {
        let controller = JhadinaAudioPlaybackController()
        let ticket = JhadinaAudioPlaybackController.Ticket(
            mediaId: "test-track",
            url: URL(string: "http://insecure.example.test/track.mp3")!,
            expiresAt: nil
        )
        XCTAssertThrowsError(try controller.load(ticket, title: "Track", artist: "Owner"))
        controller.stopAndDiscardTicket()
    }

    func testNativeHostRejectsAlreadyExpiredAuthorizedTicket() {
        let controller = JhadinaAudioPlaybackController()
        let ticket = JhadinaAudioPlaybackController.Ticket(
            mediaId: "expired-track",
            url: URL(string: "https://audio.example.test/track.mp3")!,
            expiresAt: Date(timeIntervalSince1970: 0)
        )
        XCTAssertThrowsError(try controller.load(ticket, title: "Track", artist: "Owner"))
        controller.stopAndDiscardTicket()
    }

    func testSignedTicketFractionalExpiryParsing() {
        XCTAssertNotNil(JhadinaMusicNativeSession.expirationDate("2026-10-10T22:00:00.000Z"))
        XCTAssertNotNil(JhadinaMusicNativeSession.expirationDate("2026-10-10T22:00:00Z"))
        XCTAssertNil(JhadinaMusicNativeSession.expirationDate("not-a-valid-expiry"))
    }

    func testNearExpiryNativeTicketIsRejectedForNewPlayback() {
        let controller = JhadinaAudioPlaybackController()
        let ticket = JhadinaAudioPlaybackController.Ticket(
            mediaId: "nearly-expired",
            url: URL(string:"https://audio.example.test/track.mp3")!,
            expiresAt: Date().addingTimeInterval(5)
        )
        XCTAssertThrowsError(try controller.load(ticket,title:"Track",artist:"Owner"))
        controller.stopAndDiscardTicket()
    }

    func testNativeMusicStartsUnadmittedWithControlsDisabled() {
        let model = JhadinaNativeMusicModel()
        XCTAssertFalse(model.isReady)
        XCTAssertFalse(model.isPlaying)
        model.play()
        XCTAssertFalse(model.isPlaying)
        model.pause()
        model.stop()
        XCTAssertFalse(model.isReady)
    }
}
