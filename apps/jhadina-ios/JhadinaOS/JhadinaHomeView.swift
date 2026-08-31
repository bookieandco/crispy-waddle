import SwiftUI

struct JhadinaHomeView: View {
    @EnvironmentObject private var registry: JhadinaOSAppRegistry
    @State private var selectedApp: JhadinaAppDescriptor?
    @State private var showingAskJhadina = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 18), count: 3)

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color(.systemBackground), Color(.secondarySystemBackground)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        Text("JHADINAOS")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .tracking(2)
                            .padding(.top, 18)

                        LazyVGrid(columns: columns, spacing: 24) {
                            ForEach(registry.apps) { app in
                                Button {
                                    selectedApp = app
                                } label: {
                                    VStack(spacing: 9) {
                                        Image(systemName: app.symbol)
                                            .font(.system(size: 27, weight: .semibold))
                                            .frame(width: 64, height: 64)
                                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
                                        Text(app.title)
                                            .font(.caption.weight(.medium))
                                            .foregroundStyle(.primary)
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 18)

                        Button {
                            showingAskJhadina = true
                        } label: {
                            Label("Ask Jhadina", systemImage: "brain.head.profile")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 18)
                        .padding(.bottom, 18)
                    }
                }
            }
            .navigationDestination(item: $selectedApp) { app in
                JhadinaAppPlaceholderView(app: app)
            }
            .sheet(isPresented: $showingAskJhadina) {
                AskJhadinaView()
            }
        }
    }
}

private struct JhadinaAppPlaceholderView: View {
    let app: JhadinaAppDescriptor

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: app.symbol)
                .font(.system(size: 54))
            Text(app.title)
                .font(.largeTitle.bold())
            Text("This is a first-class JhadinaOS app surface. Its domain core and governed capabilities remain behind the OS boundary.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding(30)
        .navigationTitle(app.title)
    }
}

private struct AskJhadinaView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var request = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 54))
                    .padding(.top, 30)

                Text("Ask Jhadina")
                    .font(.largeTitle.bold())

                TextField("What do you want Jhadina to do?", text: $request, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal)

                Button("Send") {
                    // The governed Jhadina command bridge will be connected here.
                }
                .buttonStyle(.borderedProminent)
                .disabled(request.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Spacer()
            }
            .navigationTitle("Jhadina")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
