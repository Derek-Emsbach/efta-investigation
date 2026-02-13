"use client"

import { useSettings, type TextSize, type A11yMode } from "@/lib/settings-provider"
import { useTheme } from "@/lib/theme-provider"

export function SettingsForm() {
  const { theme, toggleTheme } = useTheme()
  const {
    textSize,
    setTextSize,
    a11yMode,
    setA11yMode,
    reducedMotion,
    setReducedMotion,
    analyticsOptOut,
    setAnalyticsOptOut,
  } = useSettings()

  return (
    <div className="space-y-8">
      {/* Appearance */}
      <section>
        <h2 className="mb-1 font-display text-base font-semibold text-text-primary">
          Appearance
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Control how the platform looks
        </p>
        <div className="rounded-lg border border-border-default bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Theme</p>
              <p className="text-xs text-text-muted mt-0.5">
                Switch between dark and light mode
              </p>
            </div>
            <select
              value={theme}
              onChange={(e) => {
                if (theme !== e.target.value) toggleTheme()
              }}
              className="rounded border border-border-default bg-elevated px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-info"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </section>

      {/* Text Size */}
      <section>
        <h2 className="mb-1 font-display text-base font-semibold text-text-primary">
          Text Size
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Adjust the base font size across the platform
        </p>
        <div className="rounded-lg border border-border-default bg-surface p-5">
          <div className="flex gap-3">
            {(["small", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                onClick={() => setTextSize(size as TextSize)}
                className={`flex-1 rounded border px-4 py-2.5 text-sm capitalize transition-colors ${
                  textSize === size
                    ? "border-info bg-info/10 text-info font-medium"
                    : "border-border-default bg-elevated text-text-secondary hover:border-text-muted"
                }`}
              >
                {size}
                <span className="block text-[10px] text-text-muted mt-0.5">
                  {size === "small" ? "14px" : size === "medium" ? "16px" : "18px"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section>
        <h2 className="mb-1 font-display text-base font-semibold text-text-primary">
          Accessibility
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Adjust colors and motion for visual accessibility
        </p>
        <div className="rounded-lg border border-border-default bg-surface p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Color Mode</p>
              <p className="text-xs text-text-muted mt-0.5">
                Adjust the color palette for color vision deficiency
              </p>
            </div>
            <select
              value={a11yMode}
              onChange={(e) => setA11yMode(e.target.value as A11yMode)}
              className="rounded border border-border-default bg-elevated px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-info"
            >
              <option value="none">Default</option>
              <option value="colorblind">Colorblind-friendly</option>
              <option value="high-contrast">High Contrast</option>
            </select>
          </div>

          <div className="border-t border-border-default pt-5">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-text-secondary">Reduced Motion</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Disable animations and transitions
                </p>
              </div>
              <button
                role="switch"
                aria-checked={reducedMotion}
                onClick={() => setReducedMotion(!reducedMotion)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  reducedMotion ? "bg-info" : "bg-border-default"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    reducedMotion ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section>
        <h2 className="mb-1 font-display text-base font-semibold text-text-primary">
          Privacy
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Control data collection and sharing
        </p>
        <div className="rounded-lg border border-border-default bg-surface p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-text-secondary">Analytics Opt-Out</p>
              <p className="text-xs text-text-muted mt-0.5">
                This platform does not currently use third-party analytics.
                This preference is saved for future use.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={analyticsOptOut}
              onClick={() => setAnalyticsOptOut(!analyticsOptOut)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                analyticsOptOut ? "bg-info" : "bg-border-default"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  analyticsOptOut ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </section>
    </div>
  )
}
