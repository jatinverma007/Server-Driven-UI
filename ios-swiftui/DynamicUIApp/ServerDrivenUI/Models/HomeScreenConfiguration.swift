import Foundation

public enum ConfigStatus: String, Codable, Sendable { case draft, published, archived }
public enum ConfigEnvironment: String, Codable, Sendable { case development, staging, production }

public struct MinAppVersion: Codable, Equatable, Sendable {
    public let ios: String
    public let android: String
}

public struct PlatformConstraints: Codable, Equatable, Sendable {
    public let minAppVersion: MinAppVersion
}

public struct CacheSpec: Codable, Equatable, Sendable {
    public let maxAgeSeconds: Int
}

/// Mirrors `HomeScreenConfiguration`, the schema's root object — identical
/// field-for-field to `frontend/src/types/homeScreen.ts`'s
/// `HomeScreenConfiguration`. This is the ONLY shape iOS ever renders from;
/// it always arrives already wrapped in the `/published` envelope
/// (`ServerDrivenUI/Models/PublishedEnvelope.swift`), never a draft (see
/// `docs/api-contract.md`, "The ONLY endpoint iOS calls").
public struct HomeScreenConfiguration: Codable, Equatable, Sendable {
    public let configurationId: String
    public let schemaVersion: String
    public let revision: Int
    public let status: ConfigStatus
    public let environment: ConfigEnvironment
    public let publishedAt: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let cache: CacheSpec?
    public let platformConstraints: PlatformConstraints
    public let theme: ThemeSpec
    public let appIcons: AppIconsSpec
    public let navigation: NavigationSpec
    public let screens: [Screen]
}

/// The response body of `GET /api/v1/configurations/home/published`
/// (see docs/api-contract.md). `revision`/`publishedAt` here are the
/// server's authoritative envelope values (kept even though they're also
/// inside `content`, since the two are guaranteed consistent server-side —
/// see `frontend/src/lib/configuration/repository.ts` `publish()`).
public struct PublishedEnvelope: Codable, Equatable, Sendable {
    public let content: HomeScreenConfiguration
    public let revision: Int
    public let publishedAt: String
}
