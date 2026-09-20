import AppIntents

struct AskJhadinaIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask Jhadina"
    static let description = IntentDescription("Send a request to JhadinaOS and let Jhadina route it through governed capabilities.")
    static let openAppWhenRun = true

    @Parameter(title: "Request")
    var request: String

    func perform() async throws -> some IntentResult {
        // Day-one contract: invocation enters JhadinaOS rather than bypassing policy.
        // The native bridge will forward this request to the authenticated Jhadina command endpoint.
        return .result()
    }
}

struct JhadinaShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        [
            AppShortcut(
                intent: AskJhadinaIntent(),
                phrases: [
                    "Ask Jhadina",
                    "Ask Jhadina to do something",
                    "Tell Jhadina something",
                ],
                shortTitle: "Ask Jhadina",
                systemImageName: "brain.head.profile"
            )
        ]
    }
}
