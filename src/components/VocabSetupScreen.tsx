import { useState } from "react";
import { AlertTriangle, Layers, Loader2 } from "lucide-react";
import type { StudyLevel } from "@/services/vocabCatalog";
import { defaultStudyLevelsFor, setStudyLevels, topUpNewWords } from "@/services/vocabFeed";
import { resetVocabulary } from "@/services/vocabReset";
import { exportBackupJson } from "@/services/dataExport";
import { getUserOverrideLevel } from "@/services/userProficiency";
import { LevelPicker, mixDescription } from "./dashboard/VocabTab";
import { Button } from "./ui/kit";

interface VocabSetupScreenProps {
  /** "migrate": words from before the Oxford deck exist and must be cleared first; "levels": just choose levels */
  mode: "migrate" | "levels";
  onDone: () => void;
}

/**
 * Shown once when the vocabulary becomes the Oxford deck: nothing is deleted until the learner confirms,
 * and a full backup is written to Downloads first. Then the levels to study.
 */
export default function VocabSetupScreen({ mode, onDone }: VocabSetupScreenProps) {
  const [step, setStep] = useState<"migrate" | "levels">(mode);
  const [levels, setLevels] = useState<StudyLevel[]>(() => defaultStudyLevelsFor(getUserOverrideLevel()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [backupFailed, setBackupFailed] = useState(false);

  const reset = async (withBackup: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (withBackup) {
        try {
          setBackupPath(await exportBackupJson());
        } catch (err) {
          setBackupFailed(true);
          setError(`Không sao lưu được: ${err}. Chưa có gì bị xoá.`);
          return;
        }
      }
      await resetVocabulary();
      setStep("levels");
    } catch (err) {
      setError(`Không xoá được dữ liệu cũ: ${err}`);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setStudyLevels(levels);
      await topUpNewWords();
      onDone();
    } catch (err) {
      setError(`Không chuẩn bị được từ vựng: ${err}`);
      setBusy(false);
    }
  };

  const footer = "sticky bottom-0 z-10 -mx-4 space-y-1 border-t border-slate-200 bg-[#F7F8FA]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95";

  return (
    <div className="popup-backdrop-enter fixed inset-0 z-50 overflow-y-auto bg-[#F7F8FA] dark:bg-zinc-950">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {step === "migrate" ? (
          <>
            <div className="flex-1 space-y-6 pb-6">
              <div className="space-y-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                  <Layers className="h-6 w-6" />
                </span>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Từ vựng chuyển sang bộ Oxford 5000</h1>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Từ nay app dùng một bộ từ duy nhất: <b>5.004 từ Oxford 3000 và 5000</b>, từ A1 đến C1, có nghĩa tiếng Việt theo từ loại, câu ví dụ Anh–Việt và phiên âm. Bạn chọn cấp muốn học, mỗi ngày app đưa vào vài từ mới.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1.5">
                  <p>
                    Toàn bộ từ vựng hiện có, cùng lịch ôn và lịch sử ôn, sẽ bị <b>xoá</b>; bạn học lại từ A1 (từ nào đã biết thì bấm "Đã biết" là bỏ qua).
                  </p>
                  <p>Được giữ lại: ngữ pháp, phát âm, sổ lỗi, chuỗi ngày học, XP, huy hiệu và cài đặt.</p>
                  <p>Trước khi xoá, app sao lưu toàn bộ dữ liệu vào thư mục Downloads.</p>
                </div>
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <div className={footer}>
              <Button size="lg" block onClick={() => reset(true)} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Sao lưu & bắt đầu lại
              </Button>
              {backupFailed && (
                <Button variant="danger" block onClick={() => reset(false)} disabled={busy} className="mt-2">
                  Xoá mà không sao lưu
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-6 pb-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bạn muốn học từ vựng cấp nào?</h1>
                {backupPath && <p className="text-sm text-green-700 dark:text-green-400">Đã sao lưu vào {backupPath}</p>}
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Việc học luôn bắt đầu từ A1; chọn thêm cấp cao hơn để trộn vào. Đổi lại lúc nào cũng được trong tab Lộ trình từ vựng.
                </p>
              </div>
              <LevelPicker value={levels} onChange={setLevels} disabled={busy} />
              <p className="text-sm text-slate-600 dark:text-zinc-400">{mixDescription(levels)}</p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <div className={footer}>
              <Button size="lg" block onClick={start} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Bắt đầu học
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
