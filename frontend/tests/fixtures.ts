import type { HomeScreenConfiguration } from "@/types/homeScreen";

/** A minimal, deliberately small, structurally-valid configuration used as a
 * base for semantic-rule unit tests — each test clones this and mutates
 * exactly one thing so failures are attributable to a single rule. */
export function baseConfig(): HomeScreenConfiguration {
  return {
    configurationId: "cfg_test",
    schemaVersion: "2.0.0",
    revision: 1,
    status: "draft",
    environment: "development",
    platformConstraints: { minAppVersion: { ios: "1.5.65", android: "0.8.8" } },
    theme: {
      tokens: {
        "surface.default": { light: "#FFFFFF", dark: "#1D1B18" },
        "surface.transparent": { light: "transparent", dark: "transparent" },
      },
    },
    appIcons: {
      defaultIconId: "ic_launcher",
      supportedIconIds: ["ic_launcher"],
      timeZone: "Asia/Kolkata",
      campaigns: [],
    },
    navigation: {
      bottom: [
        {
          id: "home",
          label: { kind: "literal", value: "Home" },
          icon: { kind: "remote", url: "https://uat1.omnicard.co.in/file-utils/ZhYwcpaw.png" },
          actionId: "home",
        },
      ],
    },
    screens: [
      {
        screenId: "home",
        title: "Home",
        style: { backgroundToken: "surface.default", statusBarStyle: "auto" },
        components: [
          {
            componentId: "header",
            type: "header",
            componentVersion: 1,
            enabled: true,
            style: { backgroundToken: "surface.transparent" },
            props: { nameField: "userName", profileImageField: "userProfileImage" },
          },
          {
            componentId: "quick_actions",
            type: "quickActions",
            componentVersion: 1,
            enabled: true,
            style: { backgroundToken: "surface.default" },
            layout: { orientation: "horizontal", viewType: "fixed", columns: 4 },
            props: {
              title: { kind: "literal", value: "Quick Actions" },
              items: [
                {
                  id: "pay_anyone",
                  label: { kind: "literal", value: "Send Money" },
                  actionId: "pay_anyone",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
