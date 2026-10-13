import AppKit
import Foundation

/// Reads and controls what Spotify or Apple Music is playing, through AppleScript.
/// Nothing is downloaded: playback stays inside the official apps.
final class NowPlaying: ObservableObject {
    enum Source: String { case spotify = "Spotify", music = "Music" }

    @Published var source: Source?
    @Published var title = ""
    @Published var artist = ""
    @Published var album = ""
    @Published var duration: Double = 0      // seconds
    @Published var position: Double = 0      // seconds
    @Published var isPlaying = false
    @Published var artwork: NSImage?
    @Published var message: String?

    private let queue = DispatchQueue(label: "jewel.nowplaying")
    private var timer: Timer?
    private var lastKey = ""

    func start() {
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.poll() }
        poll()
    }

    // MARK: commands

    func play(uri: String) {
        run("tell application \"Spotify\" to play track \"\(uri)\"", then: true)
    }
    func playPause() { send("playpause") }
    func next() { send("next track") }
    func previous() { send("previous track") }
    func seek(to seconds: Double) {
        guard let app = source?.rawValue else { return }
        run("tell application \"\(app)\" to set player position to \(Int(seconds))", then: true)
    }

    private func send(_ command: String) {
        let app = (source ?? .spotify).rawValue
        run("tell application \"\(app)\" to \(command)", then: true)
    }

    private func run(_ script: String, then refresh: Bool) {
        queue.async {
            var error: NSDictionary?
            NSAppleScript(source: script)?.executeAndReturnError(&error)
            if let error {
                let text = error[NSAppleScript.errorMessage] as? String ?? "AppleScript-Fehler"
                DispatchQueue.main.async { self.message = text }
            }
            if refresh { DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.poll() } }
        }
    }

    // MARK: polling

    private static let spotifyScript = """
    if application "Spotify" is running then
      tell application "Spotify"
        set t to current track
        return {name of t, artist of t, album of t, (duration of t) / 1000, player position, (player state as string), artwork url of t}
      end tell
    end if
    return {}
    """

    private static let musicScript = """
    if application "Music" is running then
      tell application "Music"
        if player state is stopped then return {}
        set t to current track
        return {name of t, artist of t, album of t, duration of t, player position, (player state as string), ""}
      end tell
    end if
    return {}
    """

    private func read(_ script: String) -> [String]? {
        var error: NSDictionary?
        guard let result = NSAppleScript(source: script)?.executeAndReturnError(&error), error == nil,
              result.numberOfItems >= 7 else { return nil }
        return (1...7).map { result.atIndex($0)?.stringValue ?? "" }
    }

    private func poll() {
        queue.async {
            let spotify = self.read(Self.spotifyScript)
            let music = self.read(Self.musicScript)
            // prefer the app that is actually playing, then the one we showed last
            var pick: (Source, [String])?
            if let s = spotify, s[5] == "playing" { pick = (.spotify, s) }
            else if let m = music, m[5] == "playing" { pick = (.music, m) }
            else if let s = spotify, self.source != .music { pick = (.spotify, s) }
            else if let m = music { pick = (.music, m) }
            else if let s = spotify { pick = (.spotify, s) }

            guard let picked = pick else {
                DispatchQueue.main.async { self.source = nil; self.isPlaying = false }
                return
            }
            let (src, v) = picked
            let key = src.rawValue + v[0] + v[1]
            let changed = key != self.lastKey
            self.lastKey = key
            var image: NSImage?
            if changed {
                if src == .spotify, let url = URL(string: v[6]), let data = try? Data(contentsOf: url) { image = NSImage(data: data) }
                if src == .music { image = self.musicArtwork() }
            }
            DispatchQueue.main.async {
                self.source = src
                self.title = v[0]; self.artist = v[1]; self.album = v[2]
                self.duration = Double(v[3].replacingOccurrences(of: ",", with: ".")) ?? 0
                self.position = Double(v[4].replacingOccurrences(of: ",", with: ".")) ?? 0
                self.isPlaying = v[5] == "playing"
                if changed { self.artwork = image }
                self.message = nil
            }
        }
    }

    private func musicArtwork() -> NSImage? {
        var error: NSDictionary?
        let script = "tell application \"Music\" to get raw data of artwork 1 of current track"
        guard let d = NSAppleScript(source: script)?.executeAndReturnError(&error), error == nil else { return nil }
        return NSImage(data: d.data)
    }
}
