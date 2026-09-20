import SwiftUI

@main
struct JhadinaOSApp: App {
    @StateObject private var appRegistry = JhadinaOSAppRegistry()

    var body: some Scene {
        WindowGroup {
            JhadinaHomeView()
                .environmentObject(appRegistry)
        }
    }
}
