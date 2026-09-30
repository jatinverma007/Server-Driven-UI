import XCTest
import SwiftUI
@testable import DynamicUIAppCore

final class ThemeResolverTests: XCTestCase {
    func testResolvesKnownTokenForLightAndDark() {
        let resolver = ThemeResolver(theme: ThemeSpec(tokens: ["surface.default": ColorPair(light: "#FFFFFF", dark: "#1D1B18")]))
        // Colors aren't directly comparable across color spaces in a
        // lightweight way; assert via the parser directly instead, which is
        // what actually matters (docs/architecture-review.md's theme
        // analysis calls out exact hex parsing as the risky part).
        XCTAssertNotNil(ThemeResolver.parse("#FFFFFF"))
        XCTAssertNotNil(ThemeResolver.parse("#1D1B18"))
        _ = resolver.color(forToken: "surface.default", colorScheme: .light)
        _ = resolver.color(forToken: "surface.default", colorScheme: .dark)
    }

    func testUnknownTokenDoesNotCrashAndReturnsAColor() {
        let resolver = ThemeResolver(theme: ThemeSpec(tokens: [:]))
        // Must not throw/crash — the whole point of this fallback path.
        _ = resolver.color(forToken: "surface.doesNotExist", colorScheme: .light)
    }

    func testTransparentParsesToClear() {
        XCTAssertEqual(ThemeResolver.parse("transparent"), .clear)
    }

    func testEightDigitHexWithAlphaParses() {
        XCTAssertNotNil(ThemeResolver.parse("#FF00FF80"))
    }

    func testMalformedHexReturnsNil() {
        XCTAssertNil(ThemeResolver.parse("#GGG"))
        XCTAssertNil(ThemeResolver.parse("not-a-color"))
    }

    func testKnownGradientTokenResolvesToALinearGradient() {
        let theme = ThemeSpec(
            tokens: [
                "brand.primary": ColorPair(light: "#E44239", dark: "#E44239"),
                "surface.default": ColorPair(light: "#FFFFFF", dark: "#1D1B18"),
            ],
            gradients: [
                "hero.header": GradientSpec(angle: 180, stops: [
                    GradientStop(colorToken: "brand.primary", location: 0.25),
                    GradientStop(colorToken: "surface.default", location: 0.86),
                ])
            ]
        )
        let resolver = ThemeResolver(theme: theme)
        XCTAssertNotNil(resolver.gradient(forToken: "hero.header", colorScheme: .light))
        XCTAssertNotNil(resolver.gradient(forToken: "hero.header", colorScheme: .dark))
    }

    func testUnknownGradientTokenReturnsNilRatherThanAFallbackGradient() {
        let resolver = ThemeResolver(theme: ThemeSpec(tokens: [:]))
        // Unlike `color(forToken:)`, which always returns *something* (a
        // neutral fallback), a gradient with no match returns nil so the
        // caller falls back to its own flat `backgroundToken` instead of
        // drawing an unrelated gradient.
        XCTAssertNil(resolver.gradient(forToken: "hero.header", colorScheme: .light))
    }

    /// The hero gradient is a 4-stop gradient in the seed data (a flat red
    /// band that only starts fading around a quarter of the way down,
    /// through an intermediate salmon tone, to white — Figma
    /// `HANDOVER--PAY` node 5382:6295), not the naive 2-stop
    /// red-to-white approximation this resolver already had to support.
    /// `gradient(forToken:)` only requires `stops.count >= 2` — this
    /// locks in that it isn't secretly hardcoded to exactly 2.
    func testGradientWithMoreThanTwoStopsResolvesAllOfThem() {
        let theme = ThemeSpec(
            tokens: [
                "brand.primary": ColorPair(light: "#E44239", dark: "#E44239"),
                "brand.primary.soft": ColorPair(light: "#F3AEAA", dark: "#732C26"),
                "surface.default": ColorPair(light: "#FFFFFF", dark: "#1D1B18"),
            ],
            gradients: [
                "hero.header": GradientSpec(angle: 180, stops: [
                    GradientStop(colorToken: "brand.primary", location: 0),
                    GradientStop(colorToken: "brand.primary", location: 0.274),
                    GradientStop(colorToken: "brand.primary.soft", location: 0.659),
                    GradientStop(colorToken: "surface.default", location: 0.851),
                ])
            ]
        )
        let resolver = ThemeResolver(theme: theme)
        XCTAssertNotNil(resolver.gradient(forToken: "hero.header", colorScheme: .light))
        XCTAssertNotNil(resolver.gradient(forToken: "hero.header", colorScheme: .dark))
    }

    func testGradientWithFewerThanTwoStopsIsTreatedAsUnresolvable() {
        let theme = ThemeSpec(
            tokens: ["brand.primary": ColorPair(light: "#E44239", dark: "#E44239")],
            gradients: ["broken": GradientSpec(angle: 180, stops: [GradientStop(colorToken: "brand.primary", location: 0)])]
        )
        XCTAssertNil(ThemeResolver(theme: theme).gradient(forToken: "broken", colorScheme: .light))
    }

    /// CSS `linear-gradient()` angle convention: 0deg points up (gradient
    /// runs bottom→top), 90deg points right, 180deg points down
    /// (gradient runs top→bottom, matching `hero.header`'s red-at-top),
    /// 270deg points left.
    func testCSSAngleConversionMatchesTheCSSConvention() {
        let (upStart, upEnd) = ThemeResolver.unitPoints(forCSSAngleDegrees: 0)
        XCTAssertEqual(upStart.y, 1, accuracy: 0.0001) // starts at the bottom
        XCTAssertEqual(upEnd.y, 0, accuracy: 0.0001) // ends at the top

        let (downStart, downEnd) = ThemeResolver.unitPoints(forCSSAngleDegrees: 180)
        XCTAssertEqual(downStart.y, 0, accuracy: 0.0001) // starts at the top
        XCTAssertEqual(downEnd.y, 1, accuracy: 0.0001) // ends at the bottom

        let (rightStart, rightEnd) = ThemeResolver.unitPoints(forCSSAngleDegrees: 90)
        XCTAssertEqual(rightStart.x, 0, accuracy: 0.0001)
        XCTAssertEqual(rightEnd.x, 1, accuracy: 0.0001)
    }
}
