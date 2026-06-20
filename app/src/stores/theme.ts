import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "auto";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

/**
 * Theme preference (Light / Dark / Auto), persisted to localStorage so it survives
 * reloads like a real setting. Applied to the DOM by ThemeProvider (P6).
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "auto",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "khonjel.theme" },
  ),
);
