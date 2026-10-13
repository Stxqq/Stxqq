import SwiftUI

/// The CD: cover printed on a black disc inside a clear case, spinning while music plays.
struct DiscView: View {
    var artwork: NSImage?
    var spinning: Bool
    @State private var angle: Double = 0
    @State private var last = Date()

    var body: some View {
        GeometryReader { geo in
            let s = min(geo.size.width, geo.size.height)
            ZStack {
                // clear case
                RoundedRectangle(cornerRadius: s * 0.05)
                    .fill(Color.white.opacity(0.35))
                    .overlay(RoundedRectangle(cornerRadius: s * 0.05).strokeBorder(Color.gray.opacity(0.45), lineWidth: 2))
                    .overlay(RoundedRectangle(cornerRadius: s * 0.04).strokeBorder(Color.gray.opacity(0.25), lineWidth: 1).padding(s * 0.035))
                    .shadow(color: .black.opacity(0.18), radius: 24, x: 10, y: 18)

                TimelineView(.animation(paused: !spinning)) { ctx in
                    disc(size: s * 0.82)
                        .rotationEffect(.degrees(spinAngle(ctx.date)))
                }
            }
            .frame(width: s, height: s)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func spinAngle(_ now: Date) -> Double {
        let dt = now.timeIntervalSince(last)
        DispatchQueue.main.async {
            if spinning { angle = (angle + dt * 160).truncatingRemainder(dividingBy: 360) }
            last = now
        }
        return angle
    }

    @ViewBuilder
    private func disc(size: CGFloat) -> some View {
        ZStack {
            Circle().fill(Color.black)
            Group {
                if let artwork {
                    Image(nsImage: artwork).resizable().scaledToFill()
                } else {
                    LinearGradient(colors: [.pink, .purple, .black], startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            }
            .frame(width: size * 0.965, height: size * 0.965)
            .clipShape(Circle())
            // sheen
            Circle()
                .fill(AngularGradient(colors: [.clear, .white.opacity(0.35), .clear, .clear, .white.opacity(0.25), .clear], center: .center))
                .blendMode(.screen)
            // clear hub with rings and the hole
            Circle().fill(Color.black).frame(width: size * 0.37)
            Circle().fill(Color(white: 0.85).opacity(0.9)).frame(width: size * 0.31)
            Circle().strokeBorder(Color.gray.opacity(0.6), lineWidth: 1.5).frame(width: size * 0.23)
            Circle().fill(Color(nsColor: .windowBackgroundColor)).frame(width: size * 0.11)
            Circle().strokeBorder(Color.gray.opacity(0.6), lineWidth: 1.5).frame(width: size * 0.11)
            Circle().strokeBorder(Color(white: 0.85), lineWidth: 2).frame(width: size)
        }
        .frame(width: size, height: size)
    }
}
