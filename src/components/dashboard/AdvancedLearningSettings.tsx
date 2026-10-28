import { useEffect, useRef, useState } from "react";
import { Cpu, Download, Upload, RotateCcw, CalendarRange } from "lucide-react";
import {
  MIN_OPTIMIZER_CARDS,
  MIN_OPTIMIZER_REVIEWS,
  computePersonalWeights,
  getStoredWeights,
  loadTrainingItems,
  resetWeights,
  saveWeights,
  type OptimizerResult,
} from "@/services/fsrsOptimizer";
import { exportBackupJson, exportWordsCsv, importBackup, parseBackup } from "@/services/dataExport";
import { getFSRSSettings, saveFSRSSettings } from "@/services/srs";
import { useSimpleMode } from "../Jargon";

const BOX = "p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-2.5";
const BTN =
  "min-h-10 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Review-schedule settings that need care: personal parameters (optimizer) and the longest interval.
 * Shown under the retention setting. Backup / restore lives in BackupRestoreSettings, next to the reset.
 */
export default function AdvancedLearningSettings() {
  const [data, setData] = useState<{ reviewCount: number; cardCount: number } | null>(null);
  const [stored, setStored] = useState(getStoredWeights);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [maxInterval, setMaxInterval] = useState(() => getFSRSSettings().maximumInterval);
  const simple = useSimpleMode();

  useEffect(() => {
    loadTrainingItems()
      .then(({ reviewCount, cardCount }) => setData({ reviewCount, cardCount }))
      .catch(() => setData({ reviewCount: 0, cardCount: 0 }));
  }, [stored]);

  const enough = !!data && data.reviewCount >= MIN_OPTIMIZER_REVIEWS && data.cardCount >= MIN_OPTIMIZER_CARDS;
  const improves = result ? result.new_metrics.log_loss < result.default_metrics.log_loss : false;

  const runOptimizer = async () => {
    setRunning(true);
    setMessage(null);
    setResult(null);
    try {
      const { items } = await loadTrainingItems();
      setResult(await computePersonalWeights(items));
    } catch (err) {
      setMessage(`Không tối ưu được: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const fmt = (x: number) => x.toFixed(4);

  return (
    <div className="space-y-3">
      {/* Personal schedule parameters: advanced, hidden in simple mode */}
      {!simple && <div className={BOX}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <div className="text-sm font-bold text-slate-900 dark:text-white">Tối ưu theo trí nhớ của bạn</div>
          <span className="sm:ml-auto text-xs font-mono text-slate-600 dark:text-zinc-400">
            {stored ? `Đang dùng tham số riêng (${new Date(stored.computedAt).toLocaleDateString("vi-VN")})` : "Đang dùng tham số mặc định"}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
          App có thể học cách bạn quên từ chính lịch sử ôn của bạn (chỉ tính lượt ôn đúng lịch), để khoảng ôn khớp với tốc độ
          quên thật: ít lượt ôn thừa hơn mà vẫn giữ mục tiêu ghi nhớ. Cần ít nhất {MIN_OPTIMIZER_REVIEWS} lượt ôn trên {MIN_OPTIMIZER_CARDS} thẻ.
        </p>
        {data && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${Math.min(100, (data.reviewCount / MIN_OPTIMIZER_REVIEWS) * 100)}%` }}
              />
            </div>
            <div className="text-xs font-mono text-slate-600 dark:text-zinc-400">
              {data.reviewCount}/{MIN_OPTIMIZER_REVIEWS} lượt ôn · {data.cardCount}/{MIN_OPTIMIZER_CARDS} thẻ
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runOptimizer}
            disabled={!enough || running}
            className={`${BTN} bg-cyan-600 hover:bg-cyan-500 text-white`}
          >
            {running ? "Đang tối ưu..." : "Tối ưu ngay"}
          </button>
          {stored && (
            <button
              onClick={() => {
                resetWeights();
                setStored(null);
                setMessage("Đã quay về tham số mặc định.");
              }}
              className={`${BTN} border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1`}
            >
              <RotateCcw className="w-3 h-3" /> Khôi phục mặc định
            </button>
          )}
        </div>
        {result && (
          <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs space-y-2">
            <table className="w-full font-mono">
              <thead>
                <tr className="text-slate-600 dark:text-zinc-400 text-left">
                  <th className="font-medium">Sai số (thấp hơn = khớp hơn)</th>
                  <th className="font-medium text-right">Mặc định</th>
                  <th className="font-medium text-right">Của bạn</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 dark:text-zinc-200">
                <tr>
                  <td>
                    <span className="font-sans">Độ lệch dự đoán</span>
                  </td>
                  <td className="text-right">{fmt(result.default_metrics.log_loss)}</td>
                  <td className="text-right font-bold">{fmt(result.new_metrics.log_loss)}</td>
                </tr>
                <tr>
                  <td>
                    <span className="font-sans">Sai số trung bình</span>
                  </td>
                  <td className="text-right">{fmt(result.default_metrics.rmse)}</td>
                  <td className="text-right font-bold">{fmt(result.new_metrics.rmse)}</td>
                </tr>
              </tbody>
            </table>
            <p className={improves ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
              {improves
                ? "Tham số riêng dự đoán trí nhớ của bạn tốt hơn mặc định — nên áp dụng."
                : "Tham số riêng không tốt hơn mặc định — nên giữ mặc định và thử lại khi có thêm dữ liệu."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  saveWeights(result);
                  setStored(getStoredWeights());
                  setResult(null);
                  setMessage("Đã áp dụng tham số riêng. Lịch ôn mới được tính từ lượt ôn tiếp theo.");
                }}
                className={`${BTN} bg-emerald-600 hover:bg-emerald-500 text-white`}
              >
                Áp dụng
              </button>
              <button onClick={() => setResult(null)} className={`${BTN} border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300`}>
                Bỏ qua
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* Longest interval */}
      <div className={BOX}>
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <div className="text-sm font-bold text-slate-900 dark:text-white">Khoảng ôn dài nhất</div>
          <span className="ml-auto text-sm font-bold text-cyan-700 dark:text-cyan-400 font-mono">{maxInterval} ngày</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Từ đã thuộc rất chắc vẫn được hỏi lại ít nhất một lần trong khoảng này. Dài hơn = ít lượt ôn hơn cho từ đã vững.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[365, 730, 1825, 3650].map((val) => (
            <button
              key={val}
              onClick={() => {
                saveFSRSSettings({ maximumInterval: val });
                setMaxInterval(val);
              }}
              className={`min-h-10 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                maxInterval === val
                  ? "bg-cyan-600 text-white shadow-sm font-bold"
                  : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
              }`}
            >
              {val >= 730 ? `${Math.round(val / 365)} năm` : "1 năm"}
            </button>
          ))}
        </div>
      </div>

      {message && <p className="text-xs text-cyan-700 dark:text-cyan-300 break-words">{message}</p>}
    </div>
  );
}

/** Back up the learner's data to a file, and restore it from one (shown in "Dữ liệu & đặt lại", beside the reset) */
export function BackupRestoreSettings({ onWordsChanged }: { onWordsChanged?: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className={BOX}>
      <div className="text-sm font-bold text-slate-900 dark:text-white">Sao lưu & khôi phục dữ liệu</div>
      <p className="text-xs text-slate-600 dark:text-zinc-400">
        Nên sao lưu trước khi đặt lại hoặc đổi máy. File được lưu vào thư mục Downloads. Khôi phục chỉ thêm dữ liệu mới, không ghi đè từ và tiến độ đang có.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            exportBackupJson()
              .then((p) => setMessage(`Đã sao lưu toàn bộ dữ liệu: ${p}`))
              .catch((e) => setMessage(`Sao lưu lỗi: ${e}`))
          }
          className={`${BTN} bg-slate-900 dark:bg-white text-white dark:text-slate-900 inline-flex items-center gap-1`}
        >
          <Download className="w-3.5 h-3.5" /> Sao lưu toàn bộ
        </button>
        <button
          onClick={() =>
            exportWordsCsv()
              .then((p) => setMessage(`Đã xuất danh sách từ: ${p}`))
              .catch((e) => setMessage(`Xuất danh sách lỗi: ${e}`))
          }
          className={`${BTN} border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1`}
        >
          <Download className="w-3.5 h-3.5" /> Danh sách từ (bảng tính)
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className={`${BTN} border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 inline-flex items-center gap-1`}
        >
          <Upload className="w-3.5 h-3.5" /> Khôi phục từ file...
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const report = await importBackup(parseBackup(await file.text()));
              const added = report.inserted.words ?? 0;
              setMessage(
                `Đã khôi phục ${added} từ mới (${report.inserted.review_logs ?? 0} lượt ôn)` +
                  (report.skippedExistingWords > 0 ? `, bỏ qua ${report.skippedExistingWords} từ đã có.` : ".")
              );
              onWordsChanged?.();
            } catch (err) {
              setMessage(`Không khôi phục được: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
      </div>
      {message && <p className="text-xs text-cyan-700 dark:text-cyan-300 break-words">{message}</p>}
    </div>
  );
}
