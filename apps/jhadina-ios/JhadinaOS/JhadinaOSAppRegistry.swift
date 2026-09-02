import Foundation
import SwiftUI

struct JhadinaAppDescriptor: Identifiable, Hashable {
    let id: String
    let title: String
    let symbol: String
}

@MainActor
final class JhadinaOSAppRegistry: ObservableObject {
    @Published private(set) var apps: [JhadinaAppDescriptor] = [
        .init(id: "memory", title: "Memory", symbol: "brain.head.profile"),
        .init(id: "money", title: "Money", symbol: "dollarsign.circle.fill"),
        .init(id: "media", title: "Media", symbol: "play.rectangle.fill"),
        .init(id: "overage", title: "Overage", symbol: "building.columns.fill"),
        .init(id: "music", title: "Music", symbol: "music.note"),
        .init(id: "directoros", title: "DirectorOS", symbol: "film.fill"),
        .init(id: "pupsonstuff", title: "Pupson", symbol: "pawprint.fill"),
        .init(id: "social", title: "Social", symbol: "bubble.left.and.bubble.right.fill"),
        .init(id: "government", title: "Gov", symbol: "building.2.fill"),
        .init(id: "files", title: "Files", symbol: "folder.fill"),
        .init(id: "developer", title: "Developer", symbol: "hammer.fill"),
        .init(id: "home", title: "Home", symbol: "house.fill"),
        .init(id: "safety", title: "Safety", symbol: "shield.fill"),
    ]

    func descriptor(for id: String) -> JhadinaAppDescriptor? {
        apps.first { $0.id == id }
    }
}
