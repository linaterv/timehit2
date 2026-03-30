"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { themes, type ThemeMetadata } from "@/themes";

const STORAGE_KEY = "timehit-theme";
const DEFAULT_THEME = "light";
const THEME_EVENT = "timehit-theme-change";

type ThemeContextValue = {
  theme: string;
  setTheme: (id: string) => void;
  themes: ThemeMetadata[];
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes,
});

/** Apply theme from user profile on login. Sets localStorage + DOM, no backend save. */
export function applyThemeFromProfile(themeId: string) {
  if (themeId && themes.some((t) => t.id === themeId)) {
    localStorage.setItem(STORAGE_KEY, themeId);
    document.documentElement.dataset.theme = themeId;
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: themeId }));
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes.some((t) => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => setThemeState((e as CustomEvent).detail);
    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, []);

  const [splash, setSplash] = useState<string | null>(null);
  const prevTheme = useRef(theme);

  const setTheme = (id: string) => {
    const prev = prevTheme.current;
    setThemeState(id);
    document.documentElement.dataset.theme = id;
    localStorage.setItem(STORAGE_KEY, id);
    prevTheme.current = id;
    // Show splash on theme switch (not on initial load)
    if (prev !== id && id === "fallout") {
      setSplash("fallout");
      setTimeout(() => setSplash(null), 3000);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
      {splash === "fallout" && <FalloutSplash onDone={() => setSplash(null)} />}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function FalloutSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 2000);
    const t2 = setTimeout(onDone, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer"
      style={{
        background: "black",
        opacity: phase === "in" ? 1 : 0,
        transition: "opacity 1s ease-out",
      }}
    >
      <div
        className="text-center"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transition: "opacity 0.8s ease-out",
        }}
      >
        <p style={{ fontFamily: "var(--font-gothic), serif", fontSize: "2.5rem", color: "#4ade80", letterSpacing: "0.05em" }}>
          WAR.
        </p>
        <p style={{ fontFamily: "var(--font-gothic), serif", fontSize: "1.5rem", color: "#4ade80", opacity: 0.7, marginTop: "0.5rem" }}>
          War never changes...
        </p>
      </div>
    </div>
  );
}
