// swift-tools-version:5.9
import PackageDescription

/// See `README.md` — this package (`DynamicUIAppCore`) is the entire
/// application: every layer from networking down to the SwiftUI views. The
/// only source file NOT in it is `DynamicUIApp/App/DynamicUIApp.swift`,
/// the three-line `@main` entry point that belongs in a thin Xcode app
/// target which depends on this package locally (Xcode, not SPM, is what's
/// needed to produce a signed, runnable iOS app bundle — SPM alone cannot).
let package = Package(
    name: "DynamicUIApp",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "DynamicUIAppCore", targets: ["DynamicUIAppCore"])
    ],
    targets: [
        .target(
            name: "DynamicUIAppCore",
            path: "DynamicUIApp",
            exclude: ["App"],
            resources: [
                .copy("Resources/fallback-home-screen.json"),
                // Compiled by actool into the module's asset catalog —
                // `AsyncAssetImage.bundledImage` already prefers a real
                // catalog hit over `BundledIconCatalog`'s SF Symbol
                // fallback (see that file's doc comment: "a name that is
                // later given a real vector in an asset catalog still
                // wins"), so adding entries here is a drop-in swap with no
                // call-site changes. Currently holds `add_money` (real
                // Figma-supplied artwork for the Quick Actions tile,
                // replacing the `indianrupeesign.square` SF Symbol
                // stand-in) and `profile_avatar_demo` (a demo header
                // avatar — see `HeaderComponentView.avatarImage`).
                .process("Resources/Assets.xcassets"),
                // Wide promotional creatives are kept as processed package
                // resources too; BannerArtwork resolves them with
                // UIImage(named:in:compatibleWith:) from Bundle.module.
                .process("Resources/Banners"),
            ]
        ),
        .testTarget(
            name: "DynamicUIAppTests",
            dependencies: ["DynamicUIAppCore"],
            path: "DynamicUIAppTests",
            resources: [
                .copy("Fixtures")
            ]
        ),
    ]
)
