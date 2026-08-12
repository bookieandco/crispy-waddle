import Foundation
import AVFoundation

public struct StudioExportRequest: Sendable {
    public let inputURL: URL
    public let outputURL: URL
    public let operation: String
    public let parameters: [String: String]

    public init(inputURL: URL, outputURL: URL, operation: String, parameters: [String: String] = [:]) {
        self.inputURL = inputURL
        self.outputURL = outputURL
        self.operation = operation
        self.parameters = parameters
    }
}

public struct StudioExportResult: Sendable {
    public let status: String
    public let outputURL: URL?
    public let warnings: [String]
}

/// AVFoundation boundary for the native Studio export path.
/// GPUImage2 filter-chain execution is injected by the platform target.
public final class StudioVideoExporter {
    public init() {}

    public func validate(_ request: StudioExportRequest) async throws -> StudioExportResult {
        let asset = AVURLAsset(url: request.inputURL)
        let duration = try await asset.load(.duration)
        guard duration.seconds > 0 else {
            return StudioExportResult(status: "failed", outputURL: nil, warnings: ["Input video has no duration."])
        }
        return StudioExportResult(status: "ready", outputURL: request.outputURL, warnings: [])
    }
}
