import SwiftUI

struct ContentView: View {
    @StateObject private var library = Library()
    @StateObject private var player = NowPlaying()
    @State private var link = ""
    @State private var name = ""
    @State private var error: String?
    @State private var showFiles = false

    var body: some View {
        HStack(spacing: 0) {
            sidebar
                .frame(width: 280)
                .background(.thinMaterial)
            Divider()
            nowPlaying
                .frame(minWidth: 480)
        }
        .frame(minWidth: 780, minHeight: 520)
        .onAppear { player.start() }
        .sheet(isPresented: $showFiles) {
            VStack(spacing: 0) {
                MusicFileLoaderView()
                Button("Schließen") { showFiles = false }.padding(.bottom, 12)
            }
        }
    }

    // MARK: left: add links + your CDs

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Spotify-Link hinzufügen").font(.headline)
            TextField("https://open.spotify.com/playlist/…", text: $link)
                .textFieldStyle(.roundedBorder)
            TextField("Name der CD (optional)", text: $name)
                .textFieldStyle(.roundedBorder)
            Button {
                if library.add(link: link, title: name) != nil {
                    link = ""; name = ""; error = nil
                } else {
                    error = "Das ist kein Spotify-Link. Kopiere in Spotify: Teilen → Link kopieren."
                }
            } label: {
                Label("Als CD hinzufügen", systemImage: "plus.circle.fill").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(link.trimmingCharacters(in: .whitespaces).isEmpty)
            if let error { Text(error).font(.caption).foregroundStyle(.red) }

            Divider()
            Text("Deine CDs").font(.headline)
            if library.cds.isEmpty {
                Text("Noch keine CD. Füge oben einen Spotify-Link ein.")
                    .font(.callout).foregroundStyle(.secondary)
            }
            List {
                ForEach(library.cds) { cd in
                    HStack {
                        Image(systemName: "opticaldisc.fill").foregroundStyle(.pink)
                        VStack(alignment: .leading) {
                            Text(cd.title).lineLimit(1)
                            Text(SpotifyLink.kindName(cd.uri)).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button { player.play(uri: cd.uri) } label: { Image(systemName: "play.fill") }
                            .buttonStyle(.borderless)
                            .help("In Spotify abspielen")
                    }
                    .contextMenu { Button("Entfernen", role: .destructive) { library.remove(cd) } }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)

            Button("Eigene Musikdateien …") { showFiles = true }
                .buttonStyle(.link)
        }
        .padding(18)
    }

    // MARK: right: the spinning CD

    private var nowPlaying: some View {
        VStack(spacing: 18) {
            DiscView(artwork: player.artwork, spinning: player.isPlaying)
                .padding(.horizontal, 40)
                .padding(.top, 28)

            VStack(spacing: 4) {
                Text(player.source == nil ? "Nichts läuft gerade" : player.title)
                    .font(.title2.weight(.semibold)).lineLimit(1)
                Text(player.source == nil
                     ? "Starte eine CD links oder spiel etwas in Spotify oder Apple Music ab."
                     : "\(player.artist) · \(player.album)")
                    .foregroundStyle(.secondary).lineLimit(1)
                if let src = player.source {
                    Text(src == .spotify ? "Spotify" : "Apple Music")
                        .font(.caption.monospaced()).foregroundStyle(.tertiary)
                }
            }
            .padding(.horizontal, 24)

            if player.source != nil {
                HStack(spacing: 10) {
                    Text(time(player.position)).monospacedDigit().foregroundStyle(.secondary)
                    Slider(value: Binding(get: { player.position },
                                          set: { player.seek(to: $0) }),
                           in: 0...max(1, player.duration))
                    Text("−" + time(max(0, player.duration - player.position))).monospacedDigit().foregroundStyle(.secondary)
                }
                .font(.caption)
                .padding(.horizontal, 40)

                HStack(spacing: 36) {
                    Button { player.previous() } label: { Image(systemName: "backward.fill") }
                    Button { player.playPause() } label: {
                        Image(systemName: player.isPlaying ? "pause.fill" : "play.fill").font(.system(size: 30))
                    }
                    Button { player.next() } label: { Image(systemName: "forward.fill") }
                }
                .font(.system(size: 22))
                .buttonStyle(.plain)
            }

            if let msg = player.message {
                Text("Kein Zugriff auf Spotify/Musik: \(msg)\nErlaube es unter Systemeinstellungen → Datenschutz & Sicherheit → Automation.")
                    .font(.caption).foregroundStyle(.red).multilineTextAlignment(.center).padding(.horizontal, 30)
            }
            Spacer(minLength: 16)
        }
    }

    private func time(_ s: Double) -> String {
        let t = Int(s.isFinite ? s : 0)
        return String(format: "%d:%02d", t / 60, t % 60)
    }
}
