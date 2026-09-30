import Foundation

public struct ComponentStyle: Codable, Equatable, Sendable {
    public let backgroundToken: String
}

/// Mirrors `Component`. `decodeFailed` is never present on the wire — it is
/// set only by `Screen`'s two-stage decode when this component could not be
/// fully parsed, and `ComponentRegistry` treats it identically to
/// `.unsupported` (renders the safe placeholder view, never crashes, never
/// blanks the rest of the screen). See docs/architecture-review.md, "crash
/// or blank screen" mitigation table, row "malformed component payload".
public struct Component: Equatable, Sendable, Identifiable {
    public let componentId: String
    public let type: ComponentType
    public let componentVersion: Int
    public let enabled: Bool
    public let audience: AudienceRule?
    public let style: ComponentStyle
    public let layout: Layout?
    public let props: ComponentProps
    public let decodeFailed: Bool

    public var id: String { componentId }

    public init(
        componentId: String, type: ComponentType, componentVersion: Int, enabled: Bool,
        audience: AudienceRule? = nil, style: ComponentStyle, layout: Layout? = nil,
        props: ComponentProps, decodeFailed: Bool = false
    ) {
        self.componentId = componentId; self.type = type; self.componentVersion = componentVersion
        self.enabled = enabled; self.audience = audience; self.style = style; self.layout = layout
        self.props = props; self.decodeFailed = decodeFailed
    }

    /// The safe stand-in used when a component object exists in the payload
    /// but failed to decode fully. Keeps whatever identifying fields *could*
    /// be recovered (for logging / a DEBUG-only diagnostic banner) without
    /// ever surfacing partially-decoded, untrusted content.
    static func placeholder(componentId: String, rawType: String, componentVersion: Int, enabled: Bool, backgroundToken: String) -> Component {
        Component(
            componentId: componentId,
            type: .unsupported(rawType: rawType),
            componentVersion: componentVersion,
            enabled: enabled,
            style: ComponentStyle(backgroundToken: backgroundToken),
            props: ComponentProps(),
            decodeFailed: true
        )
    }
}

extension Component: Codable {
    private enum CodingKeys: String, CodingKey {
        case componentId, type, componentVersion, enabled, audience, style, layout, props
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        componentId = try c.decode(String.self, forKey: .componentId)
        type = try c.decode(ComponentType.self, forKey: .type)
        componentVersion = try c.decode(Int.self, forKey: .componentVersion)
        enabled = try c.decode(Bool.self, forKey: .enabled)
        audience = try c.decodeIfPresent(AudienceRule.self, forKey: .audience)
        style = try c.decode(ComponentStyle.self, forKey: .style)
        layout = try c.decodeIfPresent(Layout.self, forKey: .layout)
        props = try c.decode(ComponentProps.self, forKey: .props)
        decodeFailed = false
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(componentId, forKey: .componentId)
        try c.encode(type, forKey: .type)
        try c.encode(componentVersion, forKey: .componentVersion)
        try c.encode(enabled, forKey: .enabled)
        try c.encodeIfPresent(audience, forKey: .audience)
        try c.encode(style, forKey: .style)
        try c.encodeIfPresent(layout, forKey: .layout)
        try c.encode(props, forKey: .props)
    }
}
