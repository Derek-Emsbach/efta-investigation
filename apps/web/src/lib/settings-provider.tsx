"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type TextSize = "small" | "medium" | "large"
export type A11yMode = "none" | "colorblind" | "high-contrast"

interface SettingsContextValue {
  textSize: TextSize
  setTextSize: (size: TextSize) => void
  a11yMode: A11yMode
  setA11yMode: (mode: A11yMode) => void
  reducedMotion: boolean
  setReducedMotion: (enabled: boolean) => void
  analyticsOptOut: boolean
  setAnalyticsOptOut: (optOut: boolean) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  textSize: "medium",
  setTextSize: () => {},
  a11yMode: "none",
  setA11yMode: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
  analyticsOptOut: false,
  setAnalyticsOptOut: () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}

const TEXT_SIZES: TextSize[] = ["small", "medium", "large"]
const A11Y_MODES: A11yMode[] = ["none", "colorblind", "high-contrast"]

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>("medium")
  const [a11yMode, setA11yModeState] = useState<A11yMode>("none")
  const [reducedMotion, setReducedMotionState] = useState(false)
  const [analyticsOptOut, setAnalyticsOptOutState] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const savedSize = localStorage.getItem("efta-text-size") as TextSize | null
    if (savedSize && TEXT_SIZES.includes(savedSize)) {
      setTextSizeState(savedSize)
    }

    const savedA11y = localStorage.getItem("efta-a11y") as A11yMode | null
    if (savedA11y && A11Y_MODES.includes(savedA11y)) {
      setA11yModeState(savedA11y)
    }

    if (localStorage.getItem("efta-reduced-motion") === "true") {
      setReducedMotionState(true)
    }

    if (localStorage.getItem("efta-analytics-optout") === "true") {
      setAnalyticsOptOutState(true)
    }
  }, [])

  const setTextSize = useCallback((size: TextSize) => {
    setTextSizeState(size)
    localStorage.setItem("efta-text-size", size)
    if (size === "medium") {
      document.documentElement.removeAttribute("data-text-size")
    } else {
      document.documentElement.setAttribute("data-text-size", size)
    }
  }, [])

  const setA11yMode = useCallback((mode: A11yMode) => {
    setA11yModeState(mode)
    localStorage.setItem("efta-a11y", mode)
    if (mode === "none") {
      document.documentElement.removeAttribute("data-a11y")
    } else {
      document.documentElement.setAttribute("data-a11y", mode)
    }
  }, [])

  const setReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotionState(enabled)
    localStorage.setItem("efta-reduced-motion", String(enabled))
    if (enabled) {
      document.documentElement.setAttribute("data-reduced-motion", "true")
    } else {
      document.documentElement.removeAttribute("data-reduced-motion")
    }
  }, [])

  const setAnalyticsOptOut = useCallback((optOut: boolean) => {
    setAnalyticsOptOutState(optOut)
    localStorage.setItem("efta-analytics-optout", String(optOut))
  }, [])

  return (
    <SettingsContext.Provider
      value={{
        textSize,
        setTextSize,
        a11yMode,
        setA11yMode,
        reducedMotion,
        setReducedMotion,
        analyticsOptOut,
        setAnalyticsOptOut,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
