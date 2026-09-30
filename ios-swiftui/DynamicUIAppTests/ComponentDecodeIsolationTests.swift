import XCTest
@testable import DynamicUIAppCore

/// Proves the crash-prevention property docs/architecture-review.md calls
/// out explicitly: one malformed component object in `screens[].components`
/// must never take down the rest of the screen. This is the test for the
/// `FailableComponent`/two-stage decode mechanism in `Screen.swift`.
final class ComponentDecodeIsolationTests: XCTestCase {
    func testOneMalformedComponentBecomesAPlaceholderWithoutDroppingSiblings() throws {
        let json = """
        {
          "screenId": "home",
          "title": "Home",
          "style": { "backgroundToken": "surface.default", "statusBarStyle": "auto" },
          "components": [
            {
              "componentId": "header",
              "type": "header",
              "componentVersion": 1,
              "enabled": true,
              "style": { "backgroundToken": "surface.transparent" },
              "props": {}
            },
            {
              "componentId": "broken_one",
              "type": "quickActions",
              "componentVersion": "not-a-number",
              "enabled": true,
              "style": { "backgroundToken": "surface.default" },
              "props": {}
            },
            {
              "componentId": "rewards_hub",
              "type": "rewardsHub",
              "componentVersion": 1,
              "enabled": true,
              "style": { "backgroundToken": "surface.default" },
              "props": {}
            }
          ]
        }
        """.data(using: .utf8)!

        let screen = try JSONDecoder().decode(Screen.self, from: json)

        XCTAssertEqual(screen.components.count, 3, "the malformed component must be replaced, not dropped or fatal")
        XCTAssertEqual(screen.components[0].componentId, "header")
        XCTAssertFalse(screen.components[0].decodeFailed)

        let placeholder = screen.components[1]
        XCTAssertEqual(placeholder.componentId, "broken_one")
        XCTAssertTrue(placeholder.decodeFailed)
        if case .unsupported = placeholder.type {} else { XCTFail("placeholder must render as .unsupported") }

        XCTAssertEqual(screen.components[2].componentId, "rewards_hub")
        XCTAssertFalse(screen.components[2].decodeFailed)
    }

    func testAnEntirelyGarbledComponentStillYieldsAPlaceholder() throws {
        let json = """
        {
          "screenId": "home",
          "title": "Home",
          "style": { "backgroundToken": "surface.default", "statusBarStyle": "auto" },
          "components": [ { "not": "a component at all" } ]
        }
        """.data(using: .utf8)!

        let screen = try JSONDecoder().decode(Screen.self, from: json)
        XCTAssertEqual(screen.components.count, 1)
        XCTAssertTrue(screen.components[0].decodeFailed)
        XCTAssertTrue(screen.components[0].componentId.hasPrefix("unrecoverable-"))
    }

    func testMalformedItemInAnItemGroupIsDroppedWithoutFailingTheComponent() throws {
        let json = """
        {
          "title": { "kind": "literal", "value": "Quick Actions" },
          "items": [
            { "id": "ok_one", "label": { "kind": "literal", "value": "OK" } },
            { "id": 12345 },
            { "id": "ok_two", "label": { "kind": "literal", "value": "OK 2" } }
          ]
        }
        """.data(using: .utf8)!

        let props = try JSONDecoder().decode(ComponentProps.self, from: json)
        XCTAssertEqual(props.items?.count, 2, "the malformed item (non-string id) should be dropped, not fail the whole array")
        XCTAssertEqual(props.items?.map(\.id), ["ok_one", "ok_two"])
    }
}
