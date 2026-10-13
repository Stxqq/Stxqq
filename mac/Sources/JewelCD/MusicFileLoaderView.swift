import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct MusicFileLoaderView: View {
    @State private var selectedAudioFiles: [URL] = []

    var body: some View {
        VStack(spacing: 20) {
            Text("CD-App: Musikdateien hinzufügen")
                .font(.headline)

            // Button zum Öffnen des Auswahldialogs
            Button("MP3-Dateien auswählen...") {
                openFileSelector()
            }
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(8)

            // Liste der ausgewählten Dateien anzeigen
            List(selectedAudioFiles, id: \.self) { fileURL in
                HStack {
                    Image(systemName: "music.note")
                    Text(fileURL.lastPathComponent) // Zeigt nur den Dateinamen an
                        .font(.body)
                }
            }
            .frame(height: 200)

            if !selectedAudioFiles.isEmpty {
                Button("Für CD brennen / verarbeiten") {
                    processFiles()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .frame(width: 400, height: 350)
    }

    // Funktion zum Öffnen des NSOpenPanels
    func openFileSelector() {
        let panel = NSOpenPanel()
        panel.title = "MP3-Dateien auswählen"
        panel.allowedContentTypes = [
            UTType.mp3,
            UTType.audio // Erlaubt generell Audiodateien wie WAV, M4A etc.
        ]
        panel.allowsMultipleSelection = true // Erlaubt das Auswählen mehrerer Dateien
        panel.canChooseFiles = true
        panel.canChooseDirectories = false

        // Öffnet das Fenster im asynchronen Modus (macOS)
        panel.begin { response in
            if response == .OK {
                // Zugriff der vorherigen Auswahl wieder freigeben
                for url in selectedAudioFiles {
                    url.stopAccessingSecurityScopedResource()
                }
                // Das Starten des Access-Schutzes für Sandbox-Umgebungen (wichtig für macOS Apps)
                for url in panel.urls {
                    _ = url.startAccessingSecurityScopedResource()
                }

                // Dateien zur Liste hinzufügen
                selectedAudioFiles = panel.urls
            }
        }
    }

    func processFiles() {
        // Hier kannst du mit den URLs (`url`) weiterarbeiten (z.B. für deine CD-Brenn-Logik)
        for url in selectedAudioFiles {
            print("Verarbeite Datei: \(url.path)")
        }
    }
}
