import type { WordDetail } from "@/types/database";
import { getWordsLite } from "@/services/db";

export interface ConfusablePhonemePair {
  id: string;
  symA: string; // e.g. "iː"
  symB: string; // e.g. "ɪ"
  nameA: string;
  nameB: string;
  title: string;
  mouthTipA: string;
  mouthTipB: string;
  differenceTip: string;
  vietnamesePitfall: string;
  defaultPairs: Array<{
    wordA: string;
    ipaA: string;
    meaningA?: string;
    wordB: string;
    ipaB: string;
    meaningB?: string;
  }>;
}

/**
 * Top confusable phoneme pairs that Vietnamese English learners struggle with most.
 * Each pair comes with default minimal pairs to guarantee practice even when the user's
 * current deck is small.
 */
export const CONFUSABLE_PHONEME_PAIRS: ConfusablePhonemePair[] = [
  {
    id: "i_long_vs_short",
    symA: "iː",
    symB: "ɪ",
    nameA: "/iː/ (i dài)",
    nameB: "/ɪ/ (i ngắn)",
    title: "Phân biệt /iː/ (dài) và /ɪ/ (ngắn)",
    mouthTipA: "Môi căng sang hai bên như đang cười mỉm, lưỡi đưa cao ra trước, giữ âm dài gấp đôi.",
    mouthTipB: "Môi thả lỏng tự nhiên, hạ hàm dưới một chút, đọc âm ngắn và dứt khoát.",
    differenceTip: "/iː/ căng môi và ngân dài; /ɪ/ thả lỏng cơ miệng và bật âm thật nhanh.",
    vietnamesePitfall: "Người Việt có xu hướng đọc cả hai thành 'i' lơ lửng, khiến 'sheep' (cừu) nghe thành 'ship' (tàu), 'leave' (rời đi) thành 'live' (sống).",
    defaultPairs: [
      { wordA: "sheep", ipaA: "/ʃiːp/", meaningA: "con cừu", wordB: "ship", ipaB: "/ʃɪp/", meaningB: "con tàu" },
      { wordA: "seat", ipaA: "/siːt/", meaningA: "chỗ ngồi", wordB: "sit", ipaB: "/sɪt/", meaningB: "ngồi xuống" },
      { wordA: "leave", ipaA: "/liːv/", meaningA: "rời đi", wordB: "live", ipaB: "/lɪv/", meaningB: "sống" },
      { wordA: "beat", ipaA: "/biːt/", meaningA: "đánh bại", wordB: "bit", ipaB: "/bɪt/", meaningB: "một chút" },
      { wordA: "feet", ipaA: "/fiːt/", meaningA: "bàn chân", wordB: "fit", ipaB: "/fɪt/", meaningB: "vừa vặn" },
    ],
  },
  {
    id: "e_vs_ae",
    symA: "e",
    symB: "æ",
    nameA: "/e/ (e ngắn)",
    nameB: "/æ/ (a bẹt)",
    title: "Phân biệt /e/ và /æ/ (a bẹt)",
    mouthTipA: "Mở miệng vừa phải, lưỡi hơi thấp, đọc nhanh giống âm 'e' tiếng Việt.",
    mouthTipB: "Hạ quai hàm thật sâu, căng khóe miệng sang hai bên, phát âm lai giữa 'a' và 'e'.",
    differenceTip: "/æ/ mở miệng to hơn rất nhiều và hạ sâu cằm dưới so với /e/.",
    vietnamesePitfall: "Hay đọc /æ/ thành 'e' hoặc 'a' thuần Việt, khiến 'man' (đàn ông) nghe giống 'men' (những người đàn ông), 'bad' (xấu) nghe giống 'bed' (cái giường).",
    defaultPairs: [
      { wordA: "bed", ipaA: "/bed/", meaningA: "cái giường", wordB: "bad", ipaB: "/bæd/", meaningB: "tồi tệ, xấu" },
      { wordA: "men", ipaA: "/men/", meaningA: "đàn ông (số nhiều)", wordB: "man", ipaB: "/mæn/", meaningB: "người đàn ông" },
      { wordA: "pen", ipaA: "/pen/", meaningA: "cây bút", wordB: "pan", ipaB: "/pæn/", meaningB: "cái chảo" },
      { wordA: "send", ipaA: "/send/", meaningA: "gửi đi", wordB: "sand", ipaB: "/sænd/", meaningB: "cát" },
      { wordA: "head", ipaA: "/hed/", meaningA: "cái đầu", wordB: "had", ipaB: "/hæd/", meaningB: "đã có" },
    ],
  },
  {
    id: "u_short_vs_long",
    symA: "ʊ",
    symB: "uː",
    nameA: "/ʊ/ (u ngắn)",
    nameB: "/uː/ (u dài)",
    title: "Phân biệt /ʊ/ (ngắn) và /uː/ (dài)",
    mouthTipA: "Môi hơi tròn và thả lỏng, lưỡi hơi lùi về sau, đọc ngắn dứt khoát.",
    mouthTipB: "Môi chu tròn hẳn ra phía trước như đang huýt sáo, giữ âm kéo dài.",
    differenceTip: "/uː/ chu môi tròn căng và ngân dài; /ʊ/ chỉ tròn nhẹ và dứt nhanh.",
    vietnamesePitfall: "Dễ đọc /ʊ/ dài ra thành /uː/, khiến 'full' (đầy) bị hiểu nhầm thành 'fool' (kẻ ngốc), 'pull' (kéo) thành 'pool' (hồ bơi).",
    defaultPairs: [
      { wordA: "pull", ipaA: "/pʊl/", meaningA: "kéo lại", wordB: "pool", ipaB: "/puːl/", meaningB: "hồ bơi" },
      { wordA: "full", ipaA: "/fʊl/", meaningA: "đầy đủ", wordB: "fool", ipaB: "/fuːl/", meaningB: "kẻ ngốc" },
      { wordA: "look", ipaA: "/lʊk/", meaningA: "nhìn xem", wordB: "Luke", ipaB: "/luːk/", meaningB: "tên Luke" },
      { wordA: "foot", ipaA: "/fʊt/", meaningA: "bàn chân", wordB: "food", ipaB: "/fuːd/", meaningB: "thức ăn" },
    ],
  },
  {
    id: "s_vs_z",
    symA: "s",
    symB: "z",
    nameA: "/s/ (vô thanh)",
    nameB: "/z/ (hữu thanh)",
    title: "Phân biệt /s/ (xì nhẹ) và /z/ (rung cổ họng)",
    mouthTipA: "Răng khép nhẹ, đẩy luồng hơi mạnh qua kẽ răng, dây thanh quản KHÔNG rung.",
    mouthTipB: "Khẩu hình giống hệt /s/, nhưng phát âm làm rung dây thanh quản ở cổ họng.",
    differenceTip: "Đặt tay lên cổ họng: /s/ không có độ rung, /z/ sẽ thấy cổ họng rung rõ như tiếng ve kêu.",
    vietnamesePitfall: "Người Việt hay biến mọi âm /z/ ở đuôi từ thành /s/ (ví dụ: 'is', 'eyes', 'buzz').",
    defaultPairs: [
      { wordA: "bus", ipaA: "/bʌs/", meaningA: "xe buýt", wordB: "buzz", ipaB: "/bʌz/", meaningB: "tiếng vo ve" },
      { wordA: "ice", ipaA: "/aɪs/", meaningA: "nước đá", wordB: "eyes", ipaB: "/aɪz/", meaningB: "đôi mắt" },
      { wordA: "price", ipaA: "/praɪs/", meaningA: "giá cả", wordB: "prize", ipaB: "/praɪz/", meaningB: "giải thưởng" },
      { wordA: "sip", ipaA: "/sɪp/", meaningA: "nhấp ngụm", wordB: "zip", ipaB: "/zɪp/", meaningB: "kéo khóa" },
      { wordA: "peace", ipaA: "/piːs/", meaningA: "hòa bình", wordB: "peas", ipaB: "/piːz/", meaningB: "hạt đậu" },
    ],
  },
  {
    id: "sh_vs_s",
    symA: "ʃ",
    symB: "s",
    nameA: "/ʃ/ (sặng tròn môi)",
    nameB: "/s/ (xì nhẹ thẳng)",
    title: "Phân biệt /ʃ/ (chu môi) và /s/ (cười mở mép)",
    mouthTipA: "Chu môi tròn ra trước như đang ra hiệu 'suỵt', đẩy hơi mạnh qua vòm họng.",
    mouthTipB: "Mép mở rộng sang hai bên, đầu lưỡi gần răng cửa trên, xì nhẹ.",
    differenceTip: "/ʃ/ môi chu tròn về phía trước; /s/ khóe miệng bẹt sang hai bên.",
    vietnamesePitfall: "Hay đọc /ʃ/ thành /s/, khiến 'she' (cô ấy) nghe thành 'see' (nhìn thấy), 'ship' thành 'sip'.",
    defaultPairs: [
      { wordA: "she", ipaA: "/ʃiː/", meaningA: "cô ấy", wordB: "see", ipaB: "/siː/", meaningB: "nhìn thấy" },
      { wordA: "ship", ipaA: "/ʃɪp/", meaningA: "con tàu", wordB: "sip", ipaB: "/sɪp/", meaningB: "nhấp ngụm" },
      { wordA: "shoe", ipaA: "/ʃuː/", meaningA: "đôi giày", wordB: "sue", ipaB: "/suː/", meaningB: "kiện tụng" },
      { wordA: "shame", ipaA: "/ʃeɪm/", meaningA: "xấu hổ", wordB: "same", ipaB: "/seɪm/", meaningB: "giống nhau" },
    ],
  },
  {
    id: "th_unvoiced_vs_s",
    symA: "θ",
    symB: "s",
    nameA: "/θ/ (thè lưỡi thổi hơi)",
    nameB: "/s/ (răng khép xì hơi)",
    title: "Phân biệt /θ/ (thè đầu lưỡi) và /s/",
    mouthTipA: "Đặt nhẹ đầu lưỡi kẹp giữa 2 hàm răng, thổi luồng hơi nhẹ ra ngoài.",
    mouthTipB: "Đầu lưỡi rút hoàn toàn vào trong sau răng cửa, khép răng và xì hơi.",
    differenceTip: "/θ/ bắt buộc phải thấy đầu lưỡi thò ra giữa hai răng; /s/ giấu lưỡi bên trong.",
    vietnamesePitfall: "Rất nhiều người Việt biến âm /θ/ thành /s/ hoặc /t/, khiến 'think' (nghĩ) thành 'sink' (chìm).",
    defaultPairs: [
      { wordA: "think", ipaA: "/θɪŋk/", meaningA: "suy nghĩ", wordB: "sink", ipaB: "/sɪŋk/", meaningB: "chìm xuống" },
      { wordA: "thick", ipaA: "/θɪk/", meaningA: "dày cộm", wordB: "sick", ipaB: "/sɪk/", meaningB: "ốm đau" },
      { wordA: "theme", ipaA: "/θiːm/", meaningA: "chủ đề", wordB: "seem", ipaB: "/siːm/", meaningB: "dường như" },
      { wordA: "thank", ipaA: "/θæŋk/", meaningA: "cảm ơn", wordB: "sank", ipaB: "/sæŋk/", meaningB: "đã chìm" },
    ],
  },
  {
    id: "ch_vs_j",
    symA: "tʃ",
    symB: "dʒ",
    nameA: "/tʃ/ (vô thanh)",
    nameB: "/dʒ/ (hữu thanh)",
    title: "Phân biệt /tʃ/ (bật hơi) và /dʒ/ (rung họng)",
    mouthTipA: "Chu môi, chặn hơi bằng đầu lưỡi rồi bật mạnh dứt khoát, thanh quản không rung.",
    mouthTipB: "Khẩu hình giống /tʃ/ nhưng dây thanh quản rung mạnh ở cổ họng.",
    differenceTip: "/tʃ/ chỉ có tiếng gió bật mạnh; /dʒ/ có giọng âm rung rõ.",
    vietnamesePitfall: "Hay đọc lẫn lộn giữa 'ch' và 'gi', khiến 'cheap' (rẻ) nghe như 'jeep' (xe jeep).",
    defaultPairs: [
      { wordA: "cheap", ipaA: "/tʃiːp/", meaningA: "giá rẻ", wordB: "jeep", ipaB: "/dʒiːp/", meaningB: "xe jeep" },
      { wordA: "choke", ipaA: "/tʃəʊk/", meaningA: "nghẹt thở", wordB: "joke", ipaB: "/dʒəʊk/", meaningB: "lời nói đùa" },
      { wordA: "chain", ipaA: "/tʃeɪn/", meaningA: "sợi xích", wordB: "Jane", ipaB: "/dʒeɪn/", meaningB: "tên Jane" },
    ],
  },
  {
    id: "o_long_vs_short",
    symA: "ɔː",
    symB: "ɒ",
    nameA: "/ɔː/ (o dài)",
    nameB: "/ɒ/ (o ngắn)",
    title: "Phân biệt /ɔː/ (dài) và /ɒ/ (ngắn)",
    mouthTipA: "Môi tròn căng về trước, lưỡi lùi sâu, giữ âm ngân dài và sâu từ cổ họng.",
    mouthTipB: "Hạ quai hàm mở rộng môi, đọc ngắn dứt khoát như 'o' tiếng Việt.",
    differenceTip: "/ɔː/ tròn môi hơn và kéo dài; /ɒ/ mở to hàm hơn và đọc rất nhanh.",
    vietnamesePitfall: "Người Việt thường không giữ đủ độ dài của /ɔː/, khiến 'sport' nghe giống 'spot', 'port' giống 'pot'.",
    defaultPairs: [
      { wordA: "sport", ipaA: "/spɔːt/", meaningA: "thể thao", wordB: "spot", ipaB: "/spɒt/", meaningB: "điểm, đốm" },
      { wordA: "port", ipaA: "/pɔːt/", meaningA: "bến cảng", wordB: "pot", ipaB: "/pɒt/", meaningB: "cái nồi" },
      { wordA: "cord", ipaA: "/kɔːd/", meaningA: "dây thừng", wordB: "cod", ipaB: "/kɒd/", meaningB: "cá tuyết" },
    ],
  },
  {
    id: "p_vs_b",
    symA: "p",
    symB: "b",
    nameA: "/p/ (bật hơi)",
    nameB: "/b/ (hữu thanh)",
    title: "Phân biệt /p/ (bật gió) và /b/ (rung)",
    mouthTipA: "Mím chặt 2 môi, nén hơi rồi bật mạnh ra luồng gió, không rung thanh quản.",
    mouthTipB: "Mím 2 môi rồi mở ra tạo âm, dây thanh quản rung ngay từ đầu.",
    differenceTip: "Đặt tờ giấy trước miệng: đọc /p/ tờ giấy sẽ bay mạnh; đọc /b/ tờ giấy hầu như không lay chuyển.",
    vietnamesePitfall: "Tiếng Việt không có âm /p/ đứng đầu từ nên người học hay phát âm yếu hoặc nhầm sang /b/.",
    defaultPairs: [
      { wordA: "pat", ipaA: "/pæt/", meaningA: "vỗ nhẹ", wordB: "bat", ipaB: "/bæt/", meaningB: "con dơi / gậy" },
      { wordA: "pig", ipaA: "/pɪɡ/", meaningA: "con lợn", wordB: "big", ipaB: "/bɪɡ/", meaningB: "to lớn" },
      { wordA: "pea", ipaA: "/piː/", meaningA: "hạt đậu", wordB: "bee", ipaB: "/biː/", meaningB: "con ong" },
      { wordA: "pin", ipaA: "/pɪn/", meaningA: "ghim cài", wordB: "bin", ipaB: "/bɪn/", meaningB: "thùng rác" },
    ],
  },
  {
    id: "l_vs_r",
    symA: "l",
    symB: "r",
    nameA: "/l/ (đầu lưỡi chạm nướu)",
    nameB: "/r/ (uốn lưỡi không chạm)",
    title: "Phân biệt /l/ và /r/",
    mouthTipA: "Đầu lưỡi chạm thẳng vào phần nướu sau răng cửa trên, luồng hơi thoát ra 2 bên lưỡi.",
    mouthTipB: "Môi hơi chu tròn, đầu lưỡi uốn cong lên hướng vòm miệng nhưng TUYỆT ĐỐI không chạm.",
    differenceTip: "/l/ đầu lưỡi phải tiếp xúc với nướu răng; /r/ đầu lưỡi lơ lửng không chạm bất kỳ điểm nào.",
    vietnamesePitfall: "Nhiều người Việt hay ngọng l/r hoặc đọc /r/ thành âm 'd'/'r' giật của tiếng Việt.",
    defaultPairs: [
      { wordA: "light", ipaA: "/laɪt/", meaningA: "ánh sáng", wordB: "right", ipaB: "/raɪt/", meaningB: "đúng đắn / bên phải" },
      { wordA: "lake", ipaA: "/leɪk/", meaningA: "hồ nước", wordB: "rake", ipaB: "/reɪk/", meaningB: "cái cào" },
      { wordA: "lead", ipaA: "/liːd/", meaningA: "dẫn dắt", wordB: "read", ipaB: "/riːd/", meaningB: "đọc sách" },
    ],
  },
];

/** Clean IPA phonetic string for robust substring / symbol matching */
function normalizePhonetic(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/[/\\\[\]ˈˌ.]/g, "")
    .trim()
    .toLowerCase();
}

/** Check if normalized phonetic contains the target sound symbol */
function containsPhoneme(normalizedIpa: string, sym: string): boolean {
  if (!normalizedIpa) return false;
  // Handle length mark variation (e.g. i: or iː)
  const cleanSym = sym.replace(/ː/g, ":");
  const cleanIpa = normalizedIpa.replace(/ː/g, ":");
  return cleanIpa.includes(cleanSym) || cleanIpa.includes(sym);
}

export interface UserWordMatch {
  word: string;
  ipa: string;
  meaningVn?: string;
  sound: "A" | "B";
}

export interface PhonemeDrillItem {
  id: string;
  word: string;
  ipa: string;
  meaningVn?: string;
  sound: string; // e.g. "iː"
  soundLabel: string; // e.g. "/iː/ (dài)"
  isSoundA: boolean;
  pairedWord?: string;
  pairedIpa?: string;
  fromUserDeck: boolean;
}

export interface PhonemeEarQuizQuestion {
  id: string;
  sayWord: string;
  sayIpa: string;
  correctSound: string;
  options: Array<{
    id: string;
    label: string;
    word?: string;
    ipa?: string;
    isCorrect: boolean;
  }>;
  explanation: string;
}

export interface PhonemeChallengeSession {
  pair: ConfusablePhonemePair;
  userWordsA: UserWordMatch[];
  userWordsB: UserWordMatch[];
  drillItems: PhonemeDrillItem[];
  earQuiz: PhonemeEarQuizQuestion[];
}

/**
 * Scan recently learned or reviewed words to find the most prominent confusable phoneme pair.
 */
export function buildPhonemeChallenge(words: WordDetail[]): PhonemeChallengeSession {
  // Sort words by recency: last_review first, then created_at
  const sorted = [...words].sort((a, b) => {
    const timeA = a.srs?.last_review ? new Date(a.srs.last_review).getTime() : new Date(a.created_at).getTime();
    const timeB = b.srs?.last_review ? new Date(b.srs.last_review).getTime() : new Date(b.created_at).getTime();
    return timeB - timeA;
  });

  // Pick top 40 recent words with phonetics
  const recentCandidates = sorted.filter((w) => !!w.phonetic).slice(0, 40);

  // Score each confusable pair
  let bestPair = CONFUSABLE_PHONEME_PAIRS[0];
  let highestScore = -1;
  let bestWordsA: UserWordMatch[] = [];
  let bestWordsB: UserWordMatch[] = [];

  for (const pair of CONFUSABLE_PHONEME_PAIRS) {
    const matchA: UserWordMatch[] = [];
    const matchB: UserWordMatch[] = [];

    for (const w of recentCandidates) {
      const norm = normalizePhonetic(w.phonetic);
      const hasA = containsPhoneme(norm, pair.symA);
      const hasB = containsPhoneme(norm, pair.symB);

      if (hasA && !matchA.some((m) => m.word.toLowerCase() === w.word.toLowerCase())) {
        matchA.push({
          word: w.word,
          ipa: w.phonetic || `/${pair.symA}/`,
          meaningVn: w.meaning_vn,
          sound: "A",
        });
      }
      if (hasB && !matchB.some((m) => m.word.toLowerCase() === w.word.toLowerCase())) {
        matchB.push({
          word: w.word,
          ipa: w.phonetic || `/${pair.symB}/`,
          meaningVn: w.meaning_vn,
          sound: "B",
        });
      }
    }

    // Scoring heuristic:
    // Pairs that have BOTH sound A and sound B in the user's recent words get a heavy boost (+15)
    // so they are prioritized over pairs where the user only knows sound A or sound B.
    let score = matchA.length + matchB.length;
    if (matchA.length > 0 && matchB.length > 0) {
      score += 15 + Math.min(matchA.length, matchB.length) * 2;
    }

    if (score > highestScore) {
      highestScore = score;
      bestPair = pair;
      bestWordsA = matchA;
      bestWordsB = matchB;
    }
  }

  // Construct Drill Items:
  // Blend user words with standard minimal pairs
  const drillItems: PhonemeDrillItem[] = [];
  const seenWords = new Set<string>();

  // 1. Add user words
  for (const u of bestWordsA.slice(0, 3)) {
    drillItems.push({
      id: `drill-user-a-${u.word}`,
      word: u.word,
      ipa: u.ipa,
      meaningVn: u.meaningVn,
      sound: bestPair.symA,
      soundLabel: bestPair.nameA,
      isSoundA: true,
      fromUserDeck: true,
    });
    seenWords.add(u.word.toLowerCase());
  }

  for (const u of bestWordsB.slice(0, 3)) {
    drillItems.push({
      id: `drill-user-b-${u.word}`,
      word: u.word,
      ipa: u.ipa,
      meaningVn: u.meaningVn,
      sound: bestPair.symB,
      soundLabel: bestPair.nameB,
      isSoundA: false,
      fromUserDeck: true,
    });
    seenWords.add(u.word.toLowerCase());
  }

  // 2. Add default minimal pairs to guarantee contrasting pairs
  for (const def of bestPair.defaultPairs) {
    if (!seenWords.has(def.wordA.toLowerCase())) {
      drillItems.push({
        id: `drill-def-a-${def.wordA}`,
        word: def.wordA,
        ipa: def.ipaA,
        meaningVn: def.meaningA,
        sound: bestPair.symA,
        soundLabel: bestPair.nameA,
        isSoundA: true,
        pairedWord: def.wordB,
        pairedIpa: def.ipaB,
        fromUserDeck: false,
      });
      seenWords.add(def.wordA.toLowerCase());
    }
    if (!seenWords.has(def.wordB.toLowerCase())) {
      drillItems.push({
        id: `drill-def-b-${def.wordB}`,
        word: def.wordB,
        ipa: def.ipaB,
        meaningVn: def.meaningB,
        sound: bestPair.symB,
        soundLabel: bestPair.nameB,
        isSoundA: false,
        pairedWord: def.wordA,
        pairedIpa: def.ipaA,
        fromUserDeck: false,
      });
      seenWords.add(def.wordB.toLowerCase());
    }
    if (drillItems.length >= 8) break;
  }

  // 3. Build 5 Ear-Quiz Questions
  const earQuiz: PhonemeEarQuizQuestion[] = [];
  const testPool = [...bestPair.defaultPairs];

  testPool.slice(0, 5).forEach((p, idx) => {
    // Alternate between testing Word A and Word B
    const isTestingA = idx % 2 === 0;
    const targetWord = isTestingA ? p.wordA : p.wordB;
    const targetIpa = isTestingA ? p.ipaA : p.ipaB;
    const targetSound = isTestingA ? bestPair.nameA : bestPair.nameB;
    const decoySound = isTestingA ? bestPair.nameB : bestPair.nameA;

    const options = [
      { id: "opt-1", label: `${targetSound} (như trong '${targetWord}')`, word: targetWord, ipa: targetIpa, isCorrect: true },
      { id: "opt-2", label: `${decoySound} (như trong '${isTestingA ? p.wordB : p.wordA}')`, word: isTestingA ? p.wordB : p.wordA, ipa: isTestingA ? p.ipaB : p.ipaA, isCorrect: false },
    ];

    // Shuffle options for odd indices
    if (idx % 2 === 1) options.reverse();

    earQuiz.push({
      id: `ear-q-${idx + 1}`,
      sayWord: targetWord,
      sayIpa: targetIpa,
      correctSound: targetSound,
      options,
      explanation: `'${p.wordA}' ${p.ipaA} mang âm ${bestPair.nameA}; trong khi '${p.wordB}' ${p.ipaB} mang âm ${bestPair.nameB}.`,
    });
  });

  return {
    pair: bestPair,
    userWordsA: bestWordsA,
    userWordsB: bestWordsB,
    drillItems,
    earQuiz,
  };
}

/** Rapid Micro-Phoneme quiz question for ReviewNudge card */
export interface MicroPhonemeQuizQuestion {
  pairId: string;
  title: string;
  spokenWord: string;
  spokenIpa: string;
  correctSound: string;
  wrongSound: string;
  explanation: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
}

/**
 * Generate a single rapid 1-question phoneme challenge for the floating/in-app Review Nudge
 */
export async function selectMicroPhonemeQuiz(allWords?: WordDetail[]): Promise<MicroPhonemeQuizQuestion | null> {
  try {
    const words = allWords && allWords.length > 0 ? allWords : await getWordsLite().catch(() => []);
    const session = buildPhonemeChallenge(words);
    const pair = session.pair;

    // Pick 1 minimal pair from the default set
    const sample = pair.defaultPairs[Math.floor(Math.random() * pair.defaultPairs.length)] || pair.defaultPairs[0];
    const isA = Math.random() < 0.5;
    const spokenWord = isA ? sample.wordA : sample.wordB;
    const spokenIpa = isA ? sample.ipaA : sample.ipaB;
    const correctSound = isA ? `/${pair.symA}/` : `/${pair.symB}/`;
    const wrongSound = isA ? `/${pair.symB}/` : `/${pair.symA}/`;

    const options = [
      { id: "opt-a", text: `${correctSound} (như trong '${spokenWord}')`, isCorrect: true },
      { id: "opt-b", text: `${wrongSound} (như trong '${isA ? sample.wordB : sample.wordA}')`, isCorrect: false },
    ];

    // 50% chance swap display order
    if (Math.random() < 0.5) options.reverse();

    return {
      pairId: pair.id,
      title: `Nghe & Phân biệt: /${pair.symA}/ hay /${pair.symB}/?`,
      spokenWord,
      spokenIpa,
      correctSound,
      wrongSound,
      explanation: `'${sample.wordA}' ${sample.ipaA} mang âm /${pair.symA}/; còn '${sample.wordB}' ${sample.ipaB} mang âm /${pair.symB}/.`,
      options,
    };
  } catch (err) {
    console.warn("Failed to generate micro phoneme quiz:", err);
    return null;
  }
}
