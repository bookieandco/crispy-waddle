import SwiftUI
import AVFoundation
import MediaPlayer

/// Signed-in iPhone native Music controller. Playback tickets come only from
/// Jhadina's JWT-verified user-scoped API; there is no raw URL entry control.
@MainActor
final class JhadinaNativeMusicModel: ObservableObject {
    @Published private(set) var title = "No authorized track selected"
    @Published private(set) var artist = "Jhadina Music"
    @Published private(set) var isReady = false
    @Published private(set) var isPlaying = false
    @Published private(set) var isSignedIn = false
    @Published private(set) var isBusy = false
    @Published private(set) var tracks: [JhadinaNativeMusicTrack] = []
    @Published private(set) var error: String?

    private let api = JhadinaMusicNativeSession()
    private let playback = JhadinaAudioPlaybackController()
    private var activeTrack: JhadinaNativeMusicTrack?
    private var ticketExpiresAt: Date?
    private var refreshLoop: Task<Void, Never>?

    init() {
        playback.onRemotePlayRequested = { [weak self] in self?.play() }
    }

    func restoreSession() async {
        do {
            try await api.restoreSession()
            isSignedIn = true
            await reloadLibrary()
        } catch {
            isSignedIn = false
        }
    }

    func signIn(email: String, password: String) async {
        guard !isBusy else { return }
        isBusy = true
        error = nil
        defer { isBusy = false }
        do {
            try await api.signIn(email: email, password: password)
            isSignedIn = true
            await reloadLibrary()
        } catch {
            stop()
            isSignedIn = false
            self.error = "Sign-in failed or the Music server is unavailable."
        }
    }

    func reloadLibrary() async {
        guard isSignedIn else { return }
        do { tracks = try await api.library(); error = nil }
        catch { tracks = []; self.error = "Music library is unavailable." }
    }

    func chooseTrack(_ track: JhadinaNativeMusicTrack) async {
        guard isSignedIn else { return }
        isBusy = true
        defer { isBusy = false }
        do {
            let resumeMs = (try? await api.checkpoint(trackId:track.id)) ?? 0
            try await loadTicket(for:track,positionSeconds:Double(resumeMs) / 1000)
            activeTrack = track
        } catch {
            stop()
            self.error = "This track has no current authorized audio ticket."
        }
    }

    private func loadTicket(for track: JhadinaNativeMusicTrack,
                            positionSeconds: Double) async throws {
        let ticket = try await api.ticket(trackId:track.id)
        guard let url = URL(string:ticket.sourceUri) else {
            throw MusicNativeSessionError.ticketUnavailable
        }
        let expiry = ticket.expiresAt.flatMap { JhadinaMusicNativeSession.expirationDate($0) }
        guard let expiry, expiry.timeIntervalSinceNow > 15 else {
            throw MusicNativeSessionError.ticketUnavailable
        }
        try playback.load(
            JhadinaAudioPlaybackController.Ticket(mediaId:track.id,url:url,expiresAt:expiry),
            title:track.title,artist:track.artist,positionSeconds:positionSeconds)
        self.title = track.title
        self.artist = track.artist
        ticketExpiresAt = expiry
        isReady = true
        isPlaying = false
        error = nil
    }

    func play() {
        guard isReady else { return }
        Task { await playWithTicketRenewal() }
    }

    private func playWithTicketRenewal() async {
        guard isReady else { return }
        if let expires = ticketExpiresAt, expires.timeIntervalSinceNow <= 60 {
            guard let activeTrack else { stop(); return }
            do { try await loadTicket(for:activeTrack,
                                      positionSeconds:playback.currentPositionSeconds()) }
            catch { stop(); self.error = "Audio permission has expired. Reconnect to resume."; return }
        }
        playback.play()
        isPlaying = true
        refreshLoop?.cancel()
        refreshLoop = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for:.seconds(80)) }
                catch { return }
                guard !Task.isCancelled else { return }
                await self?.renewWhilePlaying()
            }
        }
    }

    private func renewWhilePlaying() async {
        guard isPlaying, let activeTrack, let expiry = ticketExpiresAt,
              expiry.timeIntervalSinceNow <= 100 else { return }
        do {
            let position = playback.currentPositionSeconds()
            try? await api.saveCheckpoint(trackId:activeTrack.id, positionMs:Int(max(0,position)*1000))
            try await loadTicket(for:activeTrack,positionSeconds:position)
            playback.play()
            isPlaying = true
        } catch {
            stop()
            self.error = "Playback paused because audio authorization could not renew."
        }
    }

    func pause() {
        refreshLoop?.cancel()
        refreshLoop = nil
        playback.pause()
        isPlaying = false
        if let track = activeTrack {
            let positionMs = Int(max(0,playback.currentPositionSeconds()) * 1000)
            Task { try? await api.saveCheckpoint(trackId:track.id, positionMs:positionMs) }
        }
    }

    func stop() {
        refreshLoop?.cancel()
        refreshLoop = nil
        playback.stopAndDiscardTicket()
        ticketExpiresAt = nil
        activeTrack = nil
        isReady = false
        isPlaying = false
        title = "No authorized track selected"
    }

    func signOut() {
        stop()
        api.signOut()
        isSignedIn = false
        tracks = []
        error = nil
    }
}

struct JhadinaMusicNativeView: View {
    @StateObject private var music = JhadinaNativeMusicModel()
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing:20) {
                    Image(systemName:"music.note.house.fill")
                        .font(.system(size:52)).foregroundStyle(.tint)
                        .accessibilityHidden(true)
                    Text(music.title).font(.title3.bold())
                    Text(music.artist).font(.subheadline).foregroundStyle(.secondary)
                    if !music.isSignedIn {
                        Text("Sign in to your Jhadina music library.")
                            .font(.footnote).foregroundStyle(.secondary)
                        TextField("Email",text:$email)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textFieldStyle(.roundedBorder)
                        SecureField("Password",text:$password)
                            .textContentType(.password)
                            .textFieldStyle(.roundedBorder)
                        Button("Sign in") {
                            let pendingPassword = password
                            password = ""
                            Task { await music.signIn(email:email,password:pendingPassword) }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(music.isBusy || email.isEmpty || password.isEmpty)
                        Text("Native sign-in requires the authorized HTTPS Jhadina endpoint configured in the iOS build.")
                            .font(.caption2).foregroundStyle(.secondary)
                    } else {
                        HStack {
                            Button("Refresh library") { Task { await music.reloadLibrary() } }
                            Spacer()
                            Button("Sign out") { music.signOut() }
                        }.buttonStyle(.bordered)
                        ForEach(music.tracks) { track in
                            Button {
                                Task { await music.chooseTrack(track) }
                            } label: {
                                HStack {
                                    VStack(alignment:.leading) {
                                        Text(track.title).font(.subheadline.weight(.semibold))
                                        Text(track.artist).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName:"play.circle")
                                }
                            }
                            .disabled(music.isBusy)
                        }
                        if music.tracks.isEmpty {
                            Text("No tracks found. Import your own catalog on the web. Playback still requires a separately approved audio source.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing:26) {
                        Button("Play",systemImage:"play.fill") { music.play() }
                            .disabled(!music.isReady || music.isPlaying)
                        Button("Pause",systemImage:"pause.fill") { music.pause() }
                            .disabled(!music.isReady || !music.isPlaying)
                        Button("Stop",systemImage:"stop.fill") { music.stop() }
                            .disabled(!music.isReady)
                    }.buttonStyle(.bordered)
                    if let error = music.error {
                        Text(error).font(.caption).foregroundStyle(.red)
                    }
                    HStack {
                        Text("Audio output")
                        Spacer()
                        JhadinaAirPlayRoutePicker().frame(width:44,height:44)
                    }
                }
                .padding()
            }
            .navigationTitle("Music")
            .task { await music.restoreSession() }
        }
    }
}

/// iOS owns the AirPlay/Bluetooth route picker; the app cannot force pairing.
private struct JhadinaAirPlayRoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> MPVolumeView {
        let picker = MPVolumeView(frame:.zero)
        picker.showsVolumeSlider = false
        picker.showsRouteButton = true
        return picker
    }
    func updateUIView(_ view: MPVolumeView,context: Context) {}
}
