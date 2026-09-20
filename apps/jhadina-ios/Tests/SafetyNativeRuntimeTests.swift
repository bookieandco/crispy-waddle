import XCTest
@testable import JhadinaSafety

final class SafetyNativeRuntimeTests: XCTestCase {
    func testCapabilityDTOCanRepresentIOSBackgroundTruth() {
        let capabilities = SafetyPlatformCapabilitiesDTO(
            foregroundAudio: true,
            foregroundVideo: true,
            backgroundAudio: true,
            backgroundVideo: false,
            backgroundLocation: true,
            notifications: false,
            localEncryptedStorage: true
        )
        XCTAssertFalse(capabilities.backgroundVideo)
        XCTAssertTrue(capabilities.backgroundLocation)
    }

    func testBridgeMethodsMatchCoreContract() {
        XCTAssertEqual(SafetyBridgeMethod.getCapabilities.rawValue, "getCapabilities")
        XCTAssertEqual(SafetyBridgeMethod.readLocation.rawValue, "readLocation")
        XCTAssertEqual(SafetyBridgeMethod.beginPermittedCapture.rawValue, "beginPermittedCapture")
        XCTAssertEqual(SafetyBridgeMethod.endCapture.rawValue, "endCapture")
        XCTAssertEqual(SafetyBridgeMethod.getDeviceHeartbeat.rawValue, "getDeviceHeartbeat")
    }
}
