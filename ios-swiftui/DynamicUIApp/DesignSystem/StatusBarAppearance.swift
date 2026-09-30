import SwiftUI
import UIKit

/// Bridges `Screen.style.statusBarStyle` (a schema-driven, three-value enum
/// — `auto` / `lightContent` / `darkContent`) to the real system status bar
/// appearance. Pure SwiftUI's App lifecycle has no built-in per-screen
/// status bar API, so this uses the standard "invisible child view
/// controller" bridge: a `UIHostingController` asks its child view
/// controllers for `preferredStatusBarStyle` before falling back to its own
/// default, and a `UIViewControllerRepresentable` embedded anywhere in the
/// view tree becomes exactly such a child — even sized to zero, with
/// nothing drawn.
///
/// Why this exists at all: `HomeScreenRenderer` extends the hero gradient
/// behind the status bar (`.ignoresSafeArea(edges: .top)`), so a screen
/// with a saturated brand-color band at the top (Figma `HANDOVER--PAY` node
/// 5382:6295 — white "9:40"/signal/battery glyphs sitting directly on the
/// red wash) needs *light* (white) status bar content to stay legible,
/// which the system's own default (dark content) is not. `statusBarStyle`
/// was already a decoded schema field before this — it was just never
/// wired to anything.
private struct StatusBarStyleHost: UIViewControllerRepresentable {
    let style: UIStatusBarStyle

    func makeUIViewController(context: Context) -> StatusBarStyleHostingController {
        StatusBarStyleHostingController(style: style)
    }

    func updateUIViewController(_ uiViewController: StatusBarStyleHostingController, context: Context) {
        uiViewController.style = style
    }
}

private final class StatusBarStyleHostingController: UIViewController {
    var style: UIStatusBarStyle {
        didSet {
            guard oldValue != style else { return }
            setNeedsStatusBarAppearanceUpdate()
        }
    }

    init(style: UIStatusBarStyle) {
        self.style = style
        super.init(nibName: nil, bundle: nil)
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { style }
}

public extension View {
    /// Sets the real system status bar style for as long as this view is
    /// on screen. See `StatusBarStyleHost` above for why a UIKit bridge is
    /// needed at all in a pure SwiftUI app.
    func statusBarStyle(_ style: UIStatusBarStyle) -> some View {
        background(
            StatusBarStyleHost(style: style)
                .frame(width: 0, height: 0)
        )
    }
}

/// Resolves the schema's three-value `StatusBarStyle` to a concrete
/// `UIStatusBarStyle`. `lightContent`/`darkContent` are explicit and pass
/// straight through unconditionally — an author who picked one of those
/// meant exactly that, on every screen, in every color scheme.
///
/// `auto` (the seeded catalog's only value today) defers to whether this
/// screen has a hero gradient at all: every gradient in the seeded theme is
/// a saturated brand color meant to be read against (`hero.header`), so a
/// screen using one needs light (white) status content regardless of
/// light/dark mode — exactly what Figma's own reference shows. A screen
/// with no hero gradient instead mirrors the system color scheme, which is
/// the closest a native client can get to "auto" without a per-screen,
/// designer-authored value in the schema.
public enum StatusBarStyleResolver {
    public static func resolve(_ style: StatusBarStyle, hasHeroGradient: Bool, colorScheme: ColorScheme) -> UIStatusBarStyle {
        switch style {
        case .lightContent:
            return .lightContent
        case .darkContent:
            return .darkContent
        case .auto:
            if hasHeroGradient { return .lightContent }
            return colorScheme == .dark ? .lightContent : .darkContent
        }
    }
}
