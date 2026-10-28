import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  getUiScale,
  isFoundationMode,
  isSimpleMode,
  setFoundationMode,
  setSimpleMode,
  setUiScale,
  UI_SCALES,
  type UiScale,
} from "@/services/learnerProfile";
import { englishVoices, getTtsSettings, handleSpeak, onVoicesChanged, saveTtsSettings, type TtsVoice } from "../review/speech";
import { getSoundSettings, playSound, saveSoundSettings } from "@/services/sound";
import { useStandingStore } from "@/stores/standingStore";

const SCALE_LABEL: Record<UiScale, string> = { 1: "Vừa", 1.1: "Lớn", 1.25: "Rất lớn" };

/** Settings for beginners: text size, simple mode, foundation mode, rank widgets, answer sounds, voice and speaking speed */
export default function DisplaySettings() {
  const [simple, setSimple] = useState(isSimpleMode);
  const [foundation, setFoundation] = useState(isFoundationMode);
  const [scale, setScale] = useState<UiScale>(getUiScale);
  const [tts, setTts] = useState(getTtsSettings);
  const [sound, setSound] = useState(getSoundSettings);
  const [voices, setVoices] = useState<TtsVoice[]>(englishVoices);
  const rankWidgets = useStandingStore((s) => s.enabled);

  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    return onVoicesChanged(load);
  }, []);

  const toggle = (label: string, hint: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-start justify-between gap-3 cursor-pointer min-h-10">
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">{label}</div>
        <p className="text-xs text-slate-600 dark:text-zinc-400">{hint}</p>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-cyan-600" />
    </label>
  );

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-400">Giao diện, âm thanh & giọng đọc</div>
      <div className="space-y-1.5 pb-3 border-b border-slate-200 dark:border-zinc-800">
        <div className="text-sm font-bold text-slate-900 dark:text-white">Cỡ chữ</div>
        <div className="flex flex-wrap gap-2">
          {UI_SCALES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setUiScale(s);
                setScale(s);
              }}
              className={`min-h-10 px-4 py-2 rounded-lg text-sm font-semibold border ${scale === s
                ? "bg-cyan-600 text-white border-cyan-600"
                : "border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                }`}
            >
              {SCALE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {toggle(
        "Chế độ đơn giản",
        "Ít nút và ít chữ khó hơn trên màn hình, nút chấm bằng tiếng Việt dễ hiểu.",
        simple,
        (v) => {
          setSimpleMode(v);
          setSimple(v);
        }
      )}
      {toggle(
        "Chế độ mất gốc (học lại từ đầu)",
        "Ưu tiên ngữ pháp nền tảng; chế độ Đọc chỉ coi từ chức năng (the, is, in…) là đã biết; bài tự gõ từ bắt đầu sau khi bạn đã nhận ra từ chắc chắn (7 ngày).",
        foundation,
        (v) => {
          setFoundationMode(v);
          setFoundation(v);
        }
      )}
      {toggle(
        "Hiện cuộc đua xếp hạng (XP)",
        "Thẻ \"Cuộc đua tuần này\" ở màn Hôm nay, dòng hạng ở menu và hạng mới sau mỗi phiên ôn (cần đăng nhập). Tắt nếu bạn thấy áp lực: bảng xếp hạng vẫn xem được ở mục Xếp hạng.",
        rankWidgets,
        (v) => useStandingStore.getState().setEnabled(v)
      )}
      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
        {toggle(
          "Âm thanh phản hồi",
          "Tiếng \"ting\" khi trả lời đúng, tiếng nhẹ khi sai, âm đặc biệt mỗi 5 câu đúng liên tiếp và khi xong phiên.",
          sound.enabled,
          (v) => {
            setSound(saveSoundSettings({ enabled: v }));
            if (v) playSound("correct");
          }
        )}
        {sound.enabled && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              Âm lượng
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={sound.volume}
                onChange={(e) => setSound(saveSoundSettings({ volume: Number(e.target.value) }))}
                onPointerUp={() => playSound("correct")}
                className="accent-cyan-600"
              />
              <span className="font-mono w-8">{Math.round(sound.volume * 100)}%</span>
            </label>
            <button
              onClick={() => playSound("combo")}
              className="inline-flex items-center gap-1 min-h-10 px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs"
            >
              <Volume2 className="w-3.5 h-3.5" /> Nghe thử
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <div className="text-sm font-bold text-slate-900 dark:text-white">Giọng đọc tiếng Anh</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tts.voiceURI}
            onChange={(e) => setTts(saveTtsSettings({ voiceURI: e.target.value }))}
            className="text-sm min-h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 max-w-full sm:max-w-[16rem]"
          >
            <option value="">Mặc định của máy</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
            Tốc độ
            <input
              type="range"
              min={0.6}
              max={1.1}
              step={0.05}
              value={tts.rate}
              onChange={(e) => setTts(saveTtsSettings({ rate: Number(e.target.value) }))}
              className="accent-cyan-600"
            />
            <span className="font-mono w-8">{tts.rate.toFixed(2)}</span>
          </label>
          <button
            onClick={() => handleSpeak("Hello. I fixed the bug and pushed the code.")}
            className="inline-flex items-center gap-1 min-h-10 px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs"
          >
            <Volume2 className="w-3.5 h-3.5" /> Nghe thử
          </button>
        </div>
        <p className="desktop-only text-xs text-slate-600 dark:text-zinc-400">
          Giọng "Enhanced"/"Premium" trên macOS nghe tự nhiên hơn (tải thêm trong Cài đặt hệ thống → Trợ năng → Nội dung được đọc).
        </p>
      </div>
    </div>
  );
}
