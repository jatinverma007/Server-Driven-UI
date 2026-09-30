import XCTest
@testable import DynamicUIAppCore

final class ModelDecodingTests: XCTestCase {
    func testDecodesTheFullValidFixture() throws {
        let config = try JSONDecoder().decode(HomeScreenConfiguration.self, from: TestFixtures.data(named: "home-screen.valid"))
        XCTAssertEqual(config.configurationId, "cfg_home_v2_seed")
        XCTAssertEqual(config.schemaVersion, "2.0.0")
        XCTAssertEqual(config.screens.count, 1)
        XCTAssertEqual(config.screens[0].components.count, 8)
        XCTAssertTrue(config.screens[0].components.allSatisfy { !$0.decodeFailed })
        XCTAssertTrue(config.navigation.bottom.contains { $0.id == "scan_pay" && $0.variant == .elevatedCenter })
    }

    func testTextValueLiteralAndBindingRoundTrip() throws {
        let literal = try roundTrip(TextValue.literal("Hello"))
        XCTAssertEqual(literal, .literal("Hello"))

        let binding = try roundTrip(TextValue.binding(path: "user.userName", fallback: "User"))
        XCTAssertEqual(binding, .binding(path: "user.userName", fallback: "User"))
    }

    func testAssetRefAllFourKindsRoundTrip() throws {
        XCTAssertEqual(try roundTrip(AssetRef.remote(url: "https://example.com/a.png")), .remote(url: "https://example.com/a.png"))
        XCTAssertEqual(try roundTrip(AssetRef.bundled(name: "icon")), .bundled(name: "icon"))
        XCTAssertEqual(try roundTrip(AssetRef.pending(ref: "upload_1")), .pending(ref: "upload_1"))
        let binding = AssetRef.binding(path: "data.avatarUrl", fallback: .bundled(name: "placeholder"))
        XCTAssertEqual(try roundTrip(binding), binding)
    }

    func testComponentTypeUnknownStringDecodesToUnsupportedRatherThanThrowing() throws {
        let json = "\"someBrandNewWidgetType\"".data(using: .utf8)!
        let type = try JSONDecoder().decode(ComponentType.self, from: json)
        guard case .unsupported(let raw) = type else {
            return XCTFail("expected .unsupported, got \(type)")
        }
        XCTAssertEqual(raw, "someBrandNewWidgetType")
    }

    func testComponentPropsIgnoresAdditionalUnknownKeys() throws {
        let json = """
        { "title": { "kind": "literal", "value": "Hi" }, "someFutureField": { "nested": true } }
        """.data(using: .utf8)!
        let props = try JSONDecoder().decode(ComponentProps.self, from: json)
        XCTAssertEqual(props.title, .literal("Hi"))
    }

    func testThemeGradientsDecodeAndAnOlderThemeWithoutThemDecodesToNilGradients() throws {
        let withGradients = """
        {
          "tokens": { "brand.primary": { "light": "#E44239", "dark": "#E44239" } },
          "gradients": { "hero.header": { "angle": 180, "stops": [
            { "colorToken": "brand.primary", "location": 0.25 },
            { "colorToken": "brand.primary", "location": 0.86 }
          ] } }
        }
        """.data(using: .utf8)!
        let theme = try JSONDecoder().decode(ThemeSpec.self, from: withGradients)
        XCTAssertEqual(theme.gradients?["hero.header"]?.angle, 180)
        XCTAssertEqual(theme.gradients?["hero.header"]?.stops.count, 2)

        // Same shape but from before `gradients` existed — this is the
        // exact wire format a config published prior to this feature has,
        // and it must decode exactly as before (nil, not a decode error).
        let withoutGradients = """
        { "tokens": { "surface.default": { "light": "#FFFFFF", "dark": "#1D1B18" } } }
        """.data(using: .utf8)!
        let olderTheme = try JSONDecoder().decode(ThemeSpec.self, from: withoutGradients)
        XCTAssertNil(olderTheme.gradients)
    }

    func testScreenStyleAndComponentItemStyleDecodeTheNewOptionalGradientFields() throws {
        let screenStyleJSON = """
        { "backgroundToken": "surface.default", "statusBarStyle": "auto", "backgroundGradientToken": "hero.header" }
        """.data(using: .utf8)!
        let screenStyle = try JSONDecoder().decode(ScreenStyle.self, from: screenStyleJSON)
        XCTAssertEqual(screenStyle.backgroundGradientToken, "hero.header")

        // An older ScreenStyle with no backgroundGradientToken at all.
        let olderScreenStyleJSON = """
        { "backgroundToken": "surface.default", "statusBarStyle": "auto" }
        """.data(using: .utf8)!
        let olderScreenStyle = try JSONDecoder().decode(ScreenStyle.self, from: olderScreenStyleJSON)
        XCTAssertNil(olderScreenStyle.backgroundGradientToken)

        let itemStyleJSON = """
        { "backgroundGradientToken": "chip.icon", "borderToken": "chip.border" }
        """.data(using: .utf8)!
        let itemStyle = try JSONDecoder().decode(ComponentItemStyle.self, from: itemStyleJSON)
        XCTAssertEqual(itemStyle.backgroundGradientToken, "chip.icon")
        XCTAssertEqual(itemStyle.borderToken, "chip.border")
        XCTAssertNil(itemStyle.backgroundToken)
    }

    private func roundTrip<T: Codable & Equatable>(_ value: T) throws -> T {
        let data = try JSONEncoder().encode(value)
        return try JSONDecoder().decode(T.self, from: data)
    }
}
