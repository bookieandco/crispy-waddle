import Foundation
import Security

struct JhadinaNativeMusicTrack: Decodable, Identifiable {
    let id: String
    let title: String
    let artist: String
}
struct JhadinaNativePlaybackTicket: Decodable {
    let trackId: String
    let sourceId: String
    let sourceUri: String
    let expiresAt: String?
}
private struct MusicNativeEnvelope<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
}
private struct MusicNativePublicConfig: Decodable {
    let supabaseUrl: String
    let publishableKey: String
}
private struct MusicNativeTrackCatalog: Decodable {
    let tracks: [JhadinaNativeMusicTrack]
}
private struct MusicNativeTokenResponse: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_in: Int
}
enum MusicNativeSessionError: Error {
    case configurationUnavailable
    case unauthorized
    case invalidResponse
    case networkUnavailable
    case ticketUnavailable
}

private final class MusicNoRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

/// Native Supabase Auth session uses the system TLS stack and this-device-only
/// Keychain refresh storage; never stores email password or music bearer tokens
/// in UserDefaults, source metadata, playback URLs or JavaScript.
@MainActor
final class JhadinaMusicNativeSession {
    private let service = "com.jhadina.music.native-refresh"
    private let account = "current"
    private let session = URLSession(configuration: .ephemeral,
                                     delegate: MusicNoRedirectDelegate(), delegateQueue: nil)
    private var accessToken: String?
    private var tokenDeadline: Date = .distantPast
    private var config: MusicNativePublicConfig?

    static func expirationDate(_ input: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: input) ?? ISO8601DateFormatter().date(from: input)
    }

    private var webOrigin: URL? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "JhadinaMusicWebBaseURL") as? String,
              let url = URL(string: value), url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { return nil }
        return url
    }

    private func url(_ path: String, query: [URLQueryItem] = []) throws -> URL {
        guard let webOrigin, var parts = URLComponents(url: webOrigin, resolvingAgainstBaseURL: false)
        else { throw MusicNativeSessionError.configurationUnavailable }
        parts.path = path
        parts.queryItems = query.isEmpty ? nil : query
        guard let result = parts.url else { throw MusicNativeSessionError.configurationUnavailable }
        return result
    }

    private func fetch(_ request: URLRequest) async throws -> Data {
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await session.data(for: request) }
        catch { throw MusicNativeSessionError.networkUnavailable }
        guard let status = (response as? HTTPURLResponse)?.statusCode else {
            throw MusicNativeSessionError.invalidResponse
        }
        if status == 401 || status == 403 { throw MusicNativeSessionError.unauthorized }
        guard (200...299).contains(status) else { throw MusicNativeSessionError.networkUnavailable }
        return data
    }

    private func publicConfig() async throws -> MusicNativePublicConfig {
        if let config { return config }
        var request = URLRequest(url: try url("/api/music/native/config"))
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let data = try await fetch(request)
        let value = try JSONDecoder().decode(MusicNativeEnvelope<MusicNativePublicConfig>.self, from: data)
        guard value.success, let config = value.data,
              let supabase = URL(string: config.supabaseUrl),
              supabase.scheme == "https", supabase.host?.hasSuffix(".supabase.co") == true,
              supabase.user == nil, supabase.password == nil,
              supabase.query == nil, supabase.fragment == nil,
              !config.publishableKey.isEmpty else { throw MusicNativeSessionError.configurationUnavailable }
        self.config = config
        return config
    }

    private func authRequest(grant: String, payload: [String:String]) async throws {
        let config = try await publicConfig()
        guard let base = URL(string: config.supabaseUrl),
              var parts = URLComponents(url: base, resolvingAgainstBaseURL: false)
        else { throw MusicNativeSessionError.configurationUnavailable }
        parts.path = "/auth/v1/token"
        parts.queryItems = [URLQueryItem(name: "grant_type", value: grant)]
        guard let endpoint = parts.url else { throw MusicNativeSessionError.configurationUnavailable }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue(config.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let response = try JSONDecoder().decode(MusicNativeTokenResponse.self, from: try await fetch(request))
        guard !response.access_token.isEmpty, !response.refresh_token.isEmpty,
              response.expires_in > 0 else { throw MusicNativeSessionError.invalidResponse }
        try storeRefreshToken(response.refresh_token)
        accessToken = response.access_token
        tokenDeadline = Date().addingTimeInterval(TimeInterval(response.expires_in))
    }

    func signIn(email: String, password: String) async throws {
        guard email.contains("@"), !password.isEmpty else { throw MusicNativeSessionError.unauthorized }
        try await authRequest(grant:"password",payload:["email":email,"password":password])
    }

    func restoreSession() async throws {
        guard let refreshToken = readRefreshToken() else { throw MusicNativeSessionError.unauthorized }
        do { try await authRequest(grant:"refresh_token",payload:["refresh_token":refreshToken]) }
        catch { signOut(); throw error }
    }

    func signOut() {
        accessToken = nil
        tokenDeadline = .distantPast
        let query: [String:Any] = [
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:service, kSecAttrAccount as String:account
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func bearer() async throws -> String {
        if accessToken == nil || tokenDeadline.timeIntervalSinceNow < 60 {
            try await restoreSession()
        }
        guard let value = accessToken else { throw MusicNativeSessionError.unauthorized }
        return value
    }

    private func authedGET<T: Decodable>(_ path: String,
                                         query: [URLQueryItem] = []) async throws -> T {
        var request = URLRequest(url: try url(path,query:query))
        request.setValue("Bearer " + (try await bearer()), forHTTPHeaderField:"Authorization")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let payload = try await fetch(request)
        let response = try JSONDecoder().decode(MusicNativeEnvelope<T>.self,from:payload)
        guard response.success, let body = response.data else { throw MusicNativeSessionError.invalidResponse }
        return body
    }

    func library() async throws -> [JhadinaNativeMusicTrack] {
        let response: MusicNativeTrackCatalog = try await authedGET("/api/music/native/tracks")
        return response.tracks
    }

    func ticket(trackId: String) async throws -> JhadinaNativePlaybackTicket {
        guard !trackId.isEmpty, trackId.count <= 256 else { throw MusicNativeSessionError.ticketUnavailable }
        let ticket: JhadinaNativePlaybackTicket = try await authedGET(
            "/api/music/native/playback",query:[URLQueryItem(name:"trackId",value:trackId)])
        guard ticket.trackId == trackId, !ticket.sourceId.isEmpty,
              let url = URL(string:ticket.sourceUri),url.scheme == "https",
              url.host != nil,url.user == nil,url.password == nil,url.fragment == nil,
              let expiry = ticket.expiresAt,
              let expiration = Self.expirationDate(expiry),
              expiration.timeIntervalSinceNow > 15 else {
            throw MusicNativeSessionError.ticketUnavailable
        }
        return ticket
    }

    private func storeRefreshToken(_ token: String) throws {
        guard let data = token.data(using:.utf8) else { throw MusicNativeSessionError.invalidResponse }
        let query: [String:Any] = [
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:service,kSecAttrAccount as String:account
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(add as CFDictionary,nil) == errSecSuccess else {
            throw MusicNativeSessionError.configurationUnavailable
        }
    }

    private func readRefreshToken() -> String? {
        let query: [String:Any] = [
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:service,kSecAttrAccount as String:account,
            kSecReturnData as String:true,kSecMatchLimit as String:kSecMatchLimitOne
        ]
        var found: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary,&found) == errSecSuccess,
              let data = found as? Data else { return nil }
        return String(data:data,encoding:.utf8)
    }
}
