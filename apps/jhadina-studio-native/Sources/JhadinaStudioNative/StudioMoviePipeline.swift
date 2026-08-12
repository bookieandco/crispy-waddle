import Foundation
import AVFoundation
import GPUImage

public struct StudioMoviePipelineResult: Sendable {
    public let status: String
    public let outputURL: URL?
    public let framesProcessed: Int
    public let warnings: [String]
}

/// Platform-native movie pipeline boundary. The platform target supplies the
/// concrete GPUImage2 movie source/writer lifecycle; this package owns request
/// validation and result semantics.
public final class StudioMoviePipeline {
    public init() {}

    public func validate(inputURL: URL, outputURL: URL, operation: StudioGPUOperation) async throws -> StudioMoviePipelineResult {
        let asset = AVURLAsset(url: inputURL)
        let duration = try await asset.load(.duration)
        let tracks = try await asset.load(.tracks)
        guard duration.seconds > 0 else {
            return .init(status: "failed", outputURL: nil, framesProcessed: 0, warnings: ["Input has no duration."])
        }
        guard tracks.contains(where: { $0.mediaType == .video }) else {
            return .init(status: "failed", outputURL: nil, framesProcessed: 0, warnings: ["Input contains no video track."])
        }
        return .init(status: "ready", outputURL: outputURL, framesProcessed: 0, warnings: ["GPUImage2 movie source/writer execution must be supplied by the native platform target."])
    }
}
