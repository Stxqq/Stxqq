// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "JewelCD",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "JewelCD", path: "Sources/JewelCD")
    ]
)
