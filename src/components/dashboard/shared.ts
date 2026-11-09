import type { WordDetail } from "@/types/database";
import { AI_VOCAB_ENABLED } from "@/services/features";

export type DashboardTab =
  | "today"
  | "library"
  | "dictionary"
  | "known"
  | "capture"
  | "reading"
  | "writing"
  | "review"
  | "forgotten"
  | "analytics"
  | "guide"
  | "grammar"
  | "pronunciation"
  | "shadowing"
  | "talk"
  | "patterns"
  | "leaderboard"
  | "account";
export type ViewMode = "gallery" | "table";

/**
 * Scrolling page container shared by every dashboard tab, so all screens have the same width:
 * full width up to 1152px (max-w-6xl), centered, 24px padding (12px on phones).
 */
export const PAGE_CONTAINER = "tab-enter flex-1 overflow-y-auto p-3 md:p-6 max-w-6xl mx-auto w-full";

export const GALLERY_PAGE_SIZE = 60;
export const DUE_LIST_LIMIT = 50;

/** Single-pass library aggregates computed by MainDashboard */
export interface LibraryStats {
  dueWords: WordDetail[];
  /** "Đang học" / "Nhớ lâu" (services/wordStatus): the same two tiers on every screen */
  learningCount: number;
  rememberedLongCount: number;
  leechCount: number;
  perTopic: Record<string, { total: number; due: number }>;
}

/**
 * The five sections of the app (bottom tab bar on phones, sidebar on a computer). A section opens its first tab, and
 * while one of its tabs is shown a row of chips under the header switches between them. Tab ids are unchanged
 * (other screens call setActiveTab("…")); every tab belongs to exactly one section.
 */
export type NavSectionId = "today" | "vocab" | "speak" | "grammar" | "me";
export interface NavSection {
  id: NavSectionId;
  label: string;
  /** On the phone's bottom bar, where five labels share the width (large text included) */
  shortLabel?: string;
  tabs: Array<{ tab: DashboardTab; label: string }>;
}
export const NAV_SECTIONS: NavSection[] = [
  { id: "today", label: "Hôm nay", tabs: [{ tab: "today", label: "Hôm nay" }] },
  {
    id: "vocab",
    label: "Từ vựng",
    tabs: [
      { tab: "capture", label: AI_VOCAB_ENABLED ? "Thêm từ bằng AI" : "Bộ từ" },
      { tab: "review", label: "Ôn tập" },
      { tab: "library", label: "Sổ từ" },
      { tab: "dictionary", label: "Từ điển" },
      { tab: "reading", label: "Đọc" },
    ],
  },
  {
    id: "speak",
    label: "Luyện nói",
    shortLabel: "Nói",
    tabs: [
      { tab: "patterns", label: "Mẫu câu" },
      { tab: "talk", label: "Hội thoại" },
      { tab: "pronunciation", label: "Phát âm" },
    ],
  },
  {
    id: "grammar",
    label: "Ngữ pháp & Viết",
    shortLabel: "Ngữ pháp",
    tabs: [
      { tab: "grammar", label: "Ngữ pháp" },
      { tab: "writing", label: "Viết" },
    ],
  },
  {
    id: "me",
    label: "Tôi",
    tabs: [
      { tab: "analytics", label: "Tiến độ" },
      { tab: "leaderboard", label: "Xếp hạng" },
      { tab: "guide", label: "Cài đặt" },
    ],
  },
];

/** Maps consolidated child tabs (forgotten, known, shadowing, account) to their parent sub-tab in NAV_SECTIONS */
export function canonicalSubTab(tab: DashboardTab): DashboardTab {
  if (tab === "forgotten" || tab === "known") return "library";
  if (tab === "shadowing") return "pronunciation";
  if (tab === "account") return "guide";
  return tab;
}

/** The section a tab belongs to */
export function navSectionOf(tab: DashboardTab): NavSection {
  const canonical = canonicalSubTab(tab);
  return NAV_SECTIONS.find((s) => s.tabs.some((t) => t.tab === canonical)) ?? NAV_SECTIONS[0];
}

/** The name of a tab inside its section ("Sổ từ", "Cài đặt") */
export function tabLabel(tab: DashboardTab): string {
  const canonical = canonicalSubTab(tab);
  return navSectionOf(canonical).tabs.find((t) => t.tab === canonical)?.label ?? "";
}

/** Text-To-Speech Pronunciation (module-level, so its identity is stable for memoized cards) */
export { handleSpeak } from "../review/speech";
