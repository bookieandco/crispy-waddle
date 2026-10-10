import SwiftUI
import AVFoundation
import MediaPlayer

/// Authenticated native Music controller for the existing Jhadina iPhone shell.
/// It never accepts a raw user-supplied URL or caches provider bearer tokens.
@MainActor
final class JhadinaNativeMusicModel: ObservableObject {
    @Published private(set) var title = "No authorized track selected"
    @Published private(set) var artist = "Jhadina Music"
    @Published private(set) var isReady = false
    @Published private(set) var isPlaying = false
    @Published private(set) var error: String?

    private let playback = JhadinaAudioPlaybackController()

    /// Entry point for the future authenticated native Music API client.
    /// Caller must verify the user's entitlement and expiration before passing the ticket.
    func acceptAuthorizedTicket(
        mediaId: String, httpsUrl: URL, expiresAt: Date?,
        title: String, artist: String, positionSeconds: Double
    ) {
        do {
            try playback.load(
                JhadinaAudioPlaybackController.Ticket(mediaId: mediaId, url: httpsUrl, expiresAt: expiresAt),
                title: title, artist: artist, positionSeconds: positionSeconds
            )
            self.title = title
            self.artist = artist
            self.isReady = true
            self.isPlaying = false
            self.error = nil
        } catch {
            stop()
            self.error = "The authorized audio ticket could not be loaded."
        }
    }

    func play() {
        guard isReady else { return }
        playback.play()
        isPlaying = true
    }

    func pause() {
        playback.pause()
        isPlaying = false
    }

    func stop() {
        playback.stopAndDiscardTicket()
        isReady = false
        isPlaying = false
        title = "No authorized track selected"
    }
}

struct JhadinaMusicNativeView: View {
    @StateObject private var music = JhadinaNativeMusicModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "music.note.house.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)
                Text(music.title).font(.title3.bold())
                Text(music.artist).font(.subheadline).foregroundStyle(.secondary)
                Text("Sign in and select an authorized track from Jhadina Music to enable native playback.")
                    .font(.footnote).multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                HStack(spacing: 26) {
                    Button("Play", systemImage: "play.fill") { music.play() }
                        .disabled(!music.isReady || music.isPlaying)
                    Button("Pause", systemImage: "pause.fill") { music.pause() }
                        .disabled(!music.isReady || !music.isPlaying)
                    Button("Stop", systemImage: "stop.fill") { music.stop() }
                        .disabled(!music.isReady)
                }.buttonStyle(.bordered)
                if let error = music.error {
                    Text(error).font(.caption).foregroundStyle(.red)
                }
                HStack {
                    Text("Audio output")
                    Spacer()
                    JhadinaAirPlayRoutePicker().frame(width: 44, height: 44)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Music")
        }
    }
}

/// iOS owns the AirPlay/Bluetooth route picker; the app cannot force pairing.
private struct JhadinaAirPlayRoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> MPVolumeView {
        let picker = MPVolumeView(frame: .zero)
        picker.showsVolumeSlider = false
        picker.showsRouteButton = true
        return picker
    }
    func updateUIView(_ view: MPVolumeView, context: Context) {}
}
