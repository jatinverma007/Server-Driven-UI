/**
 * The data-source allowlist. See docs/architecture-review.md §6 — no
 * `endpoint`/`method`/URL ever appears in the wire format. `dataSourceId` is
 * an opaque, catalog-checked string; the URL/verb/response-shape live only
 * here (server-side) and, on the client, in the native `DataSourceRegistry`
 * that maps the same ids to compiled-in repository calls.
 */
export interface DataSourceCatalogEntry {
  id: string;
  label: string;
  description: string;
  /** Where this maps in THIS backend's own mock API (never sent to the client). */
  mockEndpoint: string;
  responseShape: string;
}

export const DATA_SOURCE_CATALOG: DataSourceCatalogEntry[] = [
  {
    id: "invites.pending",
    label: "Pending card-activation invite",
    description: "The current user's pending invite to activate a card, if any (migrated from legacy `user_response` endpoint).",
    mockEndpoint: "/api/v1/mock-data/invites/pending",
    responseShape: "{ invitedUserName: string; inviteMobileNo: string; avatarUrl?: string } | null",
  },
  {
    id: "banners.large",
    label: "Large banner carousel",
    description: "Promotional banners for the large (top) carousel slot.",
    mockEndpoint: "/api/v1/mock-data/banners/large",
    responseShape: "{ banners: { id: string; imageUrl: string; actionId?: string }[] }",
  },
  {
    id: "banners.small",
    label: "Small banner carousel",
    description: "Promotional banners for the small (lower) carousel slot.",
    mockEndpoint: "/api/v1/mock-data/banners/small",
    responseShape: "{ banners: { id: string; imageUrl: string; actionId?: string }[] }",
  },
  {
    id: "claims.monthlySummary",
    label: "Monthly claim summary",
    description: "This month's approved/rejected claim totals (B2B).",
    mockEndpoint: "/api/v1/claims/monthly-summary",
    responseShape: "{ approvedAmount: string; rejectedAmount: string; currency: string; approvedCount: number; rejectedCount: number }",
  },
];

export const DATA_SOURCE_IDS = new Set(DATA_SOURCE_CATALOG.map((d) => d.id));
export function isKnownDataSource(id: string): boolean {
  return DATA_SOURCE_IDS.has(id);
}
