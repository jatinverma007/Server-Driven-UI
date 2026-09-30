import XCTest
@testable import DynamicUIAppCore

final class SchemaCompatibilityTests: XCTestCase {
    func testSameMajorDifferentMinorIsCompatible() {
        XCTAssertEqual(SchemaCompatibility.check(schemaVersion: "2.7.3", supportedMajor: 2), .compatible)
    }

    func testDifferentMajorIsIncompatible() {
        guard case .incompatibleMajorVersion(let got, let supported) = SchemaCompatibility.check(schemaVersion: "3.0.0", supportedMajor: 2) else {
            return XCTFail("expected incompatibleMajorVersion")
        }
        XCTAssertEqual(got, "3.0.0")
        XCTAssertEqual(supported, 2)
    }

    func testUnparseableVersionFailsClosed() {
        guard case .unparseableVersion(let raw) = SchemaCompatibility.check(schemaVersion: "not-a-version", supportedMajor: 2) else {
            return XCTFail("expected unparseableVersion")
        }
        XCTAssertEqual(raw, "not-a-version")
        XCTAssertFalse(SchemaCompatibility.isCompatible(schemaVersion: "not-a-version", supportedMajor: 2))
    }
}

final class MinAppVersionValidatorTests: XCTestCase {
    func testInstalledEqualToRequiredIsSatisfied() {
        XCTAssertEqual(MinAppVersionValidator.check(installedVersion: "1.5.65", requiredVersion: "1.5.65"), .satisfied)
    }

    func testInstalledNewerThanRequiredIsSatisfied() {
        XCTAssertEqual(MinAppVersionValidator.check(installedVersion: "2.0.0", requiredVersion: "1.5.65"), .satisfied)
    }

    func testInstalledOlderThanRequiredIsTooOld() {
        guard case .tooOld(let installed, let required) = MinAppVersionValidator.check(installedVersion: "1.4.0", requiredVersion: "1.5.65") else {
            return XCTFail("expected tooOld")
        }
        XCTAssertEqual(installed, "1.4.0")
        XCTAssertEqual(required, "1.5.65")
    }

    func testUnparseableVersionsFailClosed() {
        guard case .unparseable = MinAppVersionValidator.check(installedVersion: "nope", requiredVersion: "1.0.0") else {
            return XCTFail("expected unparseable")
        }
    }
}

final class SemVerTests: XCTestCase {
    func testParsesValidVersion() {
        let v = SemVer("1.5.65")
        XCTAssertEqual(v?.major, 1)
        XCTAssertEqual(v?.minor, 5)
        XCTAssertEqual(v?.patch, 65)
    }

    func testRejectsMalformedStrings() {
        XCTAssertNil(SemVer("1.5"))
        XCTAssertNil(SemVer("1.5.x"))
        XCTAssertNil(SemVer("v1.5.0"))
    }

    func testOrdering() {
        XCTAssertTrue(SemVer("1.5.0")! < SemVer("1.5.1")!)
        XCTAssertTrue(SemVer("1.5.0")! < SemVer("1.6.0")!)
        XCTAssertTrue(SemVer("1.5.0")! < SemVer("2.0.0")!)
        XCTAssertFalse(SemVer("2.0.0")! < SemVer("1.9.9")!)
    }
}
