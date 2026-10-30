import { useEffect, useState } from "react";
import { ChevronRight, Trophy, UserPlus } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { effectiveScope, useStandingStore } from "@/stores/standingStore";
import { BOARD_SIZE, rankChange, standingMessage, weekTimeLeft, xpToPass, type Standing } from "@/services/leaderboard";
import { cn } from "@/lib/utils";
import Avatar from "../Avatar";
import type { DashboardTab } from "./shared";

const MEDAL = ["🥇", "🥈", "🥉"];
const INVITE_DISMISSED_KEY = "myenglish_rank_invite_dismissed_v1";

function useScopeLabel(): string {
  const groups = useStandingStore((s) => s.groups);
  const pref = useStandingStore((s) => s.scopePref);
  const scope = effectiveScope(pref, groups);
  return scope ? (groups.find((g) => g.id === scope)?.name ?? "Nhóm") : "Tất cả mọi người";
}

/** Signed in, and the learner has not turned the rank widgets off */
function useRankVisible(): boolean {
  const user = useAuthStore((s) => s.user);
  const enabled = useStandingStore((s) => s.enabled);
  return !!user && enabled;
}

/** Whether Today shows the rank column: signed in with widgets on, or signed out with the invitation not dismissed */
export function useRankPanelVisible(): boolean {
  const configured = useAuthStore((s) => s.configured);
  const user = useAuthStore((s) => s.user);
  const enabled = useStandingStore((s) => s.enabled);
  const [dismissed, setDismissed] = useState(readInviteDismissed);
  useEffect(() => {
    const onDismissed = () => setDismissed(true);
    window.addEventListener("myenglish-rank-invite-dismissed", onDismissed);
    return () => window.removeEventListener("myenglish-rank-invite-dismissed", onDismissed);
  }, []);
  if (!configured) return false;
  return user ? enabled : !dismissed;
}

function readInviteDismissed(): boolean {
  try {
    return localStorage.getItem(INVITE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Today's right-hand column: this week's race. Where the learner stands (rank, XP, how far the next person is,
 * when the week ends) and the top of the board, so there is always a person to catch. Signed out (and the app
 * is configured): an invitation to sign in instead, which can be dismissed for good.
 */
export function RankPanel({ onNavigate }: { onNavigate: (tab: DashboardTab) => void }) {
  const user = useAuthStore((s) => s.user);
  const visible = useRankVisible();
  const standing = useStandingStore((s) => s.standing);
  const groups = useStandingStore((s) => s.groups);
  const pref = useStandingStore((s) => s.scopePref);
  const setScope = useStandingStore((s) => s.setScope);
  const stale = useStandingStore((s) => s.error);
  const loadingStanding = useStandingStore((s) => s.loading);
  const label = useScopeLabel();
  const activeScope = effectiveScope(pref, groups);

  useEffect(() => {
    if (visible) void useStandingStore.getState().refresh();
  }, [visible]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 md:p-5 space-y-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
            <Trophy className="w-5 h-5" />
          </span>
          <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">Thi đua mỗi tuần</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-zinc-300">
          Đăng nhập để xem mình đứng thứ mấy, lập nhóm với bạn bè và giữ tiến trình giữa các máy. Không bắt buộc.
        </p>
        <button
          onClick={() => onNavigate("account")}
          className="min-h-11 px-4 py-2 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" /> Đăng nhập
        </button>
        <button
          onClick={() => {
            try {
              localStorage.setItem(INVITE_DISMISSED_KEY, "1");
            } catch {}
            window.dispatchEvent(new CustomEvent("myenglish-rank-invite-dismissed"));
          }}
          className="block min-h-11 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 underline"
        >
          Không hiện nữa
        </button>
      </div>
    );
  }
  if (!visible) return null;

  const rows = standing?.board ?? [];
  const mine = standing ? rows.find((r) => r.isMe) : undefined;
  const row = (r: (typeof rows)[number]) => (
    <div
      key={`${r.rank}-${r.displayName}`}
      className={cn("flex items-center gap-2.5 px-3.5 py-2 text-sm md:px-4", r.isMe && "bg-teal-50 dark:bg-teal-400/10")}
    >
      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500 dark:text-zinc-400">{MEDAL[r.rank - 1] ?? r.rank}</span>
      <Avatar id={r.avatar} name={r.displayName} size="sm" />
      <span className={cn("flex-1 min-w-0 truncate", r.isMe ? "font-semibold text-teal-800 dark:text-teal-300" : "text-slate-800 dark:text-zinc-100")}>
        {r.displayName}
      </span>
      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700 dark:text-zinc-300">{r.xp.toLocaleString("vi-VN")}</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="p-3.5 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-teal-700 dark:text-teal-300" />
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">Cuộc đua tuần này</span>
          </div>
          <span className="text-sm text-slate-500 dark:text-zinc-400">{weekTimeLeft()}</span>
        </div>
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {[{ id: null as string | null, name: "Tất cả" }, ...groups].map((g) => (
              <button
                key={g.id ?? "all"}
                onClick={() => setScope(g.id)}
                className={cn(
                  "min-h-10 px-3.5 py-1 rounded-full text-sm font-semibold border transition-colors",
                  activeScope === g.id
                    ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
        {standing ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-4xl font-bold tabular-nums text-teal-700 dark:text-teal-300">#{standing.rank}</span>
              <span className="min-w-0 text-sm text-slate-500 dark:text-zinc-400">
                trong {standing.total} người · {label}
              </span>
            </div>
            <div className="text-sm tabular-nums text-slate-500 dark:text-zinc-400">{standing.xp.toLocaleString("vi-VN")} XP tuần này</div>
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-100">{standingMessage(standing)}</p>
          </>
        ) : (
          loadingStanding ? (
            <div aria-hidden className="space-y-2 animate-pulse motion-reduce:animate-none">
              <div className="h-9 w-24 rounded-lg bg-slate-200 dark:bg-zinc-800" />
              <div className="h-3 w-40 rounded bg-slate-200 dark:bg-zinc-800" />
              <div className="h-3 w-52 rounded bg-slate-200 dark:bg-zinc-800" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-zinc-400">Chưa có thứ hạng. Ôn vài thẻ rồi đồng bộ để lên bảng.</p>
          )
        )}
      </div>

      {standing && rows.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800 border-t border-slate-100 dark:border-zinc-800">
          {rows.filter((r) => r.rank <= BOARD_SIZE).map(row)}
          {mine && mine.rank > BOARD_SIZE && (
            <>
              <div className="px-3 py-0.5 text-center text-sm text-slate-500 dark:text-zinc-400">···</div>
              {row(mine)}
            </>
          )}
        </div>
      )}

      <div className="px-3.5 md:px-4 py-1.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 text-slate-500 dark:text-zinc-400">{stale ? "Chưa cập nhật được, đang hiện số cũ" : "XP tuần này"}</span>
        <button onClick={() => onNavigate("leaderboard")} className="shrink-0 min-h-11 px-1 font-semibold text-teal-700 dark:text-teal-300 hover:underline inline-flex items-center">
          Xem đầy đủ <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Sidebar line under the streak: always in view, one click to the board */
export function RankLine({ onOpen }: { onOpen: () => void }) {
  const visible = useRankVisible();
  const standing = useStandingStore((s) => s.standing);
  if (!visible || !standing) return null;
  const gap = xpToPass(standing);
  const hint = standing.xp === 0 ? "ôn thẻ để lên bảng" : gap !== null ? `còn ${gap.toLocaleString("vi-VN")} XP lên #${Math.max(1, standing.rank - 1)}` : "đang dẫn đầu";
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Thứ hạng XP tuần này • Bấm để xem bảng xếp hạng"
      className="w-full min-h-11 text-left rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 px-3 py-2 flex items-center gap-2 text-sm transition-colors"
    >
      <Trophy className="w-4 h-4 shrink-0 text-teal-700 dark:text-teal-300" />
      <span className="font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap">#{standing.rank}</span>
      <span className="truncate text-slate-500 dark:text-zinc-400">{hint}</span>
    </button>
  );
}

/**
 * End of a session: the rank change the XP just earned made. Syncs first (the XP must reach the account), then
 * asks for the new standing and compares it with the one from before the session.
 */
export function RankDelta() {
  const visible = useRankVisible();
  const baseline = useStandingStore((s) => s.baseline);
  const [after, setAfter] = useState<Standing | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const { runSync } = await import("@/services/sync/manager");
        await runSync();
        const fresh = await useStandingStore.getState().refresh(true);
        if (!cancelled) setAfter(fresh);
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;
  const change = rankChange(baseline, after);
  const base = "w-full p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-sm flex items-center gap-2.5";

  if (!after) {
    return done ? null : (
      <div className={cn(base, "text-slate-500 dark:text-zinc-400")}>
        <Trophy className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0" /> Đang cập nhật thứ hạng…
      </div>
    );
  }
  let text: string;
  if (change && change.to < change.from) {
    text = `Bạn lên #${change.to} (từ #${change.from})${change.passed ? `, vừa vượt ${change.passed}` : ""} 🎉`;
  } else if (change && change.to > change.from) {
    text = `Hạng tuần này #${change.to}. ${standingMessage(after)}`;
  } else {
    text = `Hạng tuần này #${after.rank}. ${standingMessage(after)}`;
  }
  return (
    <div className={base}>
      <Trophy className="w-4 h-4 text-teal-700 dark:text-teal-300 shrink-0" />
      <span className="min-w-0 font-medium text-slate-800 dark:text-zinc-100">{text}</span>
    </div>
  );
}
