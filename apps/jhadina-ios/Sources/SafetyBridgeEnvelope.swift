import Foundation

enum SafetyBridgeMethod: String, Codable {
    case getCapabilities
    case readLocation
    case beginPermittedCapture
    case endCapture
    case getDeviceHeartbeat
}

struct SafetyBridgeRequest: Codable {
    let id: String
    let method: SafetyBridgeMethod
    let captureKinds: [String]?
    let sessionRef: String?
}

struct SafetyBridgeResponse: Codable {
    let id: String
    let ok: Bool
    let payload: Data?
    let errorCode: String?
}

@MainActor
final class SafetyBridgeEnvelope {
    private let runtime: SafetyNativeRuntime
    private let encoder = JSONEncoder()

    init(runtime: SafetyNativeRuntime) {
        self.runtime = runtime
    }

    func handle(_ request: SafetyBridgeRequest) throws -> SafetyBridgeResponse {
        switch request.method {
        case .getCapabilities:
            return success(request.id, runtime.capabilities())
        case .readLocation:
            return success(request.id, try runtime.readLocation())
        case .beginPermittedCapture:
            return success(request.id, try runtime.beginPermittedCapture(kinds: request.captureKinds ?? []))
        case .endCapture:
            if let ref = request.sessionRef { runtime.endCapture(sessionRef: ref) }
            return SafetyBridgeResponse(id: request.id, ok: true, payload: nil, errorCode: nil)
        case .getDeviceHeartbeat:
            return success(request.id, runtime.heartbeat())
        }
    }

    private func success<T: Encodable>(_ id: String, _ value: T) -> SafetyBridgeResponse {
        SafetyBridgeResponse(id: id, ok: true, payload: try? encoder.encode(value), errorCode: nil)
    }
}
