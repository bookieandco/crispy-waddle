import AVFoundation

/// Native bridge for Music Core audio-output routing.
/// iOS owns Bluetooth/AirPlay pairing and permission prompts.
final class JhadinaAudioOutputBridge {
    private let session = AVAudioSession.sharedInstance()

    init() throws {
        try session.setCategory(.playback, mode: .default, options: [.allowBluetoothA2DP, .allowAirPlay])
        try session.setActive(true)
    }

    func listOutputs() -> [[String: Any]] {
        session.currentRoute.outputs.map { output in
            [
                "id": output.uid,
                "name": output.portName,
                "kind": kind(for: output.portType),
                "connected": true,
                "active": true,
            ]
        }
    }

    func activeOutput() -> [String: Any]? {
        listOutputs().first
    }

    private func kind(for port: AVAudioSession.Port) -> String {
        switch port {
        case .builtInSpeaker, .builtInReceiver: return "device"
        case .bluetoothA2DP, .bluetoothHFP, .bluetoothLE: return "bluetooth"
        case .carAudio: return "car"
        case .airPlay: return "airplay"
        default: return "device"
        }
    }
}
