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

/// Native execution entry point. Concrete AVAsset/video export wiring is kept
/// behind this API so the web Studio and remote workers share one command model.
public final class StudioGPUProcessor {
    public init() {}

    public func execute(_ request: StudioGPUOperation) async -> StudioGPUExecutionResult {
        // GPUImage2 is linked into the native package here. Video source/export
        // pipelines are implemented incrementally per operation to keep each
        // operation independently testable on iOS and macOS.
        switch request.operation {
        case "color", "tone", "blur", "sharpen", "denoise", "transform", "chroma-key", "stylize", "mask-composite", "thumbnail":
            return StudioGPUExecutionResult(
                status: "provider-linked",
                operation: request.operation,
                outputURL: nil,
                warnings: ["GPUImage2 is linked; concrete AVAsset source/filter/export wiring is the next native implementation step."]
            )
        default:
            return StudioGPUExecutionResult(status: "failed", operation: request.operation, outputURL: nil, warnings: ["Unsupported GPU operation."])
        }
    }
}
