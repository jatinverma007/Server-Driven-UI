import Foundation

public enum LayoutOrientation: String, Codable, Sendable { case horizontal, vertical }
public enum LayoutViewType: String, Codable, Sendable { case fixed, scroll }
public enum LayoutItemSizing: String, Codable, Sendable { case intrinsic, fillViewport, pagedFullWidth }

/// Mirrors `Layout`. Every field optional — components apply sensible
/// per-type defaults when absent (see each view in `ServerDrivenUI/Components`).
public struct Layout: Codable, Equatable, Sendable {
    public let orientation: LayoutOrientation?
    public let viewType: LayoutViewType?
    public let itemSizing: LayoutItemSizing?
    public let columns: Int?

    public init(orientation: LayoutOrientation? = nil, viewType: LayoutViewType? = nil, itemSizing: LayoutItemSizing? = nil, columns: Int? = nil) {
        self.orientation = orientation; self.viewType = viewType; self.itemSizing = itemSizing; self.columns = columns
    }
}
