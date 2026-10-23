/**
 * Mouth-position videos (with the sound) for the sounds of the chart. The files are named `NN_symbol.mp4` and use the
 * American symbols; the chart uses British ones, so a few sounds borrow the nearest American video.
 */
const FILES = import.meta.glob("../assets/video/IPA/*.mp4", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const BY_SYMBOL: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) {
  const sym = path.match(/\/\d+_(.+)\.mp4$/)?.[1];
  if (sym) BY_SYMBOL[sym] = url;
}

/** chart symbol -> symbol of the video that shows it */
const ALIAS: Record<string, string> = {
  "iː": "i",
  "uː": "u",
  "e": "ɛ",
  "ɜː": "ɝ",
  "ɔː": "ɔ",
  "ɑː": "ɑ",
  "ɒ": "ɑ",
  "ɪə": "ɪr",
  "ʊə": "ʊr",
  "eə": "ɛr",
  "əʊ": "oʊ",
  "ɡ": "g",
};

export function phonemeVideo(sym: string): string | undefined {
  return BY_SYMBOL[ALIAS[sym] ?? sym];
}
