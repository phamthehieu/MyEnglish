import { useEffect, useState } from "react";
import { Target, Gauge, CalendarClock, AlertTriangle } from "lucide-react";
import {
  loadLearningInsights,
  loadWorkloadForecast,
  MIN_RETENTION_SAMPLE,
  type LearningInsights,
  type WorkloadForecast,
} from "@/services/progress";
import { saveStudyLimits } from "@/services/srs";
import { isComebackRunning } from "@/services/comeback";

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);

function RetentionTile({ label, value, count, target }: { label: string; value: number | null; count: number; target: number }) {
  const enough = count >= MIN_RETENTION_SAMPLE && value != null;
  const delta = enough ? (value as number) - target : 0;
  const tone = !enough
    ? "text-slate-600 dark:text-zinc-400"
    : Math.abs(delta) <= 0.03
    ? "text-green-700 dark:text-green-400"
    : delta < 0
    ? "text-red-600 dark:text-red-400"
    : "text-teal-700 dark:text-teal-300";
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/50">
      <div className="text-xs text-slate-600 dark:text-zinc-400">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{pct(value)}</div>
      <div className="text-xs text-slate-600 dark:text-zinc-400">
        {count} lượt ôn{count < MIN_RETENTION_SAMPLE ? " · chưa đủ dữ liệu" : ""}
      </div>
    </div>
  );
}

/**
 * How well the schedule fits this learner: true retention (answers to cards in Review state, the number
 * the schedule aims at the target), predicted vs actual recall, and the review load of the next 30 days.
 */
export default function LearningInsightsCard() {
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [forecast, setForecast] = useState<WorkloadForecast | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const load = () => {
    loadLearningInsights(30).then(setInsights).catch(() => {});
    loadWorkloadForecast(30).then(setForecast).catch(() => {});
  };
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("words-changed", onChange);
    return () => window.removeEventListener("words-changed", onChange);
  }, []);

  if (!insights || !forecast) return null;
  const r = insights.retention;
  const maxDay = Math.max(1, forecast.maxSessionSize, ...forecast.days.map((d) => d.reviews));
  const suggestedNew = Math.max(2, Math.round(forecast.newCardsPerDay / 2));
  // Overload is judged on the days after today (not the pile a break leaves on today), and the comeback plan
  // already spreads that pile and pauses new words: no lasting cut is offered while it runs
  const offerFewerNew = forecast.overloaded && !isComebackRunning() && forecast.newCardsPerDay > suggestedNew;

  let advice: string | null = null;
  if (r.count >= MIN_RETENTION_SAMPLE && r.trueRetention != null) {
    if (r.trueRetention < r.targetRetention - 0.05) {
      advice =
        "Bạn đang nhớ ít hơn mục tiêu: khoảng ôn hiện dài hơn trí nhớ thật. Nên giảm số từ mới mỗi ngày, và khi đủ dữ liệu hãy chạy mục Tối ưu theo trí nhớ của bạn trong Cài đặt.";
    } else if (r.trueRetention > r.targetRetention + 0.05) {
      advice = "Bạn nhớ tốt hơn mục tiêu: có thể ôn thưa hơn (mục Tối ưu theo trí nhớ của bạn trong Cài đặt sẽ kéo dài khoảng ôn cho đúng với bạn).";
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Target className="h-5 w-5 text-teal-700 dark:text-teal-300" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">Hiệu quả ghi nhớ (30 ngày)</h3>
        <span className="text-xs md:ml-auto text-slate-600 dark:text-zinc-400">
          Mục tiêu: {pct(r.targetRetention)} · {insights.minutesPerActiveDay.toFixed(1)} phút trả lời/ngày học
        </span>
      </div>

      {/* True retention */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <RetentionTile label="Tỉ lệ nhớ thật" value={r.trueRetention} count={r.count} target={r.targetRetention} />
        <RetentionTile label="Nhận diện (EN→VN)" value={r.recognition.retention} count={r.recognition.count} target={r.targetRetention} />
        <RetentionTile label="Tự nhớ ra từ" value={r.production.retention} count={r.production.count} target={r.targetRetention} />
        <RetentionTile label="Từ còn non (< 21 ngày)" value={r.young.retention} count={r.young.count} target={r.targetRetention} />
      </div>
      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
        Chỉ tính lượt ôn đúng lịch của thẻ đã thuộc (không tính từ mới, luyện thêm hay làm lại) — đây là con số lịch ôn
        nhắm tới mục tiêu. Gần mục tiêu ±3% là lịch ôn đang khớp với trí nhớ của bạn.
      </p>
      {advice && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{advice}</span>
        </div>
      )}

      {/* Calibration */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
          <Gauge className="w-3.5 h-3.5" /> Dự đoán của app so với thực tế
        </div>
        {insights.calibration.length === 0 ? (
          <p className="text-xs text-slate-600 dark:text-zinc-400">Chưa có lượt ôn nào của thẻ đã thuộc kể từ khi bắt đầu ghi dữ liệu này.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-600 dark:text-zinc-400 text-left">
                <th className="font-medium py-1">Khả năng nhớ dự đoán</th>
                <th className="font-medium py-1 text-right">Dự đoán</th>
                <th className="font-medium py-1 text-right">Thực tế</th>
                <th className="font-medium py-1 text-right">Số lượt</th>
              </tr>
            </thead>
            <tbody>
              {insights.calibration.map((b) => (
                <tr key={b.label} className="border-t border-slate-100 dark:border-zinc-800/80">
                  <td className="py-1.5 font-mono text-slate-700 dark:text-zinc-300">{b.label}</td>
                  <td className="py-1.5 text-right font-mono text-slate-600 dark:text-zinc-400">{pct(b.predicted)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-white">{pct(b.actual)}</td>
                  <td className="py-1.5 text-right font-mono text-slate-600 dark:text-zinc-400">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Workload forecast */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
          <CalendarClock className="w-3.5 h-3.5" /> Lượt ôn đến hạn 30 ngày tới
          <span className="text-xs font-normal md:ml-auto text-slate-600 dark:text-zinc-400">
            TB 7 ngày tới: {forecast.upcomingPerDay.toFixed(1)}/ngày · 1 phiên = {forecast.maxSessionSize} thẻ
          </span>
        </div>
        <div className="relative h-28 flex items-end gap-[2px]" onMouseLeave={() => setHovered(null)}>
          {/* Session-size reference line */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-slate-300 dark:border-zinc-700 pointer-events-none"
            style={{ bottom: `${(forecast.maxSessionSize / maxDay) * 100}%` }}
          />
          {forecast.days.map((d, i) => (
            <div
              key={d.date}
              className="flex-1 h-full flex items-end cursor-default"
              onMouseEnter={() => setHovered(i)}
            >
              <div
                className={`w-full rounded-t-[4px] ${
                  hovered === i ? "bg-teal-800 dark:bg-teal-300" : "bg-teal-700 dark:bg-teal-500"
                }`}
                style={{ height: `${Math.max(d.reviews > 0 ? 3 : 0, (d.reviews / maxDay) * 100)}%` }}
              />
            </div>
          ))}
          {hovered !== null && (
            <div
              className="absolute -top-2 px-2 py-1 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-mono pointer-events-none whitespace-nowrap"
              style={{ left: `min(calc(${(hovered / forecast.days.length) * 100}% ), calc(100% - 110px))` }}
            >
              {hovered === 0 ? "Hôm nay (gồm quá hạn)" : forecast.days[hovered].date}: {forecast.days[hovered].reviews} lượt
            </div>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-600 dark:text-zinc-400 font-mono">
          <span>Hôm nay</span>
          <span>+15 ngày</span>
          <span>+30 ngày</span>
        </div>
        {offerFewerNew && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-900 dark:text-amber-100">
            <span className="min-w-0 flex-1">
              Trung bình mỗi ngày cần ôn nhiều hơn một phiên. Từ mới sẽ làm tải tăng thêm — nên giảm còn {suggestedNew} từ mới/ngày cho tới khi
              hết tồn đọng.
            </span>
            <button
              onClick={() => {
                saveStudyLimits({ newCardsPerDay: suggestedNew });
                setApplied(`Đã đặt ${suggestedNew} từ mới/ngày`);
                load();
              }}
              className="shrink-0 min-h-11 px-4 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold"
            >
              Áp dụng
            </button>
          </div>
        )}
        {applied && <p className="text-sm text-green-700 dark:text-green-400">{applied}</p>}
      </div>
    </div>
  );
}
