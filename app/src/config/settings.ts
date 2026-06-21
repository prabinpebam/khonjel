import {
  Cable,
  Cpu,
  KeyRound,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type SettingsSectionId =
  | "general"
  | "hotkeys"
  | "speech-to-text"
  | "language-models"
  | "connections"
  | "privacy"
  | "system";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
}

export interface SettingsGroup {
  label: string;
  items: SettingsSection[];
}

/** Settings modal nav rail (grouped). Account/Workspace are optional surfaces. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: "General",
    items: [
      { id: "general", label: "General", icon: SlidersHorizontal },
      { id: "hotkeys", label: "Hotkeys", icon: KeyRound },
    ],
  },
  {
    label: "AI models",
    items: [
      { id: "speech-to-text", label: "Speech-to-Text", icon: Mic },
      { id: "language-models", label: "Language Models", icon: Sparkles },
      { id: "connections", label: "Connections", icon: Cable },
    ],
  },
  {
    label: "Privacy",
    items: [{ id: "privacy", label: "Privacy & Data", icon: ShieldCheck }],
  },
  {
    label: "System",
    items: [{ id: "system", label: "System", icon: Cpu }],
  },
];

export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_GROUPS.flatMap((g) => g.items);
