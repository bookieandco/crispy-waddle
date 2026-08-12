import Foundation
import AVFoundation
import GPUImage

#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

public struct NativeMoviePipelineMetrics: Sendable {
    public let framesProcessed: Int
    public let durationSeconds: Double
    public let audioPreserved: Bool
    public let firstVideoPTS: Double?
    public let lastVideoPTS: Double?
}

public struct NativeMoviePipelineResult: Sendable {
    public let status: String
    public let outputURL: URL?
    public let metrics: NativeMoviePipelineMetrics
    public let warnings: [String]
}

/// Concrete first-pass file-to-file pipeline:
/// AVAssetReader -> GPUImage2 -> AVAssetWriter.
///
/// The video path uses GPUImage2's platform image bridge for the first executable
/// implementation. Source presentation timestamps are preserved and the source
/// audio track is muxed independently. The optimized TextureInput/TextureOutput
/// path can replace only `filterPixelBuffer` later to remove the image round-trip.
public final class AVAssetReaderGPUImageWriterPipeline {
    public init() {}

    public func process(_ request: StudioGPUOperation) async throws -> NativeMoviePipelineResult {
        let asset = AVURLAsset(url: request.assetURL)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)
        guard let videoTrack = videoTracks.first else {
            throw PipelineError.invalidInput("No video track found.")
        }

        let duration = try await asset.load(.duration)
        guard duration.seconds > 0 else {
            throw PipelineError.invalidInput("Input has no duration.")
        }

        try? FileManager.default.removeItem(at: request.outputURL)
        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: request.outputURL, fileType: .mp4)

        let videoReader = AVAssetReaderTrackOutput(
            track: videoTrack,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
        )
        videoReader.alwaysCopiesSampleData = false
        guard reader.canAdd(videoReader) else {
            throw PipelineError.configuration("Cannot add video reader output.")
        }
        reader.add(videoReader)

        let naturalSize = videoTrack.naturalSize
        let width = Int(abs(naturalSize.width))
        let height = Int(abs(naturalSize.height))
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: max(2_000_000, width * height * 8 / 10),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
            ]
        ]
        let videoWriter = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoWriter.expectsMediaDataInRealTime = false
        videoWriter.transform = videoTrack.preferredTransform

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoWriter,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
                kCVPixelBufferIOSurfacePropertiesKey as String: [:]
            ]
        )
        guard writer.canAdd(videoWriter) else {
            throw PipelineError.configuration("Cannot add video writer input.")
        }
        writer.add(videoWriter)

        var audioReader: AVAssetReaderTrackOutput?
        var audioWriter: AVAssetWriterInput?
        if let audioTrack = audioTracks.first {
            let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: nil)
            output.alwaysCopiesSampleData = false
            if reader.canAdd(output) {
                reader.add(output)
                audioReader = output
            }

            let input = AVAssetWriterInput(mediaType: .audio, outputSettings: nil)
            input.expectsMediaDataInRealTime = false
            if writer.canAdd(input) {
                writer.add(input)
                audioWriter = input
            }
        }

        guard reader.startReading() else {
            throw PipelineError.execution(reader.error?.localizedDescription ?? "AVAssetReader failed to start.")
        }
        guard writer.startWriting() else {
            throw PipelineError.execution(writer.error?.localizedDescription ?? "AVAssetWriter failed to start.")
        }

        var frames = 0
        var firstPTS: CMTime?
        var lastPTS: CMTime?
        var sessionStarted = false

        while let sample = videoReader.copyNextSampleBuffer() {
            let pts = CMSampleBufferGetPresentationTimeStamp(sample)
            if firstPTS == nil { firstPTS = pts }
            lastPTS = pts

            guard let sourceBuffer = CMSampleBufferGetImageBuffer(sample) else {
                throw PipelineError.execution("Video sample has no pixel buffer.")
            }

            if !sessionStarted {
                writer.startSession(atSourceTime: pts)
                sessionStarted = true
            }

            let filtered = try filterPixelBuffer(sourceBuffer, operation: request.operation, parameters: request.parameters)
            while !videoWriter.isReadyForMoreMediaData {
                try await Task.sleep(nanoseconds: 1_000_000)
            }
            guard adaptor.append(filtered, withPresentationTime: pts) else {
                throw PipelineError.execution(writer.error?.localizedDescription ?? "Failed to append filtered video frame.")
            }
            frames += 1
        }

        guard frames > 0 else {
            throw PipelineError.execution("Video reader returned no frames.")
        }
        guard reader.status == .completed else {
            throw PipelineError.execution(reader.error?.localizedDescription ?? "Video reader did not complete.")
        }

        videoWriter.markAsFinished()

        if let audioReader, let audioWriter {
            while let sample = audioReader.copyNextSampleBuffer() {
                while !audioWriter.isReadyForMoreMediaData {
                    try await Task.sleep(nanoseconds: 1_000_000)
                }
                guard audioWriter.append(sample) else {
                    throw PipelineError.execution(writer.error?.localizedDescription ?? "Failed to append audio sample.")
                }
            }
            guard audioReader.status == .completed else {
                throw PipelineError.execution(audioReader.error?.localizedDescription ?? "Audio reader did not complete.")
            }
            audioWriter.markAsFinished()
        }

        await writer.finishWriting()
        guard writer.status == .completed else {
            throw PipelineError.execution(writer.error?.localizedDescription ?? "AVAssetWriter did not complete.")
        }

        let metrics = NativeMoviePipelineMetrics(
            framesProcessed: frames,
            durationSeconds: duration.seconds,
            audioPreserved: audioReader != nil && audioWriter != nil,
            firstVideoPTS: firstPTS?.seconds,
            lastVideoPTS: lastPTS?.seconds
        )
        return NativeMoviePipelineResult(status: "complete", outputURL: request.outputURL, metrics: metrics, warnings: [])
    }

    private func filterPixelBuffer(_ pixelBuffer: CVPixelBuffer, operation: String, parameters: [String: Double]) throws -> CVPixelBuffer {
        #if canImport(UIKit)
        guard let image = makeUIImage(from: pixelBuffer) else {
            throw PipelineError.execution("Could not create UIImage from source pixel buffer.")
        }
        let input = PictureInput(image: image)
        let filter = try makeFilter(operation: operation, parameters: parameters)
        let output = PictureOutput()
        var result: UIImage?
        output.imageAvailableCallback = { image in result = image }
        input --> filter --> output
        input.processImage(synchronously: true)
        guard let filteredImage = result, let outputBuffer = makePixelBuffer(from: filteredImage, matching: pixelBuffer) else {
            throw PipelineError.execution("GPUImage2 produced no writable output image.")
        }
        return outputBuffer
        #elseif canImport(AppKit)
        guard let image = makeNSImage(from: pixelBuffer) else {
            throw PipelineError.execution("Could not create NSImage from source pixel buffer.")
        }
        let input = PictureInput(image: image)
        let filter = try makeFilter(operation: operation, parameters: parameters)
        let output = PictureOutput()
        var result: NSImage?
        output.imageAvailableCallback = { image in result = image }
        input --> filter --> output
        input.processImage(synchronously: true)
        guard let filteredImage = result, let outputBuffer = makePixelBuffer(from: filteredImage, matching: pixelBuffer) else {
            throw PipelineError.execution("GPUImage2 produced no writable output image.")
        }
        return outputBuffer
        #else
        throw PipelineError.configuration("No supported platform image bridge is available.")
        #endif
    }

    private func makeFilter(operation: String, parameters: [String: Double]) throws -> BasicOperation {
        switch operation {
        case "blur":
            let filter = GaussianBlur()
            filter.blurRadiusInPixels = Float(parameters["radius"] ?? 2)
            return filter
        case "sharpen":
            let filter = Sharpen()
            filter.sharpness = Float(parameters["amount"] ?? 1)
            return filter
        case "denoise":
            let filter = BilateralBlur()
            filter.distanceNormalizationFactor = Float(parameters["amount"] ?? 8)
            return filter
        case "color", "tone":
            return ColorControls()
        default:
            throw PipelineError.configuration("Unsupported GPUImage2 operation: \(operation)")
        }
    }

    #if canImport(UIKit)
    private func makeUIImage(from pixelBuffer: CVPixelBuffer) -> UIImage? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext(options: nil)
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    private func makePixelBuffer(from image: UIImage, matching source: CVPixelBuffer) -> CVPixelBuffer? {
        let width = CVPixelBufferGetWidth(source)
        let height = CVPixelBufferGetHeight(source)
        var output: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
            kCVPixelBufferIOSurfacePropertiesKey: [:]
        ]
        guard CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &output) == kCVReturnSuccess,
              let output else { return nil }
        CVPixelBufferLockBaseAddress(output, [])
        defer { CVPixelBufferUnlockBaseAddress(output, []) }
        guard let base = CVPixelBufferGetBaseAddress(output), let context = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(output),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ), let cgImage = image.cgImage else { return nil }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return output
    }
    #endif

    #if canImport(AppKit)
    private func makeNSImage(from pixelBuffer: CVPixelBuffer) -> NSImage? {
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext(options: nil)
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return nil }
        return NSImage(cgImage: cgImage, size: NSSize(width: cgImage.width, height: cgImage.height))
    }

    private func makePixelBuffer(from image: NSImage, matching source: CVPixelBuffer) -> CVPixelBuffer? {
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let cgImage = bitmap.cgImage else { return nil }
        let width = CVPixelBufferGetWidth(source)
        let height = CVPixelBufferGetHeight(source)
        var output: CVPixelBuffer?
        let attrs: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
            kCVPixelBufferIOSurfacePropertiesKey: [:]
        ]
        guard CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA, attrs as CFDictionary, &output) == kCVReturnSuccess,
              let output else { return nil }
        CVPixelBufferLockBaseAddress(output, [])
        defer { CVPixelBufferUnlockBaseAddress(output, []) }
        guard let base = CVPixelBufferGetBaseAddress(output), let context = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(output),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
        ) else { return nil }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return output
    }
    #endif
}

private enum PipelineError: LocalizedError {
    case invalidInput(String)
    case configuration(String)
    case execution(String)

    var errorDescription: String? {
        switch self {
        case .invalidInput(let message), .configuration(let message), .execution(let message):
            return message
        }
    }
}
