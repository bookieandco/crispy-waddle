import NetworkExtension

/// Native iOS Network Extension boundary for Jhadina Privacy.
///
/// This is deliberately a safe scaffold: it does not invent a VPN protocol,
/// credentials, or remote endpoint. The selected tunnel engine is plugged in
/// behind this lifecycle once the Xcode target and entitlements are configured.
final class PacketTunnelProvider: NEPacketTunnelProvider {
    override func startTunnel(options: [String : NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        // TODO: Load a validated, native-only tunnel profile and configure
        // NEPacketTunnelNetworkSettings before starting the selected engine.
        completionHandler(nil)
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        // TODO: Stop the native tunnel engine and release packet resources.
        completionHandler()
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)? = nil) {
        // Keep app-extension messages narrowly scoped. Never accept raw
        // credentials or arbitrary commands from the AI/web layer.
        completionHandler?(nil)
    }
}
