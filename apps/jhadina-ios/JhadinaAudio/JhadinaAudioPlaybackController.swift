import AVFoundation
import MediaPlayer
import Foundation

/// Optional native Music host. This file is not in the current Safety app target.
/// The signed iOS Music target must wire playback tickets, background mode, and UI explicitly.
@MainActor
final class JhadinaAudioPlaybackController {
    struct Ticket {
        let mediaId: String
        let url: URL
        let expiresAt: Date?
    }

    enum PlaybackFailure: Error {
        case invalidAuthorizedURL
        case expiredAuthorization
    }

    private var player: AVPlayer?
    private var activeTicket: Ticket?
    private let remote = MPRemoteCommandCenter.shared()
    private let nowPlaying = MPNowPlayingInfoCenter.default()

    init() {
        // Register only supported transport controls. Next/previous remain disabled
        // until the native host has an authenticated queue coordinator.
        remote.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.play() }
            return .success
        }
        remote.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.pause() }
            return .success
        }
        remote.nextTrackCommand.isEnabled = false
        remote.previousTrackCommand.isEnabled = false
    }

    func load(_ ticket: Ticket, title: String, artist: String, positionSeconds: Double = 0) throws {
        guard ticket.url.scheme?.lowercased() == "https",
              ticket.url.host != nil,
              ticket.url.user == nil,
              ticket.url.password == nil else {
            throw PlaybackFailure.invalidAuthorizedURL
        }
        if let expires = ticket.expiresAt, expires.timeIntervalSinceNow <= 15 {
            throw PlaybackFailure.expiredAuthorization
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP, .allowAirPlay])
        try session.setActive(true)

        player?.pause()
        activeTicket = ticket
        player = AVPlayer(url: ticket.url)
        nowPlaying.nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: artist,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, positionSeconds),
            MPNowPlayingInfoPropertyPlaybackRate: 0,
        ]
        if positionSeconds > 0 {
            player?.seek(to: CMTime(seconds: positionSeconds, preferredTimescale: 600))
        }
    }

    func play() {
        guard let ticket = activeTicket,
              ticket.expiresAt == nil || ticket.expiresAt!.timeIntervalSinceNow > 0 else {
            pause()
            return
        }
        player?.play()
        nowPlaying.nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 1
    }

    func pause() {
        player?.pause()
        nowPlaying.nowPlayingInfo?[MPNowPlayingInfoPropertyPlaybackRate] = 0
    }

    func stopAndDiscardTicket() {
        player?.pause()
        player = nil
        activeTicket = nil
        nowPlaying.nowPlayingInfo = nil
        // Session ownership is coordinated by the future native host so that
        // shutting down Music cannot disrupt Jhadina voice or other audio clients.
    }
}
