import XCTest
@testable import DynamicUIAppCore

/// `TileShape` is deliberately native chrome, not schema-driven (see
/// `docs/component-catalog.md`'s "Corner radius / tile shape / gradients"
/// section) — these lock in the two concrete values every icon tile in
/// the seeded catalog actually uses today: `quickActions`' `.rounded`
/// (`DSRadius.card`, 16pt) and `rechargeBills`' `.circular` (half the
/// tile's own size, i.e. a true circle at the 56pt tile size).
final class TileShapeTests: XCTestCase {
    func testRoundedShapeUsesDSRadiusCardRegardlessOfTileSize() {
        XCTAssertEqual(TileShape.rounded.cornerRadius(forTileSize: 56), DSRadius.card)
        XCTAssertEqual(TileShape.rounded.cornerRadius(forTileSize: 40), DSRadius.card)
    }

    func testCircularShapeIsAlwaysHalfTheTileSize() {
        XCTAssertEqual(TileShape.circular.cornerRadius(forTileSize: 56), 28)
        XCTAssertEqual(TileShape.circular.cornerRadius(forTileSize: 40), 20)
    }
}
