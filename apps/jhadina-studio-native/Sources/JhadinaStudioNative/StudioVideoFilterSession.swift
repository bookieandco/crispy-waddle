import Foundation
import GPUImage

public final class StudioVideoFilterSession {
    public init() {}

    public func buildFilter(for operation: StudioGPUOperation) throws -> BasicOperation {
        switch operation.operation {
        case "sharpen":
            let filter = Sharpen()
            filter.sharpness = Float(operation.parameters["amount"] ?? 1.0)
            return filter
        case "blur":
            let filter = GaussianBlur()
            filter.blurRadiusInPixels = Float(operation.parameters["radius"] ?? 2.0)
            return filter
        case "denoise":
            let filter = BilateralBlur()
            filter.distanceNormalizationFactor = Float(operation.parameters["amount"] ?? 8.0)
            return filter
        case "tone", "color":
            return ColorControls()
        default:
            throw NSError(domain: "JhadinaStudioNative", code: 400, userInfo: [NSLocalizedDescriptionKey: "Unsupported native filter operation: \(operation.operation)"])
        }
    }
}
