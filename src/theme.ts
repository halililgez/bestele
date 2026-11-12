import { useEffect, useState } from "react";

export type Theme = "defter" | "modern";

export const THEME_LABELS: Record<Theme, string> = {
  defter: "Defter",
  modern: "Modern",
};

const KEY = "bestele:theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "defter" || saved === "modern") return saved;
  } catch {
    /* varsayılana düş */
  }
  return "defter";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* tercih kaydedilemezse sorun değil */
    }
  }, [theme]);

  return [theme, setTheme] as const;
}
