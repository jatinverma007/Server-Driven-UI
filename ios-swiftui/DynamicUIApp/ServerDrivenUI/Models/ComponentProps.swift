import Foundation

public enum HeaderSubDetailTextType: String, Codable, Sendable { case plainText = "plain_text", badge }

public struct HeaderRightAction: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let icon: AssetRef
    public let actionId: String
    public let badgeCountField: String?
}

public struct HeaderSubDetailVariant: Codable, Equatable, Sendable {
    public let audience: AudienceRule
    public let textType: HeaderSubDetailTextType?
    public let valueBinding: TextValue
    public let icon: AssetRef?
    public let actionId: String?
}

public struct HeaderSubDetails: Codable, Equatable, Sendable {
    public let variants: [HeaderSubDetailVariant]
}

/// Mirrors `ComponentProps`. The wire schema marks this `additionalProperties: true`
/// (docs/json-migration-plan.md notes this was intentional headroom for
/// future component-specific fields); `JSONDecoder` already ignores unknown
/// keys by default for a `CodingKeys`-driven `Decodable`, so no extra work
/// is needed to tolerate them — they are simply not represented here.
///
/// Item-group arrays and `rightActions` decode per-element failably (see
/// `DecodingUtilities.swift`) so one malformed item never drops an entire
/// component's content.
public struct ComponentProps: Equatable, Sendable {
    public let title: TextValue?
    public let nameField: String?
    public let profileImageField: String?
    public let rightActions: [HeaderRightAction]?
    public let subDetails: HeaderSubDetails?
    public let dataSourceId: String?
    public let topItems: [ComponentItem]?
    public let items: [ComponentItem]?
    public let bottomItems: [ComponentItem]?

    public init(
        title: TextValue? = nil, nameField: String? = nil, profileImageField: String? = nil,
        rightActions: [HeaderRightAction]? = nil, subDetails: HeaderSubDetails? = nil,
        dataSourceId: String? = nil, topItems: [ComponentItem]? = nil, items: [ComponentItem]? = nil,
        bottomItems: [ComponentItem]? = nil
    ) {
        self.title = title; self.nameField = nameField; self.profileImageField = profileImageField
        self.rightActions = rightActions; self.subDetails = subDetails; self.dataSourceId = dataSourceId
        self.topItems = topItems; self.items = items; self.bottomItems = bottomItems
    }
}

extension ComponentProps: Codable {
    private enum CodingKeys: String, CodingKey {
        case title, nameField, profileImageField, rightActions, subDetails, dataSourceId, topItems, items, bottomItems
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decodeIfPresent(TextValue.self, forKey: .title)
        nameField = try c.decodeIfPresent(String.self, forKey: .nameField)
        profileImageField = try c.decodeIfPresent(String.self, forKey: .profileImageField)
        rightActions = try c.decodeFailableArrayIfPresent([HeaderRightAction].self, forKey: .rightActions)
        subDetails = try c.decodeIfPresent(HeaderSubDetails.self, forKey: .subDetails)
        dataSourceId = try c.decodeIfPresent(String.self, forKey: .dataSourceId)
        topItems = try c.decodeFailableArrayIfPresent([ComponentItem].self, forKey: .topItems)
        items = try c.decodeFailableArrayIfPresent([ComponentItem].self, forKey: .items)
        bottomItems = try c.decodeFailableArrayIfPresent([ComponentItem].self, forKey: .bottomItems)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(nameField, forKey: .nameField)
        try c.encodeIfPresent(profileImageField, forKey: .profileImageField)
        try c.encodeIfPresent(rightActions, forKey: .rightActions)
        try c.encodeIfPresent(subDetails, forKey: .subDetails)
        try c.encodeIfPresent(dataSourceId, forKey: .dataSourceId)
        try c.encodeIfPresent(topItems, forKey: .topItems)
        try c.encodeIfPresent(items, forKey: .items)
        try c.encodeIfPresent(bottomItems, forKey: .bottomItems)
    }
}
