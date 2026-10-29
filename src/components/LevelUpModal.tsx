import { useState, useEffect } from "react";
import { Sparkles, Trophy, Award, X } from "lucide-react";
import type { AchievementBadge } from "@/services/achievements";
import { triggerConfetti } from "@/utils/confetti";
import { isMainSessionActive } from "@/services/activeSession";

interface LevelUp {
  newLevel: number;
  totalXP: number;
}

export default function LevelUpModal() {
  const [levelUpData, setLevelUpData] = useState<LevelUp | null>(null);

  const [unlockedBadges, setUnlockedBadges] = useState<AchievementBadge[]>([]);

  useEffect(() => {
    // Mid-session the level-up waits: a full-screen modal would cover the card while 1/Enter still grade it
    let pending: LevelUp | null = null;
    let waitTimer: ReturnType<typeof setInterval> | null = null;

    const show = (data: LevelUp) => {
      setLevelUpData(data);
      triggerConfetti(3000);
    };

    const handleXPUpdate = (e: CustomEvent) => {
      if (!e.detail?.leveledUp) return;
      const data: LevelUp = { newLevel: e.detail.newLevel, totalXP: e.detail.totalXP };
      if (!isMainSessionActive()) {
        show(data);
        return;
      }
      // Keep the latest level; shown once the session has ended
      pending = data;
      if (waitTimer) return;
      waitTimer = setInterval(() => {
        if (isMainSessionActive()) return;
        if (waitTimer) clearInterval(waitTimer);
        waitTimer = null;
        const next = pending;
        pending = null;
        if (next) show(next);
      }, 2000);
    };

    const handleBadgeUnlocked = (e: CustomEvent) => {
      if (e.detail?.badges && e.detail.badges.length > 0) {
        const incoming = e.detail.badges as AchievementBadge[];
        // Dedupe by id (same badge may be dispatched twice); confetti is fired by achievements.ts
        setUnlockedBadges((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          const fresh: AchievementBadge[] = [];
          for (const b of incoming) {
            if (seen.has(b.id)) continue;
            seen.add(b.id);
            fresh.push(b);
          }
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }
    };

    window.addEventListener("myenglish-xp-updated" as any, handleXPUpdate);
    window.addEventListener("myenglish-badge-unlocked" as any, handleBadgeUnlocked);

    return () => {
      window.removeEventListener("myenglish-xp-updated" as any, handleXPUpdate);
      window.removeEventListener("myenglish-badge-unlocked" as any, handleBadgeUnlocked);
      if (waitTimer) clearInterval(waitTimer);
    };
  }, []);

  const closeLevelUp = () => setLevelUpData(null);
  const closeBadge = (id: string) =>
    setUnlockedBadges((prev) => prev.filter((b) => b.id !== id));

  return (
    <>
      {/* Level Up Celebration Modal */}
      {levelUpData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center space-y-5 shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="relative">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 mt-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>LÊN CẤP!</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Cấp Độ {levelUpData.newLevel}
              </h3>
              <p className="text-sm text-slate-600 dark:text-zinc-400">
                Học đều mỗi ngày đang có kết quả. Cứ giữ nhịp này nhé!
              </p>
            </div>

            <button
              onClick={closeLevelUp}
              className="w-full min-h-12 rounded-2xl font-semibold text-base bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white shadow-sm transition-colors"
            >
              Tiếp tục học ngay
            </button>
          </div>
        </div>
      )}

      {/* Badge Unlocked Notification Toast */}
      {unlockedBadges.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9998] space-y-3 pointer-events-auto">
          {unlockedBadges.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl text-left max-w-sm animate-in slide-in-from-bottom-5 duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-400/10 flex items-center justify-center text-2xl shrink-0">
                {badge.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                  <Award className="w-3.5 h-3.5" />
                  <span>Mở khóa danh hiệu</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{badge.title}</h4>
                <p className="text-sm text-slate-600 dark:text-zinc-400 line-clamp-1">{badge.description}</p>
                <span className="inline-block text-xs font-semibold text-green-700 dark:text-green-400 mt-0.5">
                  +{badge.xpBonus} XP thưởng
                </span>
              </div>
              <button
                onClick={() => closeBadge(badge.id)}
                className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
