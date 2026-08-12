import Foundation
import AVFoundation

public struct StudioFramePumpResult: Sendable {
    public let status: String
    public let framesProcessed: Int
    public let outputURL: URL?
    public let audioPreserved: Bool
    public let warnings: [String]
}

/// Coordinates AVAssetReader -> GPUImage2 -> AVAssetWriter. The actual
/// GPU texture conversion is implemented by the iOS/macOS application target.
public final class StudioFramePump {
    public init() {}

    public func validate(inputURL: URL, outputURL: URL) async throws -> StudioFramePumpResult {
        let asset = AVURLAsset(url: inputURL)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        guard !videoTracks.isEmpty else {
            return .init(status: "failed", framesProcessed: 0, outputURL: nil, audioPreserved: false, warnings: ["No video track found."])
        }
        return .init(status: "ready", framesProcessed: 0, outputURL: outputURL, audioPreserved: !audioTracks.isEmpty, warnings: ["Native frame decoding/filtering/writing must execute in the platform target."])
    }
}
