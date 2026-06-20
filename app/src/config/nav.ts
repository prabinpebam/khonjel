import {
  BarChart3,
  BookOpen,
  Blocks,
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
  | "transforms"
  | "integrations";

export interface NavItem {
  id: NavId;
  label: string;
  icon: LucideIcon;
}

/** Control Panel primary navigation (data, not markup — design-system P12). */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "dictionary", label: "Dictionary", icon: BookOpen },
  { id: "transforms", label: "Transforms", icon: Shuffle },
  { id: "integrations", label: "Integrations", icon: Blocks },
];
