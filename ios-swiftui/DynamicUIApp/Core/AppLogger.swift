import Foundation
import os

/// Every place the app has to swallow a problem rather than crash — an
/// unknown component type, an unknown action id, an unknown theme token, a
/// rejected revision — logs *why* through here instead of failing silently.
/// This is the observability half of the "never crash, never blank the
/// screen" rules in docs/architecture-review.md; a production build would
/// additionally forward `.warning`/`.error` to a crash-reporting/analytics
/// pipeline (see docs/production-readiness-audit.md, Observability).
public enum LogCategory: String {
    case network, renderer, validation, action, dataSource, theme, cache, lifecycle
}

public enum AppLogger {
    private static func logger(_ category: LogCategory) -> Logger {
        Logger(subsystem: "com.omnicard.dynamicui", category: category.rawValue)
    }

    public static func info(_ message: @autoclosure () -> String, category: LogCategory = .renderer) {
        // Evaluate the autoclosure into a plain String up front. `Logger`'s
        // string-interpolation overloads (appendInterpolation) wrap each
        // interpolated argument in their own *escaping* autoclosure so the
        // log call can be deferred; that escaping closure can't capture our
        // non-escaping `message` parameter directly, so we resolve it to a
        // value first and interpolate the value instead of the closure.
        let resolved = message()
        logger(category).info("\(resolved, privacy: .public)")
    }

    public static func warning(_ message: @autoclosure () -> String, category: LogCategory = .renderer) {
        let resolved = message()
        logger(category).warning("\(resolved, privacy: .public)")
    }

    public static func error(_ message: @autoclosure () -> String, category: LogCategory = .renderer) {
        let resolved = message()
        logger(category).error("\(resolved, privacy: .public)")
    }
}
