"use client";

import type { GradientValue } from "@/types/homeScreen";
import { usePortal } from "./PortalProvider";
import { TextInput, Field, Panel, Button, Select } from "@/components/common/ui";
import { resolveGradientCss } from "@/lib/portal/gradient";

export function ThemeEditor() {
  const p = usePortal();
  const tokens = p.draft?.theme.tokens ?? {};
  const gradients = p.draft?.theme.gradients ?? {};
  const tokenNames = Object.keys(tokens);
  const screen = p.draft?.screens[0];

  function setColor(token: string, mode: "light" | "dark", value: string) {
    p.updateDraft((cfg) => {
      const pair = cfg.theme.tokens[token];
      if (pair) pair[mode] = value;
      return cfg;
    });
  }

  function addToken() {
    const name = window.prompt("New token name (e.g. surface.custom)");
    if (!name || !/^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(name)) {
      if (name) window.alert("Token names must look like `surface.custom` (lowercase, dot-separated).");
      return;
    }
    p.updateDraft((cfg) => {
      cfg.theme.tokens[name] = { light: "#FFFFFF", dark: "#000000" };
      return cfg;
    });
  }

  // --- Gradient editing ---------------------------------------------------
  // `theme.gradients` already backs the hero-band wash behind the header/
  // Quick Actions (`screen.style.backgroundGradientToken`) and any item's
  // `backgroundGradientToken`, resolved through `theme.tokens` exactly like
  // a flat color — it was already "dynamic" in the schema, just only
  // editable via the raw Advanced JSON editor below. This section is the
  // missing portal UI for that: no schema/JSON-shape change needed. Every
  // stop is still a `colorToken` reference (never a literal hex), so the
  // gradient stays light/dark-aware for free — same as `resolveGradientCss`
  // already assumes.
  function updateGradient(name: string, updater: (g: GradientValue) => void) {
    p.updateDraft((cfg) => {
      const g = cfg.theme.gradients?.[name];
      if (g) updater(g);
      return cfg;
    });
  }

  function setAngle(name: string, angle: number) {
    updateGradient(name, (g) => {
      g.angle = angle;
    });
  }

  function setStopToken(name: string, index: number, colorToken: string) {
    updateGradient(name, (g) => {
      const stop = g.stops[index];
      if (stop) stop.colorToken = colorToken;
    });
  }

  // UI works in 0-100% for readability; the schema (and `GradientStop`)
  // store `location` as 0-1, matching `resolveGradientCss`/iOS's
  // `ThemeResolver` — clamped here so a stray edit can't produce an
  // out-of-range value the JSON Schema (`GradientStop.location`
  // min 0 / max 1) would then reject at validate/publish time.
  function setStopLocation(name: string, index: number, percent: number) {
    const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
    updateGradient(name, (g) => {
      const stop = g.stops[index];
      if (stop) stop.location = clamped / 100;
    });
  }

  function addStop(name: string) {
    updateGradient(name, (g) => {
      const lastLocation = g.stops[g.stops.length - 1]?.location ?? 1;
      g.stops.push({ colorToken: tokenNames[0] ?? "surface.default", location: Math.min(1, lastLocation) });
    });
  }

  function removeStop(name: string, index: number) {
    updateGradient(name, (g) => {
      // Schema requires >= 2 stops — mirrors `RechargeBillsPreview`-style
      // "never render a config the schema would reject" guards elsewhere.
      if (g.stops.length <= 2) return;
      g.stops.splice(index, 1);
    });
  }

  function addGradient() {
    const name = window.prompt("New gradient name (e.g. hero.banner)");
    if (!name || !/^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(name)) {
      if (name) window.alert("Gradient names must look like `hero.banner` (lowercase, dot-separated).");
      return;
    }
    p.updateDraft((cfg) => {
      if (!cfg.theme.gradients) cfg.theme.gradients = {};
      if (cfg.theme.gradients[name]) {
        window.alert(`A gradient named "${name}" already exists.`);
        return cfg;
      }
      cfg.theme.gradients[name] = {
        angle: 180,
        stops: [
          { colorToken: tokenNames[0] ?? "surface.default", location: 0 },
          { colorToken: tokenNames[1] ?? tokenNames[0] ?? "surface.default", location: 1 },
        ],
      };
      return cfg;
    });
  }

  function removeGradient(name: string) {
    if (!window.confirm(`Delete gradient "${name}"? Any screen/item still referencing it will fall back to its flat background token.`)) return;
    p.updateDraft((cfg) => {
      if (cfg.theme.gradients) delete cfg.theme.gradients[name];
      return cfg;
    });
  }

  // The control that actually turns the hero wash on/off/different for the
  // home screen — the one place `docs/component-catalog.md`'s "red
  // gradient coming down behind Quick Actions" lives in the schema.
  function setHeroGradient(value: string) {
    p.updateDraft((cfg) => {
      const style = cfg.screens[0]?.style;
      if (!style) return cfg;
      if (value) {
        style.backgroundGradientToken = value;
      } else {
        delete style.backgroundGradientToken;
      }
      return cfg;
    });
  }

  return (
    <>
      <Panel title="Theme tokens">
        <div className="flex flex-col gap-2">
          {Object.entries(tokens).map(([name, pair]) => (
            <div key={name} className="flex items-center gap-2 text-sm">
              <span className="w-40 shrink-0 truncate font-mono text-xs text-slate-600">{name}</span>
              <Field label="Light">
                <div className="flex items-center gap-1">
                  <input type="color" value={/^#/.test(pair.light) ? pair.light.slice(0, 7) : "#ffffff"} onChange={(e) => setColor(name, "light", e.target.value)} />
                  <TextInput value={pair.light} onChange={(e) => setColor(name, "light", e.target.value)} className="!w-28" />
                </div>
              </Field>
              <Field label="Dark">
                <div className="flex items-center gap-1">
                  <input type="color" value={/^#/.test(pair.dark) ? pair.dark.slice(0, 7) : "#000000"} onChange={(e) => setColor(name, "dark", e.target.value)} />
                  <TextInput value={pair.dark} onChange={(e) => setColor(name, "dark", e.target.value)} className="!w-28" />
                </div>
              </Field>
            </div>
          ))}
        </div>
        <Button variant="secondary" className="mt-2" onClick={addToken}>
          + Add token
        </Button>
      </Panel>

      <Panel title="Gradients">
        {screen && (
          <Field label="Screen hero gradient (the wash behind the header / Quick Actions)">
            <Select value={screen.style.backgroundGradientToken ?? ""} onChange={(e) => setHeroGradient(e.target.value)}>
              <option value="">None — flat backgroundToken only</option>
              {Object.keys(gradients).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="flex flex-col gap-3">
          {Object.entries(gradients).map(([name, g]) => (
            <div key={name} className="rounded-md border border-slate-200 p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-600">{name}</span>
                <Button variant="ghost" onClick={() => removeGradient(name)}>
                  Remove
                </Button>
              </div>

              <div className="mb-2 flex gap-2">
                <div
                  className="h-6 flex-1 rounded border border-slate-200"
                  style={{ backgroundImage: resolveGradientCss(gradients, tokens, name, "light") }}
                  title="Light preview"
                />
                <div
                  className="h-6 flex-1 rounded border border-slate-200"
                  style={{ backgroundImage: resolveGradientCss(gradients, tokens, name, "dark") }}
                  title="Dark preview"
                />
              </div>

              <Field label="Angle (deg, CSS convention — 180 = top to bottom)">
                <TextInput type="number" value={g.angle} onChange={(e) => setAngle(name, Number(e.target.value))} className="!w-24" />
              </Field>

              <div className="flex flex-col gap-1.5">
                {g.stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Select value={stop.colorToken} onChange={(e) => setStopToken(name, i, e.target.value)} className="!w-44">
                      {tokenNames.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(stop.location * 100)}
                      onChange={(e) => setStopLocation(name, i, Number(e.target.value))}
                      className="!w-16"
                    />
                    <span className="text-xs text-slate-400">%</span>
                    <Button variant="ghost" onClick={() => removeStop(name, i)} disabled={g.stops.length <= 2}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" className="mt-2" onClick={() => addStop(name)}>
                + Add stop
              </Button>
            </div>
          ))}
        </div>

        <Button variant="secondary" className="mt-3" onClick={addGradient}>
          + Add gradient
        </Button>
      </Panel>
    </>
  );
}
