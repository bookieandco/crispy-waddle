import AVFoundation
import CoreLocation
import Foundation
import Network
import UIKit

struct SafetyPlatformCapabilitiesDTO: Codable, Equatable {
    let foregroundAudio: Bool
    let foregroundVideo: Bool
    let backgroundAudio: Bool
    let backgroundVideo: Bool
    let backgroundLocation: Bool
    let notifications: Bool
    let localEncryptedStorage: Bool
}

struct SafetyLocationDTO: Codable, Equatable {
    let latitude: Double
    let longitude: Double
    let observedAt: String
}

struct SafetyHeartbeatDTO: Codable, Equatable {
    let observedAt: String
    let batteryPercent: Int?
    let networkReachable: Bool
}

struct SafetyCaptureSessionDTO: Codable, Equatable {
    let sessionRef: String
    let startedAt: String
}

enum SafetyNativeError: Error {
    case capabilityUnavailable(String)
    case locationUnavailable
}

@MainActor
final class SafetyNativeRuntime: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var networkReachable = false
    @Published private(set) var microphoneStatus = "unknown"
    @Published private(set) var cameraStatus = "unknown"
    @Published private(set) var locationStatus = "unknown"

    private let locationManager = CLLocationManager()
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.jhadina.safety.network")
    private var activeCaptureRefs = Set<String>()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        UIDevice.current.isBatteryMonitoringEnabled = true
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in self?.networkReachable = path.status == .satisfied }
        }
        monitor.start(queue: monitorQueue)
    }

    func refreshCapabilities() async {
        microphoneStatus = Self.audioAuthorizationLabel()
        cameraStatus = Self.videoAuthorizationLabel()
        locationStatus = Self.locationAuthorizationLabel(locationManager.authorizationStatus)
    }

    func requestSafetyPermissions() async {
        _ = await AVCaptureDevice.requestAccess(for: .audio)
        _ = await AVCaptureDevice.requestAccess(for: .video)
        locationManager.requestAlwaysAuthorization()
        await refreshCapabilities()
    }

    func capabilities() -> SafetyPlatformCapabilitiesDTO {
        let audioGranted = AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
        let videoGranted = AVCaptureDevice.authorizationStatus(for: .video) == .authorized
        let location = locationManager.authorizationStatus
        let backgroundLocation = location == .authorizedAlways

        return SafetyPlatformCapabilitiesDTO(
            foregroundAudio: audioGranted,
            foregroundVideo: videoGranted,
            backgroundAudio: audioGranted,
            backgroundVideo: false,
            backgroundLocation: backgroundLocation,
            notifications: false,
            localEncryptedStorage: true
        )
    }

    func readLocation() throws -> SafetyLocationDTO {
        guard let value = locationManager.location else { throw SafetyNativeError.locationUnavailable }
        return SafetyLocationDTO(
            latitude: value.coordinate.latitude,
            longitude: value.coordinate.longitude,
            observedAt: ISO8601DateFormatter().string(from: value.timestamp)
        )
    }

    func beginPermittedCapture(kinds: [String]) throws -> SafetyCaptureSessionDTO {
        let caps = capabilities()
        if kinds.contains("audio") && !caps.foregroundAudio { throw SafetyNativeError.capabilityUnavailable("audio") }
        if kinds.contains("video") && !caps.foregroundVideo { throw SafetyNativeError.capabilityUnavailable("video") }
        let ref = UUID().uuidString
        activeCaptureRefs.insert(ref)
        return SafetyCaptureSessionDTO(sessionRef: ref, startedAt: ISO8601DateFormatter().string(from: Date()))
    }

    func endCapture(sessionRef: String) {
        activeCaptureRefs.remove(sessionRef)
    }

    func heartbeat() -> SafetyHeartbeatDTO {
        let battery = UIDevice.current.batteryLevel
        return SafetyHeartbeatDTO(
            observedAt: ISO8601DateFormatter().string(from: Date()),
            batteryPercent: battery < 0 ? nil : Int((battery * 100).rounded()),
            networkReachable: networkReachable
        )
    }

    nonisolated private static func audioAuthorizationLabel() -> String {
        authorizationLabel(AVCaptureDevice.authorizationStatus(for: .audio))
    }

    nonisolated private static func videoAuthorizationLabel() -> String {
        authorizationLabel(AVCaptureDevice.authorizationStatus(for: .video))
    }

    nonisolated private static func authorizationLabel(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-determined"
        @unknown default: return "unknown"
        }
    }

    nonisolated private static func locationAuthorizationLabel(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "when-in-use"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not-determined"
        @unknown default: return "unknown"
        }
    }
}
