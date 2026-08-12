import Foundation
import AVFoundation

public final class StudioNativePreviewClock {
    private let audioEngine: AVAudioEngine
    private var playerNodes: [String: AVAudioPlayerNode] = [:]
    private var player: AVPlayer?
    private var timeline: StudioAudioTimeline
    private let transport: StudioTransport

    public init(timeline: StudioAudioTimeline, transport: StudioTransport = StudioTransport()) {
        self.timeline = timeline
        self.transport = transport
        self.audioEngine = AVAudioEngine()
    }

    public func attachVideo(url: URL) {
        player = AVPlayer(url: url)
    }

    public func play(from seconds: Double = 0) throws -> StudioTransportSnapshot {
        try startAudioIfNeeded(at: seconds)
        player?.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
        player?.playImmediately(atRate: Float(transport.snapshot().rate))
        return transport.play(from: seconds)
    }

    public func pause() -> StudioTransportSnapshot {
        audioEngine.pause()
        player?.pause()
        return transport.pause()
    }

    public func stop() -> StudioTransportSnapshot {
        audioEngine.stop()
        player?.pause()
        player?.seek(to: .zero)
        return transport.stop()
    }

    public func scrub(to seconds: Double) -> StudioTransportSnapshot {
        let target = max(0, seconds)
        audioEngine.stop()
        player?.pause()
        player?.seek(to: CMTime(seconds: target, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        return transport.scrub(to: target)
    }

    public func setRate(_ rate: Double) -> StudioTransportSnapshot {
        let snapshot = transport.setRate(rate)
        if snapshot.state == .playing {
            player?.rate = Float(snapshot.rate)
        }
        return snapshot
    }

    private func startAudioIfNeeded(at seconds: Double) throws {
        for track in timeline.tracks {
            for clip in track.clips where !clip.muted {
                let node = playerNodes[clip.id] ?? AVAudioPlayerNode()
                if playerNodes[clip.id] == nil {
                    audioEngine.attach(node)
                    playerNodes[clip.id] = node
                }
                guard let file = try? AVAudioFile(forReading: clip.assetURL) else { continue }
                let sourceOffset = max(0, seconds - clip.startSeconds) + clip.sourceStartSeconds
                let sampleRate = file.processingFormat.sampleRate
                let startFrame = AVAudioFramePosition(sourceOffset * sampleRate)
                let available = max(0, file.length - startFrame)
                guard available > 0 else { continue }
                let requested = min(available, AVAudioFrameCount(clip.durationSeconds * sampleRate))
                node.volume = clip.muted ? 0 : pow(10, Float(clip.gainDb) / 20)
                node.scheduleSegment(file, startingFrame: startFrame, frameCount: requested, at: nil)
            }
        }
        if !audioEngine.isRunning { try audioEngine.start() }
        for node in playerNodes.values { node.play() }
    }
}
