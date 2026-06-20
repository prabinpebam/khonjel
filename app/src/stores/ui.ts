import { create } from "zustand";
import type { NavId } from "@config/nav";

interface UiState {
  activeView: NavId;
  setActiveView: (view: NavId) => void;
}

/** Ephemeral Control Panel UI state (which primary view is shown). */
export const useUiStore = create<UiState>((set) => ({
  activeView: "home",
  setActiveView: (activeView) => set({ activeView }),
}));
