import Foundation

#if canImport(GPUImage)
import GPUImage
#endif

public struct StudioGPURequest: Codable {
    public let operation: String
    public let assetId: String
    public let output: String
    public let parameters: [String: String]
}

public struct StudioGPUResult: Codable {
    public let status: String
    public let assetId: String
    public let outputURL: String?
    public let warnings: [String]
}

/// Native bridge boundary. The app target can map JSON requests from the web UI
/// to GPUImage2 filters and export the resulting video without exposing GPU code
/// to the Next.js runtime.
public final class StudioGPUImage2Bridge {
    public init() {}

    public func process(_ request: StudioGPURequest) async throws -> StudioGPUResult {
        #if canImport(GPUImage)
        // Concrete filter-chain construction belongs in the iOS/macOS target.
        // Keep this boundary small so the same Studio request works locally or remotely.
        return StudioGPUResult(status: "queued", assetId: request.assetId, outputURL: nil, warnings: ["Attach the native GPUImage2 filter/export pipeline in the Xcode target."])
        #else
        return StudioGPUResult(status: "failed", assetId: request.assetId, outputURL: nil, warnings: ["GPUImage2 is not linked into this native target."])
        #endif
    }
}
