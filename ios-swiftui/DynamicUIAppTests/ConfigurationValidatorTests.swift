import XCTest
@testable import DynamicUIAppCore

final class ConfigurationValidatorTests: XCTestCase {
    func testValidConfigurationIsAcceptable() {
        let config = TestFixtures.minimalConfiguration()
        guard case .acceptable = ConfigurationValidator.validate(config, supportedSchemaMajor: 2) else {
            return XCTFail("expected .acceptable")
        }
    }

    func testIncompatibleSchemaMajorIsRejected() {
        let config = TestFixtures.minimalConfiguration(schemaVersion: "3.0.0")
        guard case .reject(let reasons) = ConfigurationValidator.validate(config, supportedSchemaMajor: 2) else {
            return XCTFail("expected .reject")
        }
        XCTAssertTrue(reasons.contains { $0.code == "E_INCOMPATIBLE_SCHEMA_VERSION" })
    }

    func testEmptyScreensArrayIsRejected() {
        var config = TestFixtures.minimalConfiguration()
        config = HomeScreenConfiguration(
            configurationId: config.configurationId, schemaVersion: config.schemaVersion, revision: config.revision,
            status: config.status, environment: config.environment, publishedAt: nil, createdAt: nil, updatedAt: nil,
            cache: config.cache, platformConstraints: config.platformConstraints, theme: config.theme,
            appIcons: config.appIcons, navigation: config.navigation, screens: []
        )
        guard case .reject(let reasons) = ConfigurationValidator.validate(config, supportedSchemaMajor: 2) else {
            return XCTFail("expected .reject")
        }
        XCTAssertTrue(reasons.contains { $0.code == "E_NO_SCREENS" })
    }

    func testDuplicateComponentIdOnSameScreenIsRejected() {
        let header = Component(componentId: "dup", type: .header, componentVersion: 1, enabled: true, style: ComponentStyle(backgroundToken: "surface.default"), props: ComponentProps())
        let quick = Component(componentId: "dup", type: .quickActions, componentVersion: 1, enabled: true, style: ComponentStyle(backgroundToken: "surface.default"), props: ComponentProps())
        var config = TestFixtures.minimalConfiguration()
        let screen = Screen(screenId: "home", title: "Home", style: config.screens[0].style, components: [header, quick])
        config = HomeScreenConfiguration(
            configurationId: config.configurationId, schemaVersion: config.schemaVersion, revision: config.revision,
            status: config.status, environment: config.environment, publishedAt: nil, createdAt: nil, updatedAt: nil,
            cache: config.cache, platformConstraints: config.platformConstraints, theme: config.theme,
            appIcons: config.appIcons, navigation: config.navigation, screens: [screen]
        )
        guard case .reject(let reasons) = ConfigurationValidator.validate(config, supportedSchemaMajor: 2) else {
            return XCTFail("expected .reject")
        }
        XCTAssertTrue(reasons.contains { $0.code == "E_DUPLICATE_COMPONENT_ID" })
    }

    func testUnsupportedComponentTypeIsOnlyAWarningNotAReject() {
        let unsupported = Component(componentId: "x", type: .unsupported(rawType: "someNewWidget"), componentVersion: 1, enabled: true, style: ComponentStyle(backgroundToken: "surface.default"), props: ComponentProps())
        var config = TestFixtures.minimalConfiguration()
        let screen = Screen(screenId: "home", title: "Home", style: config.screens[0].style, components: [unsupported])
        config = HomeScreenConfiguration(
            configurationId: config.configurationId, schemaVersion: config.schemaVersion, revision: config.revision,
            status: config.status, environment: config.environment, publishedAt: nil, createdAt: nil, updatedAt: nil,
            cache: config.cache, platformConstraints: config.platformConstraints, theme: config.theme,
            appIcons: config.appIcons, navigation: config.navigation, screens: [screen]
        )
        guard case .acceptable(let warnings) = ConfigurationValidator.validate(config, supportedSchemaMajor: 2) else {
            return XCTFail("an unknown component type must degrade gracefully, not reject the whole configuration")
        }
        XCTAssertTrue(warnings.contains { $0.code == "W_UNSUPPORTED_COMPONENT_TYPE" })
    }
}
