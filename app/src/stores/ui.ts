import { create } from "zustand";
import type { NavId } from "@config/nav";
import type { SettingsSectionId } from "@config/settings";

interface UiState {
  activeView: NavId;
  setActiveView: (view: NavId) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  settingsOpen: boolean;
  settingsSection: SettingsSectionId;
  openSettings: (section?: SettingsSectionId) => void;
  closeSettings: () => void;
  setSettingsSection: (section: SettingsSectionId) => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

/** Ephemeral Control Panel UI state (view, sidebar, settings modal, command palette). */
export const useUiStore = create<UiState>((set) => ({
  activeView: "home",
  setActiveView: (activeView) => set({ activeView, paletteOpen: false }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  settingsOpen: false,
  settingsSection: "general",
  openSettings: (section) =>
    set((s) => ({ settingsOpen: true, settingsSection: section ?? s.settingsSection })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
