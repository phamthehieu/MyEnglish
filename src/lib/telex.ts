/**
 * English typed with a Vietnamese keyboard (Telex) comes out with Vietnamese letters: "how" becomes "hơ", "lower"
 * becomes "lơer", "need" becomes "nêd". These turn such text back into the keys that were pressed.
 */

export interface VietDecomposition {
  base: string;
  telexKeys: string[];
}

/**
 * Decomposes Vietnamese accented characters back into their base ASCII vowel/consonant
 * and corresponding Telex key strokes (e.g. 'ỉ' -> { base: 'i', telexKeys: ['r'] }).
 */
export function decomposeVietnameseChar(ch: string): VietDecomposition | null {
  if (ch === "đ" || ch === "Đ") {
    return { base: "d", telexKeys: ["d"] };
  }
  const nfd = ch.normalize("NFD");
  if (nfd.length === 1 && nfd === ch) return null;

  const base = nfd[0].toLowerCase();
  const telexKeys: string[] = [];

  for (let i = 1; i < nfd.length; i++) {
    const code = nfd.charCodeAt(i);
    switch (code) {
      case 0x0309: // hỏi (e.g. ỉ, ả, ẻ, ỏ, ủ, ỷ) -> 'r'
        telexKeys.push("r");
        break;
      case 0x0301: // sắc (e.g. í, á, é, ó, ú, ý) -> 's'
        telexKeys.push("s");
        break;
      case 0x0300: // huyền (e.g. ì, à, è, ò, ù, ỳ) -> 'f'
        telexKeys.push("f");
        break;
      case 0x0303: // ngã (e.g. ĩ, ã, ẽ, õ, ũ, ỹ) -> 'x'
        telexKeys.push("x");
        break;
      case 0x0323: // nặng (e.g. ị, ạ, ẹ, ọ, ụ, ỵ) -> 'j'
        telexKeys.push("j");
        break;
      case 0x0306: // ă (a + w) -> 'w'
        telexKeys.push("w");
        break;
      case 0x031B: // ơ, ư (o + w, u + w) -> 'w'
        telexKeys.push("w");
        break;
      case 0x0302: // â, ê, ô (a + a, e + e, o + o) -> repeat base
        telexKeys.push(base);
        break;
      default:
        break;
    }
  }

  if (telexKeys.length === 0) return null;
  return { base, telexKeys };
}

/** Whether the text has letters only a Vietnamese keyboard makes (ơ, ê, á, đ...) */
export function hasVietnameseLetters(text: string): boolean {
  return [...text].some((ch) => decomposeVietnameseChar(ch) !== null);
}

/** More marked letters than this: not English typed with Telex, nothing to undo */
const MAX_MARKED = 4;

/**
 * The words the learner may have meant: each marked letter's keys go right after it ("hơ" → "how") or at the end of
 * the word, where Telex users type tones ("thẻi" → "their"). Empty when there is nothing to undo.
 */
export function undoTelex(text: string): string[] {
  const chars = [...text];
  const marked = chars.flatMap((ch, i) => {
    const d = decomposeVietnameseChar(ch);
    return d ? [{ i, d }] : [];
  });
  if (marked.length === 0 || marked.length > MAX_MARKED) return [];
  const out = new Set<string>();
  for (let mask = 0; mask < 1 << marked.length; mask++) {
    let body = "";
    let tail = "";
    chars.forEach((ch, i) => {
      const m = marked.findIndex((x) => x.i === i);
      if (m === -1) {
        body += ch;
        return;
      }
      const { base, telexKeys } = marked[m].d;
      const keys = telexKeys.join("");
      // A cased letter keeps its case on the base
      body += ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? base.toUpperCase() : base;
      if (mask & (1 << m)) tail += keys;
      else body += keys;
    });
    out.add(body + tail);
  }
  return [...out];
}
