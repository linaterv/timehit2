"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { themes, type ThemeMetadata } from "@/themes";

const STORAGE_KEY = "timehit-theme";
const DEFAULT_THEME = "light";

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes.some((t) => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  const setTheme = (id: string) => {
    setThemeState(id);
    document.documentElement.dataset.theme = id;
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
