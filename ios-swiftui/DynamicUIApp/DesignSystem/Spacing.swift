import CoreGraphics

/// Static layout constants for scaffolding that is NOT part of the
/// server-driven theme (state screens, container padding, corner radii).
/// Anything a component's *appearance* depends on comes from
/// `ThemeResolver`/`theme.tokens` instead — this file exists so those two
/// concerns (native chrome vs. server-driven content) stay visibly separate.
public enum DSSpacing {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let lg: CGFloat = 16
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
}

public enum DSRadius {
    public static let card: CGFloat = 16
    public static let chip: CGFloat = 999
    public static let thumbnail: CGFloat = 12

    /// The white section card behind `quickActions`/`rechargeBills`
    /// (Figma `HANDOVER--PAY` node 5382:6285, e.g. nodes 5382:7481 and
    /// 5382:7608 — both `rounded-[24px]`). Not every component gets this
    /// treatment (`monthlyClaim`'s per-item cards use a smaller radius —
    /// see below), so it's its own constant rather than reusing `card`.
    public static let sectionCard: CGFloat = 24
    /// `quickActions`' bottom chip row (the UPI ID / "Style Your QR"
    /// pills — node 5503:3143/5503:3156, both `rounded-[12px]`).
    public static let chipBar: CGFloat = 12
    /// `rechargeBills`' bottom chip row ("Plan Expired?" / "View More" —
    /// node 5382:7737/5382:7742, both `rounded-[8px]`).
    public static let miniBar: CGFloat = 8
    /// `monthlyClaim`'s per-item status cards (node 5382:7195 "Approved" /
    /// 5382:7223 "Rejected" — both `rounded-[12px]`). `monthlyClaim` has no
    /// section-level card of its own (see `DSRadius.sectionCard`'s doc
    /// comment), so this is its own constant rather than reusing `card`.
    public static let claimCard: CGFloat = 12
}
