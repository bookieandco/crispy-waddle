import Foundation
import GPUImage

public struct StudioGPUOperation: Codable, Sendable {
    public let operation: String
    public let assetURL: URL
    public let outputURL: URL
    public let parameters: [String: Double]

    public init(operation: String, assetURL: URL, outputURL: URL, parameters: [String: Double] = [:]) {
        self.operation = operation
        self.assetURL = assetURL
        self.outputURL = outputURL
        self.parameters = parameters
    }
}

public struct StudioGPUExecutionResult: Codable, Sendable {
    public let status: String
    public let operation: String
    public let outputURL: URL?
    public let warnings: [String]
}

/// Native GPUImage2 execution boundary. Platform targets provide the concrete
/// movie source/export lifecycle; this package owns operation selection and
/// filter construction so commands remain deterministic.
public final class StudioGPUProcessor {
    public init() {}

    public func execute(_ request: StudioGPUOperation) async -> StudioGPUExecutionResult {
        do {
            let filter = try makeFilter(for: request)
            _ = filter
            return StudioGPUExecutionResult(
                status: "filter-ready",
                operation: request.operation,
                outputURL: request.outputURL,
                warnings: ["Filter chain constructed. Platform AVAsset movie source/export must execute the chain."]
            )
        } catch {
            return StudioGPUExecutionResult(
                status: "failed",
                operation: request.operation,
                outputURL: nil,
                warnings: [error.localizedDescription]
            )
        }
    }

    private func makeFilter(for request: StudioGPUOperation) throws -> BasicOperation {
        switch request.operation {
        case "blur":
            let filter = GaussianBlur()
            filter.blurRadiusInPixels = Float(request.parameters["radius"] ?? 2.0)
            return filter
        case "sharpen":
            let filter = Sharpen()
            filter.sharpness = Float(request.parameters["amount"] ?? 1.0)
            return filter
        case "denoise":
            let filter = BilateralBlur()
            filter.distanceNormalizationFactor = Float(request.parameters["amount"] ?? 8.0)
            return filter
        case "tone", "color":
            return ColorControls()
        default:
            return BasicOperation()
        }
    }
}
