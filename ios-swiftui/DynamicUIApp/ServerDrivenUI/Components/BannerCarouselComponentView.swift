import SwiftUI
import UIKit

/// Renders `type: "bannerCarousel"`. Static `props.items` are the source of
/// truth for the Figma large-banner slot. Until its distinct datasource is
/// implemented, the Large Banner uses the local defaults rather than the
/// legacy `banners.small` response. Other banner carousel components continue
/// to support their configured datasource.
struct BannerCarouselComponentView: View {
    let component: Component
    let context: RenderContext

    @State private var banners: [Banner] = []

    var body: some View {
        Group {
            if component.componentId == "small_banner" {
                SmallBannerCarousel(banners: banners, context: context)
            } else if let items = component.props.items, !items.isEmpty {
                StaticBannerCarousel(items: items, context: context)
            } else if component.componentId == "large_banner" {
                DefaultBannerCarousel(context: context)
            } else if !banners.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: DSSpacing.sm) {
                        ForEach(banners) { banner in
                            Button {
                                context.actionRegistry.perform(actionId: banner.actionId)
                            } label: {
                                AsyncAssetImage(resolved: .remote(banner.imageUrl), size: 140, cornerRadius: DSRadius.card)
                                    .frame(width: 320, height: 120)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, DSSpacing.lg)
                }
            }
        }
        .task(id: component.props.dataSourceId) {
            guard component.props.items?.isEmpty ?? true else { return }
            guard component.componentId != "large_banner" else { return }
            guard let rawId = component.props.dataSourceId else { return }
            let id = DataSourceID(dataSourceId: rawId)
            banners = await context.dataSourceRegistry.fetchBanners(for: id)
        }
    }
}

/// Figma node 4908:3352 is a compact, lower-page promotional slot rather
/// than the 340×112 Large Banner. Its content is pre-composed by the trusted
/// data source, so this renderer owns only the fixed 340×64 card geometry,
/// scrolling and safe action dispatch. The two bundled cards are a local
/// design fallback until the source supplies at least two wide creatives.
private struct SmallBannerCarousel: View {
    let banners: [Banner]
    let context: RenderContext

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DSSpacing.md) {
                if banners.count >= 2 {
                    ForEach(banners) { banner in
                        SmallBannerCard(banner: banner, context: context)
                    }
                } else {
                    ForEach(SmallBannerFallback.all) { banner in
                        SmallBannerFallbackCard(banner: banner, context: context)
                    }
                }
            }
            .padding(.horizontal, DSSpacing.lg)
            .padding(.vertical, DSSpacing.sm)
        }
    }
}

/// `banners.small` currently returns one square asset, while the Figma slot
/// is a horizontal carousel. Keep both local creatives visible for reliable
/// development preview; a published response with two or more banner entries
/// replaces this fallback without a renderer change.
private struct SmallBannerFallback: Identifiable {
    let id: String
    let assetName: String
    let actionId: String
    let accessibilityLabel: String

    static let all: [SmallBannerFallback] = [
        .init(id: "small_shop_online", assetName: "banner_small_shop_online", actionId: "open_omnis", accessibilityLabel: "Shop online rewards"),
        .init(id: "small_bill_pay", assetName: "banner_small_bill_pay", actionId: "mobile_recharge", accessibilityLabel: "Bill payment rewards"),
    ]
}

private struct SmallBannerFallbackCard: View {
    let banner: SmallBannerFallback
    let context: RenderContext

    var body: some View {
        Button {
            context.actionRegistry.perform(actionId: banner.actionId)
        } label: {
            ZStack {
                SmallBannerSurface()
                BannerArtwork(asset: .bundled(banner.assetName))
                    .frame(width: 340, height: 64)
                    .clipped()
            }
            .frame(width: 340, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: DSRadius.card))
            .shadow(color: .black.opacity(0.1), radius: 1, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(banner.accessibilityLabel)
    }
}

private struct SmallBannerCard: View {
    let banner: Banner
    let context: RenderContext

    var body: some View {
        Button {
            context.actionRegistry.perform(actionId: banner.actionId)
        } label: {
            ZStack {
                SmallBannerSurface()
                BannerArtwork(asset: .remote(banner.imageUrl))
                    .frame(width: 340, height: 64)
                    .clipped()
            }
            .frame(width: 340, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: DSRadius.card))
            .shadow(color: .black.opacity(0.1), radius: 1, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Promotional banner")
    }
}

private struct SmallBannerSurface: View {
    var body: some View {
        LinearGradient(
            colors: [Color(red: 0.89, green: 0.86, blue: 1.0), Color(red: 0.96, green: 0.94, blue: 1.0)],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
}

/// Figma `image 70` (node 5382:6498) is a 340×112, 16pt-radius banner.
/// This keeps the card geometry in native code while taking the banner copy,
/// action, media reference, and colors from the configured item. When the
/// final artwork is uploaded, replacing `media.leading` with its remote asset
/// requires no renderer change.
private struct StaticBannerCarousel: View {
    let items: [ComponentItem]
    let context: RenderContext

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DSSpacing.md) {
                ForEach(items) { item in
                    StaticBannerCard(item: item, context: context)
                }
            }
            .padding(.horizontal, DSSpacing.lg)
            .padding(.vertical, DSSpacing.sm)
        }
    }
}

private struct StaticBannerCard: View {
    let item: ComponentItem
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let label = TextResolution.resolve(item.label, context: context.bindingContext)
        let subtitle = item.subtitle.map { TextResolution.resolve($0, context: context.bindingContext) } ?? ""
        let meta = item.meta.map { TextResolution.resolve($0, context: context.bindingContext) } ?? ""
        let asset = TextResolution.resolve(item.media?.leading, context: context.bindingContext)

        Button {
            context.actionRegistry.perform(actionId: item.actionId)
        } label: {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: DSRadius.card)
                    .fill(context.themeResolver.color(forToken: item.style?.backgroundToken ?? "surface.default", colorScheme: colorScheme))

                BannerArtwork(asset: asset)
                    .frame(width: 340, height: 112)
                    .clipped()

                LinearGradient(
                    colors: [
                        context.themeResolver.color(forToken: item.style?.backgroundToken ?? "surface.default", colorScheme: colorScheme).opacity(0.96),
                        .clear,
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                VStack(alignment: .leading, spacing: 3) {
                    if !meta.isEmpty {
                        Text(meta)
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Color(red: 0.89, green: 0.26, blue: 0.22)))
                    }
                    if !label.isEmpty {
                        Text(label)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color(red: 0.89, green: 0.26, blue: 0.22))
                            .lineLimit(2)
                    }
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.system(size: 9))
                            .foregroundStyle(context.themeResolver.color(forToken: "text.primary", colorScheme: colorScheme))
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: 168, alignment: .leading)
                .padding(DSSpacing.md)
            }
            .frame(width: 340, height: 112)
            .clipShape(RoundedRectangle(cornerRadius: DSRadius.card))
            .shadow(color: .black.opacity(0.15), radius: 1.5, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.accessibilityLabel.map { TextResolution.resolve($0, context: context.bindingContext) } ?? label)
    }
}

/// Image-only artwork for the wide banner background. Unlike icon rendering,
/// this deliberately does not pad or fit the image: the exported 340×112 art
/// is a background with protected text space on its leading side.
private struct BannerArtwork: View {
    let asset: ResolvedAsset?

    var body: some View {
        Group {
            switch asset {
            case .bundled(let name):
                bundledImage(name: name)
            case .remote(let value):
                remoteImage(urlString: value)
            case .none:
                Color.clear
            }
        }
    }

    @ViewBuilder
    private func bundledImage(name: String) -> some View {
        // Swift Package resources are processed into Assets.car in the app
        // bundle, so a raw `Banners/name.png` URL does not exist at runtime.
        // Resolve by catalog name, matching AsyncAssetImage's bundled path.
        if let image = UIImage(named: name, in: .module, compatibleWith: nil) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else if let url = Bundle.module.url(forResource: name, withExtension: "png"),
                  let image = UIImage(contentsOfFile: url.path) {
            // `.process("Resources/Banners")` keeps these wide creatives as
            // bundle files, while the icon catalog uses Assets.car.
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            Color.clear
        }
    }

    @ViewBuilder
    private func remoteImage(urlString: String) -> some View {
        if let url = URL(string: urlString), url.scheme == "https" {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image): image.resizable().scaledToFill()
                default: Color.clear
                }
            }
        } else {
            Color.clear
        }
    }
}

/// The data source is intentionally not implemented yet. These three local
/// cards provide a polished, usable Large Banner state for older published
/// configurations that have no static `items` (or while their fetch is empty).
private struct DefaultBanner: Identifiable {
    let id: String
    let assetName: String
    let meta: String
    let label: String
    let subtitle: String
    let actionId: String
    let backgroundToken: String

    static let all: [DefaultBanner] = [
        .init(id: "default_fastag_recharge", assetName: "banner_fastag", meta: "NEW", label: "FastTag Recharge on OmniCard", subtitle: "Recharge in seconds. Cruise through every journey.", actionId: "fastag", backgroundToken: "banner.fastag.background"),
        .init(id: "default_rewards_offer", assetName: "banner_rewards", meta: "REWARDS", label: "More rewards for you", subtitle: "Earn Omnis and unlock exclusive offers.", actionId: "open_omnis", backgroundToken: "banner.rewards.background"),
        .init(id: "default_recharge_reminder", assetName: "banner_recharge", meta: "RECHARGE", label: "Bills made simple", subtitle: "Recharge on time and stay connected.", actionId: "mobile_recharge", backgroundToken: "banner.recharge.background"),
    ]
}

private struct DefaultBannerCarousel: View {
    let context: RenderContext

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DSSpacing.md) {
                ForEach(DefaultBanner.all) { banner in
                    DefaultBannerCard(banner: banner, context: context)
                }
            }
            .padding(.horizontal, DSSpacing.lg)
            .padding(.vertical, DSSpacing.sm)
        }
    }
}

private struct DefaultBannerCard: View {
    let banner: DefaultBanner
    let context: RenderContext
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button {
            context.actionRegistry.perform(actionId: banner.actionId)
        } label: {
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: DSRadius.card)
                    .fill(context.themeResolver.color(forToken: banner.backgroundToken, colorScheme: colorScheme))

                BannerArtwork(asset: .bundled(banner.assetName))
                    .frame(width: 340, height: 112)
                    .clipped()

                LinearGradient(
                    colors: [
                        context.themeResolver.color(forToken: banner.backgroundToken, colorScheme: colorScheme).opacity(0.96),
                        .clear,
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                VStack(alignment: .leading, spacing: 3) {
                    Text(banner.meta)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color(red: 0.89, green: 0.26, blue: 0.22)))
                    Text(banner.label)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color(red: 0.89, green: 0.26, blue: 0.22))
                        .lineLimit(2)
                    Text(banner.subtitle)
                        .font(.system(size: 9))
                        .foregroundStyle(context.themeResolver.color(forToken: "text.primary", colorScheme: colorScheme))
                        .lineLimit(2)
                }
                .frame(maxWidth: 168, alignment: .leading)
                .padding(DSSpacing.md)
            }
            .frame(width: 340, height: 112)
            .clipShape(RoundedRectangle(cornerRadius: DSRadius.card))
            .shadow(color: .black.opacity(0.15), radius: 1.5, x: 0, y: 1)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(banner.label)
    }
}
