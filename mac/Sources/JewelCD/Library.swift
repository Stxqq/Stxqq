import Foundation

/// A CD in the Mac app: a Spotify link (playlist, album or track) the user pasted.
struct CDEntry: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var uri: String          // spotify:playlist:… / spotify:album:… / spotify:track:…
}

enum SpotifyLink {
    /// Turns "https://open.spotify.com/playlist/61pS…?si=…" (or a spotify: URI) into "spotify:playlist:61pS…".
    static func uri(from text: String) -> String? {
        let s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let kinds = ["playlist", "album", "track", "artist"]
        if s.hasPrefix("spotify:") {
            let parts = s.split(separator: ":")
            return parts.count >= 3 && kinds.contains(String(parts[1])) ? s : nil
        }
        guard let url = URL(string: s), let host = url.host, host.contains("spotify.com") else { return nil }
        // path can be /playlist/ID or /intl-de/playlist/ID
        let comps = url.pathComponents.filter { $0 != "/" }
        guard let i = comps.firstIndex(where: { kinds.contains($0) }), i + 1 < comps.count else { return nil }
        return "spotify:\(comps[i]):\(comps[i + 1])"
    }

    static func kindName(_ uri: String) -> String {
        switch uri.split(separator: ":").dropFirst().first {
        case "playlist": return "Playlist"
        case "album": return "Album"
        case "track": return "Song"
        case "artist": return "Künstler"
        default: return "Spotify"
        }
    }
}

final class Library: ObservableObject {
    @Published var cds: [CDEntry] = [] { didSet { save() } }
    private let key = "jewel.cds"

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let list = try? JSONDecoder().decode([CDEntry].self, from: data) {
            cds = list
        }
    }

    @discardableResult
    func add(link: String, title: String) -> CDEntry? {
        guard let uri = SpotifyLink.uri(from: link) else { return nil }
        let name = title.trimmingCharacters(in: .whitespaces).isEmpty ? "Spotify-\(SpotifyLink.kindName(uri))" : title
        let cd = CDEntry(title: name, uri: uri)
        cds.append(cd)
        return cd
    }

    func remove(_ cd: CDEntry) { cds.removeAll { $0.id == cd.id } }

    private func save() {
        if let data = try? JSONEncoder().encode(cds) { UserDefaults.standard.set(data, forKey: key) }
    }
}
