import Foundation
import AVFoundation

public struct StudioMovieExportOutput: Sendable {
    public let status: String
    public let outputURL: URL?
    public let preset: String
    public let warnings: [String]
}

public final class StudioMovieExporter {
    public init() {}

    public func export(inputURL: URL, outputURL: URL, preset: String = AVAssetExportPresetHighestQuality) async throws -> StudioMovieExportOutput {
        let asset = AVURLAsset(url: inputURL)
        let duration = try await asset.load(.duration)
        guard duration.seconds > 0 else {
            return .init(status: "failed", outputURL: nil, preset: preset, warnings: ["Input has no duration."])
        }

        guard let session = AVAssetExportSession(asset: asset, presetName: preset) else {
            return .init(status: "failed", outputURL: nil, preset: preset, warnings: ["Requested export preset is unavailable on this device."])
        }

        try? FileManager.default.removeItem(at: outputURL)
        session.outputURL = outputURL
        session.outputFileType = .mp4
        await session.export()

        switch session.status {
        case .completed:
            return .init(status: "complete", outputURL: outputURL, preset: preset, warnings: [])
        case .failed:
            return .init(status: "failed", outputURL: nil, preset: preset, warnings: [session.error?.localizedDescription ?? "Export failed."])
        case .cancelled:
            return .init(status: "cancelled", outputURL: nil, preset: preset, warnings: ["Export was cancelled."])
        default:
            return .init(status: "failed", outputURL: nil, preset: preset, warnings: ["Export ended in unexpected state: \(session.status.rawValue)"])
        }
    }
}
