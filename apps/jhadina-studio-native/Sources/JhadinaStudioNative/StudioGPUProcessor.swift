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

public final class StudioGPUProcessor {
    public init() {}

    public func execute(_ request: StudioGPUOperation) async -> StudioGPUExecutionResult {
        do {
            _ = try makeFilter(for: request)
            return StudioGPUExecutionResult(
                status: "filter-ready",
                operation: request.operation,
                outputURL: request.outputURL,
                warnings: ["GPUImage2 filter constructed. Native movie source/export is the remaining platform integration."]
            )
        } catch {
            return StudioGPUExecutionResult(status: "failed", operation: request.operation, outputURL: nil, warnings: [error.localizedDescription])
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
        case "color", "tone":
            return ColorControls()
        default:
            throw StudioGPUError.unsupportedOperation(request.operation)
        }
    }
}

public enum StudioGPUError: LocalizedError {
    case unsupportedOperation(String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedOperation(let operation):
            return "GPUImage2 operation '\(operation)' is not implemented in the native filter map yet."
        }
    }
}
