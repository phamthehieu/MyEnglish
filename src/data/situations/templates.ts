import type { Situation } from "@/types/situation";
import { validateSituation } from "@/services/talk/validate";

/**
 * One built-in conversation, many versions: a "slot" is a thing that can change in it (the drink, the dish, the place,
 * the price…). Each slot lists the other values it can take, as the words to replace in the English and in the
 * Vietnamese. Every time a conversation starts, each slot picks its own value at random (the original included), so
 * "a coffee" can be "a tea" and "five dollars" can be "six dollars" without writing another conversation.
 * Only plain words are swapped (the ids of lines and turns never change), and a version that would not pass
 * validateSituation is dropped in favour of the original.
 */
type Pairs = Array<[from: string, to: string]>;
export interface SlotOption {
  en: Pairs;
  vi: Pairs;
}
export type Slot = SlotOption[];

export const SLOTS: Record<string, Slot[]> = {
  "cafe-order": [
    [
      { en: [["a coffee", "a tea"], ["coffee", "tea"]], vi: [["ly cà phê", "ly trà"], ["cà phê", "trà"]] },
      { en: [["a coffee", "an orange juice"], ["coffee", "orange juice"]], vi: [["ly cà phê", "ly nước cam"], ["cà phê", "nước cam"]] },
      { en: [["a coffee", "a hot chocolate"], ["coffee", "hot chocolate"]], vi: [["ly cà phê", "ly sô cô la nóng"], ["cà phê", "sô cô la nóng"]] },
    ],
    [
      { en: [["a sandwich", "a cake"], ["sandwich", "cake"]], vi: [["bánh sandwich", "bánh ngọt"], ["sandwich", "bánh ngọt"]] },
      { en: [["a sandwich", "a cookie"], ["sandwich", "cookie"]], vi: [["bánh sandwich", "bánh quy"], ["sandwich", "bánh quy"]] },
    ],
    [
      { en: [["five dollars", "six dollars"]], vi: [["năm đô", "sáu đô"]] },
      { en: [["five dollars", "four dollars"]], vi: [["năm đô", "bốn đô"]] },
      { en: [["five dollars", "seven dollars"]], vi: [["năm đô", "bảy đô"]] },
    ],
  ],
  restaurant: [
    [
      { en: [["the chicken", "the beef"], ["chicken", "beef"]], vi: [["món gà", "món bò"]] },
      { en: [["the chicken", "the pasta"], ["chicken", "pasta"]], vi: [["món gà", "món mì Ý"]] },
    ],
    [
      { en: [["the fish", "the soup"], ["fish", "soup"]], vi: [["món cá", "món súp"]] },
      { en: [["the fish", "the salad"], ["fish", "salad"]], vi: [["món cá", "món salad"]] },
    ],
    [{ en: [["water", "juice"]], vi: [["nước lọc", "nước ép"]] }],
    [
      { en: [["for two", "for three"]], vi: [["hai người", "ba người"]] },
      { en: [["for two", "for four"]], vi: [["hai người", "bốn người"]] },
    ],
  ],
  shopping: [
    [
      { en: [["blue", "red"]], vi: [["màu xanh", "màu đỏ"]] },
      { en: [["blue", "green"]], vi: [["màu xanh", "màu xanh lá"]] },
      { en: [["blue", "black"]], vi: [["màu xanh", "màu đen"]] },
    ],
    [
      { en: [["twenty dollars", "thirty dollars"]], vi: [["hai mươi đô", "ba mươi đô"]] },
      { en: [["twenty dollars", "fifteen dollars"]], vi: [["hai mươi đô", "mười lăm đô"]] },
    ],
  ],
  "ask-direction": [
    [
      { en: [["the station", "the bank"], ["station", "bank"]], vi: [["nhà ga", "ngân hàng"]] },
      { en: [["the station", "the school"], ["station", "school"]], vi: [["nhà ga", "trường học"]] },
      { en: [["the station", "the hospital"], ["station", "hospital"]], vi: [["nhà ga", "bệnh viện"]] },
    ],
    [{ en: [["turn left", "turn right"]], vi: [["rẽ trái", "rẽ phải"]] }],
    [
      { en: [["five minutes", "ten minutes"]], vi: [["năm phút", "mười phút"]] },
      { en: [["five minutes", "two minutes"]], vi: [["năm phút", "hai phút"]] },
    ],
  ],
  "introduce-yourself": [
    [
      { en: [["Minh", "David"]], vi: [["Minh", "David"]] },
      { en: [["Minh", "Mary"]], vi: [["Minh", "Mary"]] },
      { en: [["Minh", "Peter"]], vi: [["Minh", "Peter"]] },
    ],
    [
      { en: [["Vietnam", "Japan"]], vi: [["Việt Nam", "Nhật Bản"]] },
      { en: [["Vietnam", "Korea"]], vi: [["Việt Nam", "Hàn Quốc"]] },
      { en: [["Vietnam", "Thailand"]], vi: [["Việt Nam", "Thái Lan"]] },
    ],
    [
      { en: [["a software engineer", "a teacher"], ["I work with computers", "I work at a school"]], vi: [["kỹ sư phần mềm", "giáo viên"]] },
      { en: [["a software engineer", "a doctor"], ["I work with computers", "I work in a hospital"]], vi: [["kỹ sư phần mềm", "bác sĩ"]] },
    ],
  ],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace `from` by `to` as a whole word, keeping a capital letter at the start of a sentence */
function swapWords(text: string, pairs: Pairs): string {
  let out = text;
  for (const [from, to] of pairs) {
    out = out.replace(new RegExp(`(?<![A-Za-z])${escape(from)}(?![A-Za-z])`, "gi"), (m) => (m[0] !== m[0].toLowerCase() && from[0] === from[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
  }
  return out;
}

/** Plain replacement for the Vietnamese (no word boundaries: Vietnamese words are made of several syllables) */
function swapPlain(text: string, pairs: Pairs): string {
  return pairs.reduce((acc, [from, to]) => acc.split(from).join(to), text);
}

export interface Filled {
  situation: Situation;
  /** The same change for any other text of the conversation (the other ways to say a turn) */
  rewrite: (en: string, vi: string) => { en: string; vi: string };
}

/** The conversation with a random value in each of its slots (the original when it has none, or the result is not valid) */
export function fillSlots(situation: Situation, random: () => number = Math.random): Filled {
  const slots = SLOTS[situation.id];
  const same: Filled = { situation, rewrite: (en, vi) => ({ en, vi }) };
  if (!slots) return same;
  const en: Pairs = [];
  const vi: Pairs = [];
  for (const slot of slots) {
    // The original is one of the choices
    const pick = Math.floor(random() * (slot.length + 1));
    if (pick === 0) continue;
    en.push(...slot[pick - 1].en);
    vi.push(...slot[pick - 1].vi);
  }
  if (en.length === 0 && vi.length === 0) return same;
  const rewrite = (e: string, v: string) => ({ en: swapWords(e, en), vi: swapPlain(v, vi) });
  const both = (t: string) => swapPlain(swapWords(t, en), vi);
  const filled: Situation = {
    ...situation,
    lines: situation.lines.map((l) => ({
      ...l,
      en: swapWords(l.en, en),
      vi: swapPlain(l.vi, vi),
      accept: l.accept.map((a) => swapWords(a, en)),
      ...(l.note ? { note: both(l.note) } : {}),
    })),
    dialogue: situation.dialogue.map((n) => ({ ...n, npc_en: swapWords(n.npc_en, en), npc_vi: swapPlain(n.npc_vi, vi) })),
  };
  return validateSituation(filled).length === 0 ? { situation: filled, rewrite } : same;
}
