import Foundation

public enum StudioMediaCommand: Sendable {
    case adjustColor(asset: URL, output: URL, parameters: [String: String])
    case sharpen(asset: URL, output: URL, amount: String)
    case denoise(asset: URL, output: URL, amount: String)
    case thumbnail(asset: URL, output: URL, parameters: [String: String])
}

public final class StudioMediaCommandRouter {
    private let exporter: StudioVideoExporter

    public init(exporter: StudioVideoExporter = StudioVideoExporter()) {
        self.exporter = exporter
    }

    public func validate(_ command: StudioMediaCommand) async throws -> StudioExportResult {
        switch command {
        case let .adjustColor(asset, output, parameters):
            return try await exporter.validate(.init(inputURL: asset, outputURL: output, operation: "color", parameters: parameters))
        case let .sharpen(asset, output, amount):
            return try await exporter.validate(.init(inputURL: asset, outputURL: output, operation: "sharpen", parameters: ["amount": amount]))
        case let .denoise(asset, output, amount):
            return try await exporter.validate(.init(inputURL: asset, outputURL: output, operation: "denoise", parameters: ["amount": amount]))
        case let .thumbnail(asset, output, parameters):
            return try await exporter.validate(.init(inputURL: asset, outputURL: output, operation: "thumbnail", parameters: parameters))
        }
    }
}
