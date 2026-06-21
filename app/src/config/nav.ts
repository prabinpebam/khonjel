import {
  BarChart3,
  BookOpen,
  Home,
  MessageSquare,
  NotebookPen,
  Shuffle,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type NavId =
  | "home"
  | "insights"
  | "chat"
  | "notes"
  | "upload"
  | "dictionary"
  | "transforms";

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
  /** The domain's signature hue (text color utility) per the color strategy. */
  color: string;
}

/** Control Panel primary navigation (data, not markup — design-system P12). */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home, color: "text-cat-home" },
  { id: "insights", label: "Insights", icon: BarChart3, color: "text-cat-insights" },
  { id: "chat", label: "Chat", icon: MessageSquare, color: "text-cat-chat" },
  { id: "notes", label: "Notes", icon: NotebookPen, color: "text-cat-notes" },
  { id: "upload", label: "Upload", icon: Upload, color: "text-cat-upload" },
  { id: "dictionary", label: "Dictionary", icon: BookOpen, color: "text-cat-dictionary" },
  { id: "transforms", label: "Transforms", icon: Shuffle, color: "text-cat-transforms" },
];
