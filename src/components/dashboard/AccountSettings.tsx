import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useStandingStore } from "@/stores/standingStore";
import { resolveAccountMismatch, runSync } from "@/services/sync/manager";
import { cn } from "@/lib/utils";
import Avatar from "../Avatar";
import { AVATARS } from "@/services/avatars";

type Mode = "signin" | "signup" | "forgot";

const field =
  "w-full min-h-12 px-3.5 py-2 rounded-xl text-base border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 dark:focus:border-teal-400";
const primary =
  "min-h-12 px-5 py-2 rounded-2xl text-base font-semibold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-sm disabled:opacity-50 text-white inline-flex items-center justify-center gap-2";
const secondary =
  "min-h-11 px-4 py-2 rounded-2xl text-sm font-semibold border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 disabled:opacity-50 inline-flex items-center justify-center gap-1.5";

function formatTime(iso: string | null): string {
  if (!iso) return "chưa lần nào";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "chưa lần nào" : d.toLocaleString("vi-VN");
}

/** Settings → Tài khoản: sign in / up, and the state of the progress sync */
export default function AccountSettings() {
  const { configured, ready, user, profile, busy, notice, error, sync } = useAuthStore();
  const store = useAuthStore.getState;
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [editName, setEditName] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const rankWidgets = useStandingStore((s) => s.enabled);

  useEffect(() => {
    store().clearMessages();
  }, [mode, store]);

  useEffect(() => {
    if (!sync.accountMismatch) setConfirmWipe(false);
  }, [sync.accountMismatch]);

  const shell = (children: React.ReactNode) => (
    <section>
      <div className="p-4 md:p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">{children}</div>
    </section>
  );

  if (!configured) {
    return shell(
      <div className="flex items-start gap-3 text-sm text-slate-700 dark:text-zinc-300">
        <CloudOff className="w-5 h-5 shrink-0 text-slate-500" />
        <p className="leading-relaxed">
          Tính năng đăng nhập, đồng bộ giữa các máy và bảng xếp hạng chưa dùng được trong bản này. Bạn vẫn học bình
          thường, dữ liệu được lưu ngay trên máy.
        </p>
      </div>
    );
  }

  if (!ready) {
    return shell(
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra tài khoản…
      </div>
    );
  }

  if (!user) {
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const s = store();
      if (mode === "signin") await s.signIn(email, password);
      else if (mode === "signup") await s.signUp(email, password, name);
      else await s.resetPassword(email);
    };
    return shell(
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div className="flex items-start gap-3">
          <Cloud className="w-5 h-5 shrink-0 text-teal-700 dark:text-teal-300 mt-0.5" />
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            Đăng nhập để giữ tiến trình học giữa các máy và thi đua với bạn bè. Dữ liệu vẫn nằm trên máy; tài khoản chỉ đồng bộ bản sao.
            Sách ngữ pháp của bạn không bao giờ được tải lên.
          </p>
        </div>
        {mode === "forgot" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <span className="text-base font-semibold text-slate-900 dark:text-zinc-100">
              Đặt lại mật khẩu qua email
            </span>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="min-h-11 px-1 text-sm font-semibold text-teal-700 dark:text-teal-300 hover:underline"
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {([["signin", "Đăng nhập"], ["signup", "Tạo tài khoản"]] as const).map(([m, label]) => (
              <button
                type="button"
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "min-h-11 px-4 py-2 rounded-full text-sm font-semibold border transition-colors",
                  mode === m
                    ? "bg-teal-700 border-teal-700 text-white dark:bg-teal-600 dark:border-teal-600"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <input className={field} type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "signup" && (
          <input className={field} required minLength={3} maxLength={20} placeholder="Tên hiển thị trên bảng xếp hạng (3–20 ký tự)" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        {mode !== "forgot" && (
          <input
            className={field}
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {error && <div className="text-sm text-red-700 dark:text-red-300">{error}</div>}
        {notice && <div className="text-sm text-green-700 dark:text-green-300">{notice}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primary} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Đăng nhập" : mode === "signup" ? "Tạo tài khoản" : "Gửi thư đặt lại mật khẩu"}
          </button>
          {mode === "signin" && (
            <button type="button" onClick={() => setMode("forgot")} className="min-h-11 px-1 text-sm font-medium text-teal-700 dark:text-teal-300 hover:underline">
              Quên mật khẩu?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" onClick={() => setMode("signin")} className="min-h-11 px-1 text-sm font-medium text-teal-700 dark:text-teal-300 hover:underline">
              Quay lại
            </button>
          )}
        </div>
      </form>
    );
  }

  const syncing = sync.status === "syncing";
  return shell(
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            title="Đổi ảnh đại diện"
            aria-expanded={pickingAvatar}
            onClick={() => setPickingAvatar((v) => !v)}
            className="relative rounded-full shrink-0 p-1 -m-1 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 hover:ring-2 hover:ring-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600 transition"
          >
            <Avatar id={profile?.avatar} name={profile?.displayName ?? user.email} size="lg" />
            <span className="absolute -bottom-0.5 -right-0.5 px-1.5 rounded-full bg-teal-700 text-white text-xs font-semibold leading-4">Đổi</span>
          </button>
          <div className="min-w-0">
            {editName === null ? (
              <div className="text-lg font-semibold text-slate-900 dark:text-zinc-100 truncate">
                {profile?.displayName ?? "…"}
                <button
                  type="button"
                  onClick={() => setEditName(profile?.displayName ?? "")}
                  className="ml-2 min-h-11 px-1 text-sm font-medium text-teal-700 dark:text-teal-300 hover:underline"
                >
                  Đổi tên
                </button>
              </div>
            ) : (
              <form
                className="flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await store().updateDisplayName(editName)) setEditName(null);
                }}
              >
                <input
                  className={field}
                  minLength={3}
                  maxLength={20}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditName(null);
                  }}
                  autoFocus
                />
                <button type="submit" className={secondary} disabled={busy || editName.trim().length < 3}>
                  Lưu
                </button>
                <button type="button" className={secondary} onClick={() => setEditName(null)}>
                  Hủy
                </button>
              </form>
            )}
            <div className="text-sm text-slate-500 dark:text-zinc-400 truncate">{user.email}</div>
          </div>
        </div>
        <button type="button" className={secondary} disabled={busy || syncing} onClick={() => void store().signOut()}>
          <LogOut className="w-4 h-4" /> Đăng xuất
        </button>
      </div>
      {pickingAvatar && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Chọn ảnh đại diện</div>
          <div role="radiogroup" aria-label="Ảnh đại diện" className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={profile?.avatar === a.id}
                title={a.label}
                disabled={busy}
                onClick={async () => {
                  if (await store().updateAvatar(a.id)) setPickingAvatar(false);
                }}
                className={cn(
                  "rounded-full p-1 min-w-11 min-h-11 inline-flex items-center justify-center border-2 transition disabled:opacity-50",
                  profile?.avatar === a.id ? "border-teal-700 dark:border-teal-400" : "border-transparent hover:border-slate-300 dark:hover:border-zinc-600"
                )}
              >
                <Avatar id={a.id} name={a.label} size="md" />
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <div className="text-sm text-red-700 dark:text-red-300">{error}</div>}

      {sync.accountMismatch ? (
        <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 space-y-3 text-sm text-slate-700 dark:text-zinc-300">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {sync.mismatchReason === "reset"
              ? "Tài khoản đã được đặt lại từ một máy khác"
              : "Máy này đang chứa dữ liệu của một tài khoản khác"}
          </div>
          <p className="leading-relaxed">
            {sync.mismatchReason === "reset"
              ? "Dữ liệu trên tài khoản đã bị xóa bằng \"Đặt lại toàn bộ dữ liệu ứng dụng\" ở một máy khác. Máy này vẫn còn tiến trình cũ. Chọn cách xử lý:"
              : "Bạn vừa đăng nhập bằng tài khoản mới, nhưng tiến trình trên máy đã đồng bộ với tài khoản trước. Chọn cách xử lý:"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              disabled={busy || syncing}
              onClick={() => void resolveAccountMismatch("merge")}
            >
              {sync.mismatchReason === "reset" ? "Giữ tiến trình máy này, gửi lại lên tài khoản" : "Gộp dữ liệu máy này vào tài khoản mới"}
            </button>
            {confirmWipe ? (
              <>
                <button
                  type="button"
                  disabled={busy || syncing}
                  className="min-h-12 px-5 py-2 rounded-2xl text-base font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
                  onClick={() => void resolveAccountMismatch("wipe")}
                >
                  Chắc chắn: xóa dữ liệu trên máy
                </button>
                <button
                  type="button"
                  disabled={busy || syncing}
                  className={secondary}
                  onClick={() => setConfirmWipe(false)}
                >
                  Hủy
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy || syncing}
                className={secondary}
                onClick={() => setConfirmWipe(true)}
              >
                {sync.mismatchReason === "reset" ? "Xóa dữ liệu trên máy này cho khớp tài khoản" : "Xóa dữ liệu trên máy, bắt đầu từ tài khoản mới"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5 text-sm">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-zinc-100">
              {syncing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Đang đồng bộ…</>
              ) : sync.status === "error" ? (
                <><CloudOff className="w-4 h-4 text-red-600" /> Chưa đồng bộ được</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /> Tiến trình được đồng bộ</>
              )}
            </div>
            <div className="text-slate-500 dark:text-zinc-400">Lần gần nhất: {formatTime(sync.lastSyncAt)}</div>
            {sync.error && <div className="text-red-700 dark:text-red-300">{sync.error}</div>}
            {sync.lastReport && !syncing && (sync.lastReport.pushed > 0 || sync.lastReport.applied > 0) && (
              <div className="text-slate-500 dark:text-zinc-400">
                Gửi lên {sync.lastReport.pushed} mục · nhận về {sync.lastReport.applied} thay đổi
              </div>
            )}
          </div>
          <button type="button" className={secondary} disabled={busy || syncing} onClick={() => void runSync()}>
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} /> Đồng bộ ngay
          </button>
        </div>
      )}
      <label className="flex items-start justify-between gap-3 cursor-pointer border-t border-slate-100 dark:border-zinc-800 pt-4">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-900 dark:text-zinc-100">Hiện cuộc đua xếp hạng (XP)</div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Thẻ "Cuộc đua tuần này" ở màn Hôm nay, dòng hạng ở menu và hạng mới sau mỗi phiên ôn. Đang tắt thì bạn không bị so sánh với ai: bảng xếp hạng vẫn xem được ở mục Xếp hạng. Cũng chỉnh được ở Cài đặt, phần Giao diện.
          </p>
        </div>
        <input type="checkbox" checked={rankWidgets} onChange={(e) => useStandingStore.getState().setEnabled(e.target.checked)} className="mt-1 w-5 h-5 shrink-0 accent-teal-700" />
      </label>
      <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
        Đồng bộ: từ vựng và lịch ôn, lịch sử ôn tập, sổ lỗi, điểm ngữ pháp, điểm XP, chuỗi ngày và các cài đặt học. Không đồng bộ: nội dung sách ngữ pháp
        bạn nhập, khóa API, đường dẫn máy.
      </p>
    </>
  );
}
