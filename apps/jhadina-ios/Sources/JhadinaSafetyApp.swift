import SwiftUI

@main
struct JhadinaSafetyApp: App {
    @StateObject private var safety = SafetyNativeRuntime()

    var body: some Scene {
        WindowGroup {
            SafetyStatusView(runtime: safety)
        }
    }
}

struct SafetyStatusView: View {
    @ObservedObject var runtime: SafetyNativeRuntime

    var body: some View {
        NavigationStack {
            List {
                Section("Safety Native Bridge") {
                    LabeledContent("Platform", value: "iOS")
                    LabeledContent("Microphone", value: runtime.microphoneStatus)
                    LabeledContent("Camera", value: runtime.cameraStatus)
                    LabeledContent("Location", value: runtime.locationStatus)
                    LabeledContent("Network", value: runtime.networkReachable ? "reachable" : "unreachable")
                }
                Section("Production gate") {
                    Text("LIVE remains locked until physical drill receipts pass.")
                }
            }
            .navigationTitle("Jhadina Safety")
            .task { await runtime.refreshCapabilities() }
        }
    }
}
