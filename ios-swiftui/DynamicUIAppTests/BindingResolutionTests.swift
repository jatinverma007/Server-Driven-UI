import XCTest
@testable import DynamicUIAppCore

final class BindingResolutionTests: XCTestCase {
    func testResolvesLiteralTextAsIs() {
        XCTAssertEqual(TextResolution.resolve(.literal("Hello"), context: MockUserProfile.b2c), "Hello")
    }

    func testResolvesKnownBindingPath() {
        XCTAssertEqual(TextResolution.resolve(.binding(path: "user.userName", fallback: "User"), context: MockUserProfile.b2c), "Priya Nair")
    }

    func testFallsBackForUnknownBindingPath() {
        XCTAssertEqual(TextResolution.resolve(.binding(path: "user.unknownField", fallback: "Fallback"), context: MockUserProfile.b2c), "Fallback")
    }

    func testNilTextValueResolvesToEmptyString() {
        XCTAssertEqual(TextResolution.resolve(nil, context: MockUserProfile.b2c), "")
    }

    func testResolvesRemoteAndBundledAssetRefsDirectly() {
        XCTAssertEqual(TextResolution.resolve(.remote(url: "https://example.com/a.png"), context: MockUserProfile.b2c), .remote("https://example.com/a.png"))
        XCTAssertEqual(TextResolution.resolve(.bundled(name: "icon"), context: MockUserProfile.b2c), .bundled("icon"))
    }

    func testPendingAssetRefResolvesToNilPlaceholder() {
        XCTAssertNil(TextResolution.resolve(.pending(ref: "upload_123"), context: MockUserProfile.b2c))
    }

    func testBindingAssetRefFallsBackToStaticFallbackWhenNoOverride() {
        let ref = AssetRef.binding(path: "data.avatarUrl", fallback: .bundled(name: "user_avatar_placeholder"))
        XCTAssertEqual(TextResolution.resolve(ref, context: MockUserProfile.b2c), .bundled("user_avatar_placeholder"))
    }

    func testB2bAndB2cProfilesDivergeOnEnterpriseVsPlanBindings() {
        XCTAssertEqual(TextResolution.resolve(.binding(path: "user.enterpriseName", fallback: ""), context: MockUserProfile.b2b), "Nair Textiles Pvt Ltd")
        XCTAssertEqual(TextResolution.resolve(.binding(path: "user.planName", fallback: ""), context: MockUserProfile.b2c), "Gold")
        XCTAssertEqual(TextResolution.resolve(.binding(path: "user.enterpriseName", fallback: ""), context: MockUserProfile.b2c), "")
    }
}
