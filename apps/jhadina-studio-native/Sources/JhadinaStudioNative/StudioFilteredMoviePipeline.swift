import Foundation

public struct StudioFilteredMovieResult: Sendable {
    public let status: String
    public let outputURL: URL?
    public let framesProcessed: Int
    public let warnings: [String]
}

/// Orchestrates source -> GPUImage2 filter session -> native movie writer.
/// Platform targets provide the concrete GPU frame pump and writer implementation.
public final class StudioFilteredMoviePipeline {
    private let filters: StudioVideoFilterSession

    public init(filters: StudioVideoFilterSession = StudioVideoFilterSession()) {
        self.filters = filters
    }

    public func prepare(operation: StudioGPUOperation, inputURL: URL, outputURL: URL) throws -> StudioFilteredMovieResult {
        _ = try filters.buildFilter(for: operation)
        return StudioFilteredMovieResult(
            status: "prepared",
            outputURL: outputURL,
            framesProcessed: 0,
            warnings: ["Platform AVAssetReader/GPUImage2/AVAssetWriter frame pump must execute in the native app target."]
        )
    }
}
