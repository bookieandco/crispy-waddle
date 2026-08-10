import Foundation
import AVFoundation

public struct StudioAudioPlaybackState: Sendable, Equatable {
    public let status: String
    public let scheduledClipIds: [String]
    public let warnings: [String]
}

/// Schedules independent Studio audio clips against one shared timeline clock.
/// The UI can use this engine for preview while final mastering remains a
/// separate render operation.
public final class StudioAudioEngine {
    private let engine = AVAudioEngine()
    private var nodes: [String: AVAudioPlayerNode] = [:]

    public init() {}

    public func prepare(_ timeline: StudioAudioTimeline) throws -> StudioAudioPlaybackState {
        stop()
        let validator = StudioAudioTimelineValidator()
        let issues = validator.validate(timeline)
        if issues.contains(where: { $0.severity == "error" }) {
            return .init(status: "blocked", scheduledClipIds: [], warnings: issues.map(\.message))
        }

        let hasSolo = timeline.tracks.contains { $0.clips.contains(where: { $0.solo }) }
        var scheduled: [String] = []
        var warnings = issues.map(\.message)

        for track in timeline.tracks {
            for clip in track.clips {
                if clip.muted { continue }
                if hasSolo && !clip.solo { continue }
                guard FileManager.default.fileExists(atPath: clip.assetURL.path) else {
                    warnings.append("Missing audio asset: \(clip.id)")
                    continue
                }
                let node = AVAudioPlayerNode()
                engine.attach(node)
                do {
                    let file = try AVAudioFile(forReading: clip.assetURL)
                    let format = file.processingFormat
                    engine.connect(node, to: engine.mainMixerNode, format: format)
                    let startFrame = AVAudioFramePosition(max(0, clip.sourceStartSeconds * format.sampleRate))
                    let frameCount = AVAudioFrameCount(max(0, min(clip.durationSeconds, file.duration - clip.sourceStartSeconds) * format.sampleRate))
                    guard frameCount > 0 else {
                        warnings.append("Empty audio clip: \(clip.id)")
                        continue
                    }
                    let gain = pow(10.0, clip.gainDb / 20.0)
                    node.volume = Float(gain)
                    node.scheduleSegment(file, startingFrame: startFrame, frameCount: frameCount, at: nil)
                    nodes[clip.id] = node
                    scheduled.append(clip.id)
                } catch {
                    warnings.append("Could not load audio clip \(clip.id): \(error.localizedDescription)")
                }
            }
        }

        return .init(status: scheduled.isEmpty ? "empty" : "prepared", scheduledClipIds: scheduled, warnings: warnings)
    }

    public func play() throws {
        if !engine.isRunning { try engine.start() }
        nodes.values.forEach { $0.play() }
    }

    public func stop() {
        nodes.values.forEach { $0.stop() }
        nodes.removeAll()
        engine.stop()
        engine.reset()
    }
}
