/**
 * Teacher-crafted pedagogical guide for English pronunciation.
 * Provides physical mouth anchors (muscle memory), phonics rules (spelling-to-sound recognition),
 * and Vietnamese learner pitfalls for every phoneme and confusable pair.
 */

import type { ConfusablePhonemePair } from "./phonemeMatcher";

export interface TeacherGuide {
  soundTitle: string; // e.g. "Âm /ɪ/ (i ngắn)"
  mouthAnchor: string; // Khẩu hình thực tế dễ làm theo
  phonicsRule?: string; // Mẹo nhận diện mặt chữ
  pitfall?: string; // Cảnh báo lỗi người Việt hay gặp
  memoryMnemonic?: string; // Mẹo ghi nhớ vui nhộn
}

interface SoundGuideSpec {
  name: string;
  mouthAnchor: string;
  phonicsRule: string;
  pitfall: string;
  memoryMnemonic?: string;
}

const SOUND_GUIDES: Record<string, SoundGuideSpec> = {
  // --- Nguyên âm đơn ---
  "iː": {
    name: "/iː/ (i dài)",
    mouthAnchor: "Cười toét miệng sang 2 bên như chụp ảnh 'cheese', cơ má căng lên, giữ âm dài gấp đôi bình thường.",
    phonicsRule: "Thường gặp ở chữ 'ee' (sheep, see), 'ea' (tea, eat, seat), 'ie' (piece) hoặc 'e' cuối từ (he, she).",
    pitfall: "Đừng đọc ngắn kẻo 'sheep' (con cừu) bị người nghe hiểu nhầm thành 'ship' (con tàu)!",
    memoryMnemonic: "Cười tươi kéo dài = i dài.",
  },
  "ɪ": {
    name: "/ɪ/ (i ngắn)",
    mouthAnchor: "Thả lỏng quai hàm, miệng hơi hờ hững, phát âm dứt khoát nửa 'i' nửa 'ê', giật nhẹ cơ bụng.",
    phonicsRule: "Chữ 'i' đứng kẹp giữa 2 phụ âm (ship, sit, fit, trip, win, kick) hầu như luôn đọc là /ɪ/ ngắn.",
    pitfall: "Đừng căng mép như tiếng Việt; phải thả lỏng cơ miệng và bật âm thật nhanh dứt khoát.",
    memoryMnemonic: "Thả lỏng giật bụng = i ngắn.",
  },
  "e": {
    name: "/e/ (e ngắn)",
    mouthAnchor: "Mở miệng tự nhiên vừa phải, lưỡi hạ thấp, đọc ngắn dứt khoát giống âm 'e' tiếng Việt.",
    phonicsRule: "Thường gặp ở chữ 'e' đứng giữa phụ âm (bed, pen, get, red, check, friend).",
    pitfall: "Đừng há miệng quá to kẻo biến thành âm /æ/ (bed cái giường nghe nhầm thành bad xấu).",
  },
  "æ": {
    name: "/æ/ (a bẹt)",
    mouthAnchor: "Hạ quai hàm thật sâu xuống dưới, căng rộng khóe miệng sang hai bên, phát âm lai giữa 'a' và 'e'.",
    phonicsRule: "Chữ 'a' đứng giữa 2 phụ âm (bad, man, cat, bag, map, fan, hat) thường đọc là /æ/.",
    pitfall: "Người Việt hay đọc thành 'e' (bad -> bed) hoặc 'a' thuần Việt. Hãy nhớ: phải há cằm thật sâu!",
    memoryMnemonic: "Há cằm sâu hết cỡ = a bẹt.",
  },
  "uː": {
    name: "/uː/ (u dài)",
    mouthAnchor: "Môi chu tròn hẳn ra phía trước như đang huýt sáo hoặc thổi nến, giữ âm ngân dài.",
    phonicsRule: "Thường gặp ở chữ 'oo' (food, moon, pool, cool), 'ue' (blue, true), 'ew' (new, chew).",
    pitfall: "Đọc ngắn quá sẽ nghe thành /ʊ/, khiến 'pool' (hồ bơi) bị nhầm thành 'pull' (kéo lại).",
  },
  "ʊ": {
    name: "/ʊ/ (u ngắn)",
    mouthAnchor: "Môi chỉ hơi tròn nhẹ và thả lỏng, không chu mỏ, giật nhẹ bụng đọc ngắn dứt khoát.",
    phonicsRule: "Thường gặp ở 'oo' trước chữ 'k' (book, look) hoặc các từ quen thuộc: foot, good, put, push, pull.",
    pitfall: "Tránh chu môi kéo dài; hãy để cơ môi thật mềm và ngắt âm dứt khoát.",
  },
  "ʌ": {
    name: "/ʌ/ (á/ớ)",
    mouthAnchor: "Mở miệng tự nhiên, thả lỏng toàn bộ lưỡi, phát âm dứt khoát giống chữ 'ớ' hoặc 'á' dứt khoát.",
    phonicsRule: "Thường gặp ở chữ 'u' (cup, bus, sun, cut, run, mug) hoặc 'o' (love, son, come, done, money).",
    pitfall: "Đừng đọc thành 'u' theo chữ cái (bus đọc là 'bớt/bắt', tuyệt đối không đọc là 'bút').",
  },
  "ɑː": {
    name: "/ɑː/ (a dài)",
    mouthAnchor: "Hạ quai hàm sâu, mở rộng vòm họng như đang khám họng bảo 'Aaa', giữ âm ngân dài và trầm.",
    phonicsRule: "Thường gặp ở chữ 'ar' (car, star, heart, park, arm) hoặc 'a' (father).",
    pitfall: "Âm 'a' này rất sâu trong họng, miệng mở to hơn nhiều so với âm 'a' tiếng Việt.",
  },
  "ɔː": {
    name: "/ɔː/ (o dài)",
    mouthAnchor: "Môi chu tròn căng, lưỡi thụt về sau, phát âm âm 'o' sâu trong họng và ngân dài.",
    phonicsRule: "Thường gặp ở 'or' (door, sport, short), 'aw' (saw, law), 'al' (ball, call, walk).",
    pitfall: "Kéo dài âm và làm tròn môi để tạo độ sâu chuẩn tiếng Anh bản xứ.",
  },
  "ɒ": {
    name: "/ɒ/ (o ngắn)",
    mouthAnchor: "Mở miệng hơi tròn, hạ cằm, đọc âm 'o' ngắn và dứt khoát.",
    phonicsRule: "Chữ 'o' đứng giữa 2 phụ âm (hot, stop, not, dog, box, top, drop).",
    pitfall: "Giọng Mỹ thường đọc âm này nghiêng về /ɑ/ mở họng (hot nghe trầm như 'hát').",
  },
  "ɜː": {
    name: "/ɜː/ (ơ cong lưỡi)",
    mouthAnchor: "Môi hơi mở, cong nhẹ đầu lưỡi về phía vòm họng trên, phát âm 'ơ' trầm ấm và kéo dài.",
    phonicsRule: "Thường gặp ở 'ir' (bird, girl, shirt), 'ur' (nurse, burn), 'er' (her, term, service).",
    pitfall: "Nhớ cong nhẹ đầu lưỡi để tạo độ 'r' trầm đặc trưng của tiếng Anh Mỹ.",
  },
  "ə": {
    name: "/ə/ (Schwa - ơ nhẹ)",
    mouthAnchor: "Thả lỏng hoàn toàn miệng và cơ mặt, phát âm 'ơ' cực nhẹ, ngắn và lướt qua nhanh.",
    phonicsRule: "Xuất hiện ở hầu hết các âm tiết KHÔNG mang trọng âm trong tiếng Anh (about, today, banana, teacher).",
    pitfall: "Người Việt hay đọc rõ mọi âm tiết. Với âm /ə/, hãy đọc thật lướt và nhẹ như gió thoảng.",
    memoryMnemonic: "Âm quan trọng nhất để nói tự nhiên: không nhấn thì đọc /ə/.",
  },

  // --- Phụ âm quan trọng hay sai ---
  "ʃ": {
    name: "/ʃ/ (s nặng - xì gió tròn môi)",
    mouthAnchor: "Chu môi tròn ra trước như đang xi tè em bé hoặc bảo 'Suỵt', đẩy luồng hơi mạnh qua kẽ răng.",
    phonicsRule: "Chữ cái 'sh' (ship, shop, fish, wash) hoặc đuôi '-tion' / '-sion' (action, mission).",
    pitfall: "Đừng đọc như 's' nhẹ tiếng Việt; bắt buộc phải chu tròn môi và đẩy luồng hơi xì mạnh!",
    memoryMnemonic: "Chu mỏ ra trước như bảo 'Suỵt' = /ʃ/.",
  },
  "s": {
    name: "/s/ (s nhẹ - xì sắc)",
    mouthAnchor: "Cười nhẹ, hai hàm răng khép hờ, thổi luồng hơi xì sắc như tiếng rắn 'sss'. Dây thanh KHÔNG rung.",
    phonicsRule: "Chữ 's' (see, sit, bus), hoặc chữ 'c' đứng trước e, i, y (city, face, rice, dance, pencil).",
    pitfall: "Người Việt rất hay nuốt mất âm /s/ ở cuối từ (bus, nice, miss). Hãy nhớ luôn xì gió ở đuôi!",
  },
  "z": {
    name: "/z/ (z rung)",
    mouthAnchor: "Khẩu hình răng giống hệt /s/, nhưng làm rung mạnh dây thanh quản ở cổ họng như tiếng ong kêu 'zzz'.",
    phonicsRule: "Chữ 'z' (zoo, buzz, prize) hoặc đuôi '-s' sau các âm rung (eyes, dogs, loves, plays, beds).",
    pitfall: "Người Việt hay biến mọi âm /z/ ở đuôi từ thành /s/. Đặt tay lên cổ họng: phải thấy rung rõ rệt!",
  },
  "tʃ": {
    name: "/tʃ/ (ch bật hơi)",
    mouthAnchor: "Chu môi giống /ʃ/, nhưng khép răng chặn luồng hơi lại rồi bật mạnh ra: 'ch-ch'.",
    phonicsRule: "Thường gặp ở chữ 'ch' (chair, rich, cheap, check) hoặc 'tch' (catch, watch, match).",
    pitfall: "Khác 'ch' tiếng Việt (chợ, cho) rất nhẹ; /tʃ/ tiếng Anh phải nén hơi và bật dứt khoát.",
  },
  "dʒ": {
    name: "/dʒ/ (gi/d rung mạnh)",
    mouthAnchor: "Khẩu hình giống /tʃ/, nhưng khi bật âm phải làm rung mạnh dây thanh quản ở cổ họng.",
    phonicsRule: "Chữ 'j' (job, joy, jump) hoặc 'g' đứng trước e, i (general, page, giant) hoặc 'dge' (bridge, judge).",
    pitfall: "Đừng đọc thành 'd' tiếng Việt ('dóp'); phải chu môi nén hơi và rung cổ họng mạnh mẽ.",
  },
  "θ": {
    name: "/θ/ (th không rung)",
    mouthAnchor: "Đặt đầu lưỡi kẹp nhẹ giữa hai hàm răng, thổi luồng hơi nhẹ qua kẽ răng. Cổ họng KHÔNG rung.",
    phonicsRule: "Viết là 'th' trong think, three, tooth, bath, breath, month, mouth.",
    pitfall: "Cấm đọc thành 'th' tiếng Việt (thanh) hay 't' (tanh). Bắt buộc phải thè đầu lưỡi ra giữa 2 răng!",
    memoryMnemonic: "Cắn nhẹ đầu lưỡi xì hơi = /θ/.",
  },
  "ð": {
    name: "/ð/ (th rung)",
    mouthAnchor: "Cắn nhẹ đầu lưỡi giống /θ/, nhưng phát âm làm rung mạnh dây thanh quản ở cổ họng.",
    phonicsRule: "Viết là 'th' trong this, that, they, there, mother, father, breathe, with.",
    pitfall: "Đừng đọc thành 'đ' (đít, đát) hay 'd' (dít, dát). Lưỡi phải kẹp giữa 2 răng và rung cổ họng!",
    memoryMnemonic: "Cắn nhẹ đầu lưỡi + rung cổ = /ð/.",
  },
  "f": {
    name: "/f/ (ph xì gió)",
    mouthAnchor: "Răng cửa trên cắn nhẹ lên môi dưới, đẩy luồng hơi xì ra ngoài.",
    phonicsRule: "Chữ 'f' (food, fine) hoặc 'ph' (phone, photo) hoặc 'gh' (laugh, rough).",
    pitfall: "Ở cuối từ như 'safe', 'life', nhớ giữ răng cắn nhẹ môi để phát ra tiếng gió.",
  },
  "v": {
    name: "/v/ (v rung)",
    mouthAnchor: "Răng cửa trên cắn nhẹ lên môi dưới giống /f/, nhưng làm rung mạnh dây thanh quản.",
    phonicsRule: "Chữ 'v' trong voice, very, have, live, leave, move.",
    pitfall: "Ở cuối từ như 'leave', 'live', nhớ rung nhẹ môi và dây thanh, đừng nuốt mất âm.",
  },
  "t": {
    name: "/t/ (t bật hơi)",
    mouthAnchor: "Đầu lưỡi chạm mạnh vào phần nướu sau răng cửa trên, chặn hơi rồi bật dứt khoát ra.",
    phonicsRule: "Chữ 't' (top, time, hit, cat) hoặc đuôi '-ed' sau phụ âm vô thanh (looked, stopped).",
    pitfall: "Ở cuối từ ('cat', 'bite'), bắt buộc phải chạm lưỡi chặn hơi để người nghe không nhầm với 'can', 'buy'.",
  },
  "d": {
    name: "/d/ (d bật rung)",
    mouthAnchor: "Vị trí lưỡi giống /t/, nhưng bật âm có độ rung trong cổ họng.",
    phonicsRule: "Chữ 'd' (day, red, bed, code) hoặc đuôi '-ed' sau nguyên âm và âm rung (played, lived).",
    pitfall: "Giữ âm cuối /d/ giúp phân biệt 'code' (mã) với 'coat' (áo khoác), 'ride' với 'right'.",
  },
  "k": {
    name: "/k/ (k khạc hơi)",
    mouthAnchor: "Phần sau của lưỡi nâng lên chạm vòm họng mềm, chặn hơi rồi bật 'khạc' dứt khoát.",
    phonicsRule: "Chữ 'k' (key, bike), 'c' (cat, cool), hoặc 'ck' (back, check, pick).",
    pitfall: "Âm cuối /k/ rất quan trọng: 'bike' có /k/ mới khác 'buy', 'work' mới khác 'war'.",
  },
  "p": {
    name: "/p/ (p mím môi bật hơi)",
    mouthAnchor: "Mím chặt hai môi lại chặn luồng khí trong miệng, rồi bật bung ra không rung cổ.",
    phonicsRule: "Chữ 'p' trong pen, pig, ship, cap, cup, stop.",
    pitfall: "Ở cuối từ như 'ship', 'cap', mím môi lại để người nghe biết từ đã kết thúc trọn vẹn.",
  },
};

/**
 * Detect sound symbol from IPA string (e.g. "/ʃɪp/" -> primary vowel or distinct consonant)
 */
export function extractKeySound(ipa: string): string | null {
  const clean = ipa.replace(/[/ˈˌ.]/g, "");
  // Check multi-character sounds first
  const order = [
    "tʃ", "dʒ", "iː", "uː", "ɑː", "ɔː", "ɜː", "aɪ", "eɪ", "ɔɪ", "aʊ", "oʊ", "əʊ", "ɪə", "eə", "ʊə",
    "ʃ", "ʒ", "θ", "ð", "ɪ", "e", "æ", "ʌ", "ʊ", "ɒ", "ə", "s", "z", "f", "v", "t", "d", "k", "p",
  ];
  for (const sym of order) {
    if (clean.includes(sym)) return sym;
  }
  return null;
}

/**
 * Return a comprehensive pedagogical teacher guide for a given word and sound.
 */
export function getTeacherGuide(
  word: string,
  ipa: string,
  contextSound?: string,
  pair?: ConfusablePhonemePair
): TeacherGuide | null {
  // If a confusable pair is provided, tailor the tip specifically to which side of the pair this word belongs to
  if (pair) {
    const isA = pair.defaultPairs.some((p) => p.wordA.toLowerCase() === word.toLowerCase()) || ipa.includes(pair.symA);
    const isB = pair.defaultPairs.some((p) => p.wordB.toLowerCase() === word.toLowerCase()) || ipa.includes(pair.symB);
    const sym = isA ? pair.symA : isB ? pair.symB : undefined;
    const generalSpec = sym ? SOUND_GUIDES[sym] : undefined;

    return {
      soundTitle: isA ? pair.nameA : isB ? pair.nameB : `Cặp ${pair.title}`,
      mouthAnchor: isA ? pair.mouthTipA : isB ? pair.mouthTipB : pair.differenceTip,
      phonicsRule: generalSpec?.phonicsRule,
      pitfall: pair.vietnamesePitfall,
      memoryMnemonic: pair.differenceTip,
    };
  }

  // Determine the target sound to explain
  const cleanContext = contextSound ? contextSound.replace(/[/ː]/g, (m) => (m === "ː" ? "ː" : "")).trim() : "";
  let target = cleanContext;

  if (!target || !SOUND_GUIDES[target]) {
    // Try to find matching guide from word IPA
    const detected = extractKeySound(ipa);
    if (detected && SOUND_GUIDES[detected]) {
      target = detected;
    }
  }

  const guide = SOUND_GUIDES[target];
  if (!guide) return null;

  return {
    soundTitle: guide.name,
    mouthAnchor: guide.mouthAnchor,
    phonicsRule: guide.phonicsRule,
    pitfall: guide.pitfall,
    memoryMnemonic: guide.memoryMnemonic,
  };
}

export interface WordCollocation {
  phrase: string;
  translation: string;
}

const COMMON_COLLOCATIONS: Record<string, WordCollocation> = {
  ship: { phrase: "a big ship", translation: "một con tàu lớn" },
  sheep: { phrase: "white sheep", translation: "những con cừu trắng" },
  seat: { phrase: "take a seat", translation: "mời bạn ngồi" },
  sit: { phrase: "sit down", translation: "ngồi xuống đây" },
  leave: { phrase: "time to leave", translation: "đến lúc rời đi" },
  live: { phrase: "live here", translation: "sinh sống ở đây" },
  beat: { phrase: "drop the beat", translation: "bắt nhịp bài hát" },
  bit: { phrase: "a little bit", translation: "một chút xíu" },
  feet: { phrase: "on my feet", translation: "tự đứng trên chân mình" },
  fit: { phrase: "stay fit", translation: "giữ vóc dáng khỏe mạnh" },
  bed: { phrase: "go to bed", translation: "đi ngủ" },
  bad: { phrase: "not bad", translation: "không hề tệ" },
  men: { phrase: "young men", translation: "những chàng trai trẻ" },
  man: { phrase: "a good man", translation: "một người đàn ông tốt" },
  pen: { phrase: "blue pen", translation: "cây bút mực xanh" },
  pan: { phrase: "hot pan", translation: "chiếc chảo nóng" },
  send: { phrase: "send a message", translation: "gửi một tin nhắn" },
  sand: { phrase: "white sand", translation: "bãi cát trắng mịn" },
  head: { phrase: "turn your head", translation: "quay đầu lại" },
  had: { phrase: "I had time", translation: "tôi từng có thời gian" },
  pull: { phrase: "pull the door", translation: "kéo cánh cửa vào" },
  pool: { phrase: "swimming pool", translation: "hồ bơi xanh mát" },
  full: { phrase: "full of energy", translation: "tràn đầy năng lượng" },
  fool: { phrase: "don't be a fool", translation: "đừng ngốc nghếch thế" },
  look: { phrase: "look at this", translation: "hãy nhìn cái này" },
  luke: { phrase: "hello Luke", translation: "xin chào bạn Luke" },
  foot: { phrase: "on foot", translation: "đi bộ" },
  food: { phrase: "good food", translation: "món ăn thơm ngon" },
  bus: { phrase: "catch the bus", translation: "bắt chuyến xe buýt" },
  buzz: { phrase: "hear a buzz", translation: "nghe tiếng vo ve" },
  ice: { phrase: "ice water", translation: "ly nước đá lạnh" },
  eyes: { phrase: "open your eyes", translation: "mở to đôi mắt" },
  think: { phrase: "think about it", translation: "suy nghĩ về điều đó" },
  sink: { phrase: "kitchen sink", translation: "bồn rửa trong bếp" },
  three: { phrase: "three days", translation: "trong vòng ba ngày" },
  free: { phrase: "free time", translation: "thời gian rảnh rỗi" },
  day: { phrase: "have a nice day", translation: "chúc một ngày vui vẻ" },
  they: { phrase: "they are here", translation: "họ đang ở đây" },
  thin: { phrase: "thin paper", translation: "tờ giấy mỏng" },
  tin: { phrase: "tin can", translation: "chiếc hộp bằng thiếc" },
  tree: { phrase: "green tree", translation: "cái cây xanh tươi" },
  rice: { phrase: "eat rice", translation: "ăn cơm nóng" },
  rise: { phrase: "sun rise", translation: "mặt trời mọc lên" },
  price: { phrase: "good price", translation: "mức giá hợp lý" },
  prize: { phrase: "win a prize", translation: "giành được giải thưởng" },
  peace: { phrase: "peace of mind", translation: "bình yên trong tâm hồn" },
  piece: { phrase: "a piece of cake", translation: "dễ như ăn bánh" },
  heat: { phrase: "summer heat", translation: "cái nóng mùa hè" },
  hit: { phrase: "hit the target", translation: "bắn trúng mục tiêu" },
  cheap: { phrase: "very cheap", translation: "giá rất rẻ" },
  chip: { phrase: "computer chip", translation: "vi mạch máy tính" },
  sleep: { phrase: "sleep well", translation: "chúc ngủ ngon" },
  slip: { phrase: "watch your slip", translation: "coi chừng trượt chân" },
  reach: { phrase: "reach the goal", translation: "chạm tới mục tiêu" },
  rich: { phrase: "rich person", translation: "người giàu có" },
};

/**
 * Return a natural mini-phrase / collocation for practicing a word in real context,
 * avoiding the awkward feeling of pronouncing an isolated word.
 */
export function getWordCollocation(word: string, meaning?: string): WordCollocation {
  const key = word.trim().toLowerCase();
  if (COMMON_COLLOCATIONS[key]) {
    return COMMON_COLLOCATIONS[key];
  }
  if (meaning) {
    return {
      phrase: `use '${word}'`,
      translation: `dùng từ mang nghĩa: ${meaning}`,
    };
  }
  return {
    phrase: `say '${word}'`,
    translation: `nói từ "${word}" tự nhiên`,
  };
}

