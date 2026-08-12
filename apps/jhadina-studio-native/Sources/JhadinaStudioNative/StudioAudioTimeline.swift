import Foundation

public enum StudioAudioTrackKind: String, Codable, Sendable {
    case dialogue
    case music
    case sfx
    case ambience
    case midi
}

public struct StudioAudioClip: Codable, Sendable, Identifiable, Equatable {
    public let id: String
    public let assetURL: URL
    public let startSeconds: Double
    public let durationSeconds: Double
    public let sourceStartSeconds: Double
    public let characterId: String?
    public var gainDb: Double
    public var muted: Bool
    public var solo: Bool
    public var metadata: [String: String]

    public init(id: String, assetURL: URL, startSeconds: Double, durationSeconds: Double, sourceStartSeconds: Double = 0, characterId: String? = nil, gainDb: Double = 0, muted: Bool = false, solo: Bool = false, metadata: [String: String] = [:]) {
        self.id = id
        self.assetURL = assetURL
        self.startSeconds = startSeconds
        self.durationSeconds = durationSeconds
        self.sourceStartSeconds = sourceStartSeconds
        self.characterId = characterId
        self.gainDb = gainDb
        self.muted = muted
        self.solo = solo
        self.metadata = metadata
    }
}

public struct StudioAudioTrack: Codable, Sendable, Identifiable, Equatable {
    public let id: String
    public let kind: StudioAudioTrackKind
    public var name: String
    public var clips: [StudioAudioClip]

    public init(id: String, kind: StudioAudioTrackKind, name: String, clips: [StudioAudioClip] = []) {
        self.id = id
        self.kind = kind
        self.name = name
        self.clips = clips
    }
}

public struct StudioAudioTimeline: Codable, Sendable, Equatable {
    public var sampleRateHz: Int
    public var bitDepth: Int
    public var tracks: [StudioAudioTrack]

    public init(sampleRateHz: Int = 48_000, bitDepth: Int = 24, tracks: [StudioAudioTrack] = []) {
        self.sampleRateHz = sampleRateHz
        self.bitDepth = bitDepth
        self.tracks = tracks
    }

    public func dialogueClips(for characterId: String) -> [StudioAudioClip] {
        tracks.filter { $0.kind == .dialogue }.flatMap(\.clips).filter { $0.characterId == characterId }
    }
}
