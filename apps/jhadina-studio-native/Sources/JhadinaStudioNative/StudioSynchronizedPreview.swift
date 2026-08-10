import Foundation

public struct StudioPreviewSnapshot: Sendable, Equatable {
    public let playheadSeconds: Double
    public let transport: StudioTransportSnapshot
    public let audioClipIDs: [String]
    public let lipSyncJobIDs: [String]
}

public final class StudioSynchronizedPreview {
    private let transport: StudioTransport
    private let audioTimeline: StudioAudioTimeline
    private let lipSyncBridge: StudioLipSyncTimelineBridge

    public init(transport: StudioTransport = StudioTransport(), audioTimeline: StudioAudioTimeline = StudioAudioTimeline(), lipSyncBridge: StudioLipSyncTimelineBridge = StudioLipSyncTimelineBridge()) {
        self.transport = transport
        self.audioTimeline = audioTimeline
        self.lipSyncBridge = lipSyncBridge
    }

    public func play(from seconds: Double? = nil) -> StudioPreviewSnapshot {
        let state = transport.play(from: seconds)
        return snapshot(state)
    }

    public func pause() -> StudioPreviewSnapshot {
        let state = transport.pause()
        return snapshot(state)
    }

    public func stop() -> StudioPreviewSnapshot {
        let state = transport.stop()
        return snapshot(state)
    }

    public func scrub(to seconds: Double) -> StudioPreviewSnapshot {
        let state = transport.scrub(to: seconds)
        return snapshot(state)
    }

    public func setRate(_ rate: Double) -> StudioPreviewSnapshot {
        let state = transport.setRate(rate)
        return snapshot(state)
    }

    public func snapshot() -> StudioPreviewSnapshot {
        snapshot(transport.snapshot())
    }

    private func snapshot(_ transportSnapshot: StudioTransportSnapshot) -> StudioPreviewSnapshot {
        let clips = audioTimeline.tracks.flatMap(\.clips).filter { clip in
            let end = clip.startSeconds + clip.durationSeconds
            return transportSnapshot.playheadSeconds >= clip.startSeconds && transportSnapshot.playheadSeconds < end && !clip.muted
        }
        let jobs = lipSyncBridge.jobs(from: audioTimeline).filter { job in
            let end = job.startSeconds + job.durationSeconds
            return transportSnapshot.playheadSeconds >= job.startSeconds && transportSnapshot.playheadSeconds < end
        }
        return StudioPreviewSnapshot(playheadSeconds: transportSnapshot.playheadSeconds, transport: transportSnapshot, audioClipIDs: clips.map(\.id), lipSyncJobIDs: jobs.map(\.id))
    }
}
