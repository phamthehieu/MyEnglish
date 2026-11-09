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
  // /iː/ vs /ɪ/
  see: { phrase: "Let's see the results.", translation: "Hãy xem kết quả nhé." },
  tea: { phrase: "Would you like some tea?", translation: "Bạn uống chút trà nhé?" },
  key: { phrase: "This is the key point.", translation: "Đây là điểm mấu chốt." },
  eat: { phrase: "Let's eat lunch together.", translation: "Cùng ăn trưa nhé." },
  week: { phrase: "See you next week.", translation: "Hẹn gặp bạn tuần sau." },
  green: { phrase: "Wait for the green light.", translation: "Đợi đèn xanh nhé." },
  ship: { phrase: "We will ship it today.", translation: "Chúng tôi sẽ gửi hàng hôm nay." },
  sheep: { phrase: "Count the white sheep.", translation: "Đếm những chú cừu trắng." },
  seat: { phrase: "Please take a seat.", translation: "Mời bạn ngồi." },
  sit: { phrase: "Please sit down here.", translation: "Mời ngồi xuống đây." },
  leave: { phrase: "It's time to leave now.", translation: "Đã đến lúc phải đi rồi." },
  live: { phrase: "Where do you live?", translation: "Bạn sống ở đâu?" },
  beat: { phrase: "Nothing can beat this.", translation: "Không gì vượt qua được cái này." },
  bit: { phrase: "Wait a little bit.", translation: "Đợi một chút xíu nhé." },
  feet: { phrase: "Stand on your feet.", translation: "Đứng vững trên đôi chân." },
  fit: { phrase: "It fits the schedule.", translation: "Nó khớp với lịch trình." },
  big: { phrase: "That is a big deal.", translation: "Đó là một việc quan trọng." },
  fish: { phrase: "Fresh fish for dinner.", translation: "Cá tươi cho bữa tối." },
  give: { phrase: "Give me five minutes.", translation: "Cho tôi năm phút nhé." },
  win: { phrase: "We can win this project.", translation: "Chúng ta có thể thắng dự án này." },
  six: { phrase: "Meet me at six o'clock.", translation: "Gặp tôi lúc sáu giờ nhé." },
  hill: { phrase: "Walk up the hill.", translation: "Đi bộ lên đồi." },
  heel: { phrase: "High heel shoes.", translation: "Giày cao gót." },
  chip: { phrase: "A fast computer chip.", translation: "Một con chip máy tính nhanh." },
  cheap: { phrase: "It is very cheap.", translation: "Giá cái này rất rẻ." },
  feel: { phrase: "How do you feel today?", translation: "Hôm nay bạn cảm thấy thế nào?" },
  fill: { phrase: "Please fill out this form.", translation: "Vui lòng điền vào biểu mẫu này." },
  least: { phrase: "At least ten minutes.", translation: "Ít nhất là mười phút." },
  list: { phrase: "Check the task list.", translation: "Kiểm tra danh sách công việc." },
  team: { phrase: "Welcome to our team!", translation: "Chào mừng đến với nhóm chúng tôi!" },
  feature: { phrase: "Test the new feature.", translation: "Kiểm thử tính năng mới." },
  build: { phrase: "Run the latest build.", translation: "Chạy bản dựng mới nhất." },

  // /ʊ/ vs /uː/
  book: { phrase: "Read a good book.", translation: "Đọc một cuốn sách hay." },
  good: { phrase: "That sounds really good.", translation: "Nghe rất ổn đấy." },
  put: { phrase: "Put it on the table.", translation: "Đặt nó lên bàn nhé." },
  look: { phrase: "Take a look at this.", translation: "Hãy nhìn vào cái này xem." },
  foot: { phrase: "Go there on foot.", translation: "Đi bộ đến đó." },
  woman: { phrase: "A smart business woman.", translation: "Một nữ doanh nhân sắc sảo." },
  pull: { phrase: "Pull the latest code.", translation: "Kéo bản code mới nhất về." },
  pool: { phrase: "Swim in the pool.", translation: "Bơi trong hồ." },
  full: { phrase: "My schedule is full.", translation: "Lịch của tôi kín hết rồi." },
  fool: { phrase: "Don't be a fool.", translation: "Đừng ngốc nghếch thế." },
  luke: { phrase: "Ask Luke for help.", translation: "Nhờ Luke giúp đỡ nhé." },
  food: { phrase: "Order some local food.", translation: "Gọi vài món ăn địa phương." },
  blue: { phrase: "Click the blue button.", translation: "Bấm vào nút màu xanh dương." },
  school: { phrase: "Pick up from school.", translation: "Đón về từ trường học." },
  true: { phrase: "That is totally true.", translation: "Điều đó hoàn toàn đúng." },
  moon: { phrase: "Look at the full moon.", translation: "Nhìn trăng rằm kìa." },
  group: { phrase: "Join our working group.", translation: "Tham gia nhóm làm việc của chúng tôi." },
  tool: { phrase: "A very useful tool.", translation: "Một công cụ rất hữu ích." },
  new: { phrase: "Create a new folder.", translation: "Tạo một thư mục mới." },
  push: { phrase: "Push the changes now.", translation: "Đẩy các thay đổi lên ngay." },
  cookie: { phrase: "Clear the browser cookie.", translation: "Xóa cookie trình duyệt." },

  // /e/ vs /æ/
  bed: { phrase: "Go to bed early.", translation: "Đi ngủ sớm nhé." },
  red: { phrase: "Fix the red error.", translation: "Sửa lỗi báo đỏ." },
  head: { phrase: "Head to the office.", translation: "Đi tới văn phòng." },
  many: { phrase: "How many files are there?", translation: "Có bao nhiêu tệp ở đó?" },
  friend: { phrase: "Talk to a close friend.", translation: "Trò chuyện với một người bạn thân." },
  said: { phrase: "What did she say? She said yes.", translation: "Cô ấy đã đồng ý." },
  bad: { phrase: "Not a bad idea.", translation: "Ý tưởng không tệ chút nào." },
  men: { phrase: "Two young men.", translation: "Hai chàng trai trẻ." },
  man: { phrase: "He is a kind man.", translation: "Anh ấy là người tử tế." },
  pen: { phrase: "Sign with a blue pen.", translation: "Ký bằng bút mực xanh." },
  pan: { phrase: "Heat up the pan.", translation: "Làm nóng chiếc chảo." },
  set: { phrase: "Set a clear goal.", translation: "Đặt mục tiêu rõ ràng." },
  sat: { phrase: "We sat in the meeting.", translation: "Chúng tôi đã ngồi trong cuộc họp." },
  cat: { phrase: "Feed the little cat.", translation: "Cho chú mèo nhỏ ăn." },
  hand: { phrase: "Give me a hand.", translation: "Giúp tôi một tay nhé." },
  apple: { phrase: "Eat a fresh apple.", translation: "Ăn một quả táo tươi." },
  black: { phrase: "A cup of black coffee.", translation: "Một tách cà phê đen." },
  happy: { phrase: "Happy to work with you.", translation: "Rất vui được làm việc cùng bạn." },
  send: { phrase: "Send me the report.", translation: "Gửi báo cáo cho tôi nhé." },
  sand: { phrase: "Walk on the warm sand.", translation: "Đi dạo trên cát ấm." },
  had: { phrase: "I had a busy day.", translation: "Tôi đã có một ngày bận rộn." },

  // /ə/, /ɜː/, /ɔː/, /ʌ/, /ɑː/, /ɒ/
  about: { phrase: "Tell me about the plan.", translation: "Kể cho tôi nghe về kế hoạch nhé." },
  teacher: { phrase: "Ask your English teacher.", translation: "Hỏi giáo viên tiếng Anh của bạn." },
  banana: { phrase: "Have a ripe banana.", translation: "Ăn một quả chuối chín." },
  today: { phrase: "Let's finish it today.", translation: "Hãy hoàn thành việc đó hôm nay." },
  family: { phrase: "Spend time with family.", translation: "Dành thời gian cho gia đình." },
  problem: { phrase: "No problem at all.", translation: "Không vấn đề gì cả." },
  bird: { phrase: "Early bird gets the worm.", translation: "Đi sớm đón đầu cơ hội." },
  word: { phrase: "Keep your word.", translation: "Hãy giữ lời hứa." },
  learn: { phrase: "Learn from mistakes.", translation: "Học hỏi từ những sai lầm." },
  turn: { phrase: "It is your turn now.", translation: "Bây giờ đến lượt bạn." },
  work: { phrase: "Start work at nine.", translation: "Bắt đầu làm việc lúc 9 giờ." },
  girl: { phrase: "A clever little girl.", translation: "Một cô bé thông minh." },
  walk: { phrase: "Let's go for a walk.", translation: "Cùng đi dạo một chút nhé." },
  board: { phrase: "Write it on the board.", translation: "Viết nó lên bảng." },
  more: { phrase: "We need more details.", translation: "Chúng ta cần thêm chi tiết." },
  four: { phrase: "Wait until four o'clock.", translation: "Đợi đến bốn giờ nhé." },
  call: { phrase: "Give me a quick call.", translation: "Gọi nhanh cho tôi nhé." },
  small: { phrase: "Fix a small issue.", translation: "Sửa một lỗi nhỏ." },
  water: { phrase: "Drink a glass of water.", translation: "Uống một ly nước." },
  thought: { phrase: "I thought about your idea.", translation: "Tôi đã suy nghĩ về ý kiến của bạn." },
  cup: { phrase: "Have a cup of coffee.", translation: "Uống một tách cà phê nhé." },
  bus: { phrase: "Take the morning bus.", translation: "Bắt chuyến xe buýt buổi sáng." },
  love: { phrase: "I love this design.", translation: "Tôi rất thích thiết kế này." },
  come: { phrase: "Come to my desk.", translation: "Qua bàn làm việc của tôi nhé." },
  sun: { phrase: "Enjoy the morning sun.", translation: "Tận hưởng nắng sớm." },
  money: { phrase: "Save time and money.", translation: "Tiết kiệm thời gian và tiền bạc." },
  cut: { phrase: "Cut the extra cost.", translation: "Cắt giảm chi phí phát sinh." },
  cap: { phrase: "Put on a cap.", translation: "Đội mũ lưỡi trai vào." },
  luck: { phrase: "Wish you good luck!", translation: "Chúc bạn nhiều may mắn!" },
  lack: { phrase: "Lack of information.", translation: "Thiếu thông tin." },
  car: { phrase: "Park the car outside.", translation: "Đỗ xe ở bên ngoài." },
  father: { phrase: "Talk to my father.", translation: "Nói chuyện với bố tôi." },
  start: { phrase: "Let's start the meeting.", translation: "Hãy bắt đầu cuộc họp." },
  park: { phrase: "Walk in the green park.", translation: "Đi dạo trong công viên." },
  large: { phrase: "A large data file.", translation: "Một tệp dữ liệu lớn." },
  heart: { phrase: "Thank you from my heart.", translation: "Cảm ơn bạn từ tận đáy lòng." },
  hot: { phrase: "The coffee is still hot.", translation: "Cà phê vẫn còn nóng." },
  dog: { phrase: "Walk the dog every day.", translation: "Dắt chó đi dạo mỗi ngày." },
  stop: { phrase: "Stop the server now.", translation: "Dừng máy chủ lại ngay." },
  box: { phrase: "Check the inbox folder.", translation: "Kiểm tra hộp thư đến." },
  job: { phrase: "You did a great job!", translation: "Bạn đã làm rất tốt!" },
  want: { phrase: "What do you want to do?", translation: "Bạn muốn làm gì?" },

  // Diphthongs
  near: { phrase: "The office is near here.", translation: "Văn phòng ở gần đây." },
  here: { phrase: "Click right here.", translation: "Bấm ngay tại đây." },
  beer: { phrase: "Grab a cold beer.", translation: "Uống một cốc bia lạnh." },
  idea: { phrase: "That's a great idea!", translation: "Đó là một ý kiến tuyệt vời!" },
  clear: { phrase: "Everything is clear now.", translation: "Mọi thứ giờ đã rõ ràng." },
  year: { phrase: "Plan for next year.", translation: "Lập kế hoạch cho năm tới." },
  day: { phrase: "Have a productive day!", translation: "Chúc một ngày làm việc hiệu quả!" },
  name: { phrase: "Type your full name.", translation: "Gõ họ tên đầy đủ của bạn." },
  make: { phrase: "Let's make a decision.", translation: "Hãy đưa ra quyết định." },
  rain: { phrase: "Heavy rain outside.", translation: "Bên ngoài trời mưa to." },
  say: { phrase: "What did you say?", translation: "Bạn vừa nói gì thế?" },
  great: { phrase: "Have a great weekend!", translation: "Chúc cuối tuần vui vẻ!" },
  late: { phrase: "Sorry I am a bit late.", translation: "Xin lỗi tôi đến hơi muộn một chút." },
  let: { phrase: "Let me check it for you.", translation: "Để tôi kiểm tra giúp bạn." },
  wait: { phrase: "Please wait a moment.", translation: "Vui lòng đợi một lát." },
  tour: { phrase: "Take a quick office tour.", translation: "Đi tham quan nhanh văn phòng." },
  sure: { phrase: "Are you sure about that?", translation: "Bạn có chắc về điều đó không?" },
  boy: { phrase: "A smart young boy.", translation: "Một cậu bé thông minh." },
  coin: { phrase: "Flip a coin.", translation: "Tung đồng xu." },
  voice: { phrase: "Speak in a clear voice.", translation: "Nói bằng giọng rõ ràng." },
  enjoy: { phrase: "Enjoy your vacation!", translation: "Chúc bạn tận hưởng kỳ nghỉ!" },
  oil: { phrase: "Check the engine oil.", translation: "Kiểm tra dầu máy." },
  go: { phrase: "Let's go to lunch.", translation: "Cùng đi ăn trưa nào." },
  home: { phrase: "Work from home today.", translation: "Hôm nay làm việc tại nhà." },
  phone: { phrase: "Answer the phone call.", translation: "Nghe cuộc gọi điện thoại." },
  road: { phrase: "On the road to success.", translation: "Trên con đường dẫn tới thành công." },
  know: { phrase: "Let me know soon.", translation: "Báo cho tôi biết sớm nhé." },
  open: { phrase: "Open the main file.", translation: "Mở tệp chính ra." },
  note: { phrase: "Take a quick note.", translation: "Ghi chú nhanh lại." },
  air: { phrase: "Get some fresh air.", translation: "Hít thở chút không khí trong lành." },
  hair: { phrase: "Comb your hair.", translation: "Chải tóc gọn gàng." },
  care: { phrase: "Take care of yourself.", translation: "Hãy giữ gìn sức khỏe nhé." },
  there: { phrase: "Put the file right there.", translation: "Đặt tệp ngay ở đó." },
  share: { phrase: "Let me share my screen.", translation: "Để tôi chia sẻ màn hình." },
  chair: { phrase: "Pull up a chair.", translation: "Kéo ghế lại ngồi nhé." },
  my: { phrase: "This is my first draft.", translation: "Đây là bản nháp đầu tiên của tôi." },
  time: { phrase: "We are right on time.", translation: "Chúng ta đến đúng giờ." },
  like: { phrase: "I really like this approach.", translation: "Tôi rất thích cách tiếp cận này." },
  night: { phrase: "See you tomorrow night.", translation: "Hẹn gặp bạn tối mai." },
  five: { phrase: "Take a five-minute break.", translation: "Nghỉ giải lao năm phút nhé." },
  price: { phrase: "Check the final price.", translation: "Kiểm tra mức giá cuối cùng." },
  now: { phrase: "Let's do it right now.", translation: "Hãy làm ngay bây giờ." },
  house: { phrase: "Welcome to my house.", translation: "Chào mừng đến nhà tôi." },
  out: { phrase: "Check it out now.", translation: "Kiểm tra thử ngay nhé." },
  down: { phrase: "Write it down here.", translation: "Ghi nó xuống đây." },
  mouth: { phrase: "Open your mouth wide.", translation: "Mở rộng miệng khi phát âm." },

  // Consonants & workplace vocabulary
  paper: { phrase: "Print it on paper.", translation: "In nó ra giấy." },
  help: { phrase: "Thanks for your help.", translation: "Cảm ơn sự giúp đỡ của bạn." },
  baby: { phrase: "Take care of the baby.", translation: "Chăm sóc em bé." },
  table: { phrase: "Update the data table.", translation: "Cập nhật bảng dữ liệu." },
  number: { phrase: "Call this phone number.", translation: "Gọi số điện thoại này." },
  ten: { phrase: "Wait for ten seconds.", translation: "Đợi trong mười giây." },
  city: { phrase: "Live in a big city.", translation: "Sống ở một thành phố lớn." },
  ready: { phrase: "Are you ready to start?", translation: "Bạn đã sẵn sàng bắt đầu chưa?" },
  window: { phrase: "Close the browser window.", translation: "Đóng cửa sổ trình duyệt." },
  church: { phrase: "Near the old church.", translation: "Ở gần nhà thờ cũ." },
  check: { phrase: "Let me check the code.", translation: "Để tôi kiểm tra mã nguồn." },
  match: { phrase: "The results match perfectly.", translation: "Kết quả khớp hoàn toàn." },
  cheese: { phrase: "Say cheese for the photo!", translation: "Cười tươi chụp ảnh nào!" },
  juice: { phrase: "Drink some orange juice.", translation: "Uống chút nước cam." },
  page: { phrase: "Refresh the web page.", translation: "Tải lại trang web." },
  change: { phrase: "Save your changes first.", translation: "Lưu các thay đổi của bạn trước." },
  bridge: { phrase: "Cross the river bridge.", translation: "Đi qua cây cầu." },
  desk: { phrase: "Leave it on my desk.", translation: "Để nó trên bàn làm việc của tôi." },
  class: { phrase: "Join the online class.", translation: "Tham gia lớp học trực tuyến." },
  bag: { phrase: "Put it in your bag.", translation: "Bỏ nó vào túi của bạn." },
  again: { phrase: "Let's try that again.", translation: "Hãy thử lại lần nữa nhé." },
  coffee: { phrase: "Grab a cup of coffee.", translation: "Uống một ly cà phê." },
  leaf: { phrase: "A green tea leaf.", translation: "Một chiếc lá trà xanh." },
  enough: { phrase: "We have enough time.", translation: "Chúng ta có đủ thời gian." },
  very: { phrase: "Thank you very much.", translation: "Cảm ơn bạn rất nhiều." },
  move: { phrase: "Let's move to the next step.", translation: "Hãy chuyển sang bước tiếp theo." },
  seven: { phrase: "Start at seven o'clock.", translation: "Bắt đầu lúc bảy giờ." },
  think: { phrase: "I think this plan works.", translation: "Tôi nghĩ kế hoạch này ổn." },
  sink: { phrase: "Put dishes in the sink.", translation: "Để bát đĩa vào bồn rửa." },
  three: { phrase: "Give me three minutes.", translation: "Cho tôi ba phút nhé." },
  free: { phrase: "Are you free this afternoon?", translation: "Chiều nay bạn có rảnh không?" },
  thank: { phrase: "Thank you for your time.", translation: "Cảm ơn bạn đã dành thời gian." },
  thanks: { phrase: "Thanks for letting me know.", translation: "Cảm ơn vì đã báo cho tôi." },
  birthday: { phrase: "Happy birthday to you!", translation: "Chúc mừng sinh nhật bạn!" },
  this: { phrase: "Let's review this file.", translation: "Hãy xem lại tệp này." },
  that: { phrase: "That makes sense.", translation: "Điều đó hợp lý đấy." },
  the: { phrase: "Open the project folder.", translation: "Mở thư mục dự án." },
  mother: { phrase: "Call my mother tonight.", translation: "Tối nay gọi cho mẹ tôi." },
  brother: { phrase: "My younger brother.", translation: "Em trai của tôi." },
  weather: { phrase: "Nice weather today!", translation: "Thời tiết hôm nay đẹp quá!" },
  they: { phrase: "They agreed with us.", translation: "Họ đã đồng ý với chúng ta." },
  then: { phrase: "Test it, then deploy.", translation: "Kiểm thử trước, sau đó triển khai." },
  mouse: { phrase: "Click with the mouse.", translation: "Bấm bằng chuột máy tính." },
  zoo: { phrase: "Visit the city zoo.", translation: "Thăm sở thú thành phố." },
  zero: { phrase: "Start from zero.", translation: "Bắt đầu từ con số không." },
  easy: { phrase: "It is easy to use.", translation: "Cái này rất dễ sử dụng." },
  rise: { phrase: "Sales will rise soon.", translation: "Doanh số sẽ sớm tăng lên." },
  rice: { phrase: "Have some warm rice.", translation: "Ăn chút cơm nóng." },
  music: { phrase: "Listen to soft music.", translation: "Nghe nhạc nhẹ." },
  size: { phrase: "Check the file size.", translation: "Kiểm tra kích thước tệp." },
  she: { phrase: "She leads the project.", translation: "Cô ấy dẫn dắt dự án này." },
  shop: { phrase: "Buy it at the coffee shop.", translation: "Mua ở quán cà phê." },
  wash: { phrase: "Wash your hands first.", translation: "Rửa tay trước nhé." },
  nation: { phrase: "Across the whole nation.", translation: "Trên khắp cả nước." },
  vision: { phrase: "A clear product vision.", translation: "Tầm nhìn sản phẩm rõ ràng." },
  measure: { phrase: "Measure the performance.", translation: "Đo lường hiệu năng." },
  usually: { phrase: "I usually start at eight.", translation: "Tôi thường bắt đầu lúc 8 giờ." },
  pleasure: { phrase: "It is my pleasure.", translation: "Đó là niềm vinh hạnh của tôi." },
  hat: { phrase: "Wear a warm hat.", translation: "Đội một chiếc mũ ấm." },
  who: { phrase: "Who is in charge here?", translation: "Ai phụ trách việc này?" },
  behind: { phrase: "We are behind schedule.", translation: "Chúng ta đang chậm tiến độ." },
  hello: { phrase: "Say hello to the team.", translation: "Gửi lời chào tới cả nhóm." },
  summer: { phrase: "Plan for the summer trip.", translation: "Lên kế hoạch chuyến đi mùa hè." },
  funny: { phrase: "That was a funny story.", translation: "Đó là một câu chuyện vui." },
  nine: { phrase: "Our meeting starts at nine.", translation: "Cuộc họp bắt đầu lúc 9 giờ." },
  sing: { phrase: "Sing a favorite song.", translation: "Hát một bài yêu thích." },
  long: { phrase: "It takes a long time.", translation: "Việc này tốn khá nhiều thời gian." },
  morning: { phrase: "Good morning, everyone!", translation: "Chào buổi sáng mọi người!" },
  thing: { phrase: "One more important thing.", translation: "Một điều quan trọng nữa." },
  yellow: { phrase: "Highlight in yellow.", translation: "Tô sáng bằng màu vàng." },
  right: { phrase: "You are totally right.", translation: "Bạn nói hoàn toàn đúng." },
  run: { phrase: "Run the test suite now.", translation: "Chạy bộ kiểm thử ngay." },
  orange: { phrase: "Fresh orange juice.", translation: "Nước cam ép tươi." },
  library: { phrase: "Install the new library.", translation: "Cài đặt thư viện mới." },
  we: { phrase: "We can solve this together.", translation: "Chúng ta có thể cùng giải quyết." },
  one: { phrase: "Let's pick one option.", translation: "Hãy chọn một phương án." },
  question: { phrase: "Can I ask a question?", translation: "Tôi hỏi một câu được không?" },
  yes: { phrase: "Yes, I totally agree.", translation: "Vâng, tôi hoàn toàn đồng ý." },
  you: { phrase: "Nice to meet you!", translation: "Rất vui được gặp bạn!" },
  young: { phrase: "A young and talented team.", translation: "Một tập thể trẻ và tài năng." },
  use: { phrase: "How do we use this tool?", translation: "Chúng ta dùng công cụ này thế nào?" },
  fix: { phrase: "I need to fix this bug.", translation: "Tôi cần sửa lỗi này." },
  test: { phrase: "Did you run the test?", translation: "Bạn đã chạy bài kiểm thử chưa?" },
  code: { phrase: "Review the source code.", translation: "Xem lại mã nguồn." },
  app: { phrase: "Open the mobile app.", translation: "Mở ứng dụng di động." },
  type: { phrase: "Check the data type.", translation: "Kiểm tra kiểu dữ liệu." },
  bike: { phrase: "Ride a bike to work.", translation: "Đạp xe đi làm." },
  buy: { phrase: "Buy a new laptop.", translation: "Mua một chiếc laptop mới." },
  need: { phrase: "We need more time.", translation: "Chúng ta cần thêm thời gian." },
  knee: { phrase: "Bend your knee slightly.", translation: "Hơi khuỵu đầu gối xuống." },
  coat: { phrase: "Put on a warm coat.", translation: "Mặc áo khoác ấm vào." },
  ride: { phrase: "Enjoy the smooth ride.", translation: "Tận hưởng chuyến đi êm ái." },
  ice: { phrase: "A glass of ice water.", translation: "Một ly nước đá lạnh." },
  eyes: { phrase: "Rest your eyes a bit.", translation: "Cho mắt nghỉ ngơi một chút." },
  thin: { phrase: "A thin layer of ice.", translation: "Một lớp băng mỏng." },
  tin: { phrase: "Open the tin can.", translation: "Mở chiếc hộp thiếc." },
  tree: { phrase: "Check the folder tree.", translation: "Kiểm tra cây thư mục." },
  prize: { phrase: "Win the first prize.", translation: "Giành giải nhất." },
  peace: { phrase: "Enjoy some peace of mind.", translation: "Tận hưởng sự an tâm." },
  piece: { phrase: "It's a piece of cake.", translation: "Dễ như ăn bánh." },
  heat: { phrase: "Turn on the heat.", translation: "Bật máy sưởi lên." },
  hit: { phrase: "Hit the send button.", translation: "Bấm nút gửi." },
  sleep: { phrase: "Get enough sleep tonight.", translation: "Tối nay nhớ ngủ đủ giấc nhé." },
  slip: { phrase: "Don't let it slip away.", translation: "Đừng để tuột mất cơ hội." },
  reach: { phrase: "Reach our monthly goal.", translation: "Đạt mục tiêu tháng của chúng ta." },
  rich: { phrase: "Rich in useful features.", translation: "Giàu tính năng hữu ích." },
  cache: { phrase: "Clear the browser cache first.", translation: "Xóa bộ nhớ đệm trình duyệt trước." },
  queue: { phrase: "Your task is in the queue.", translation: "Tác vụ của bạn đang trong hàng đợi." },
  suite: { phrase: "Run the full test suite.", translation: "Chạy toàn bộ bộ kiểm thử." },
  schema: { phrase: "Update the database schema.", translation: "Cập nhật lược đồ cơ sở dữ liệu." },
  archive: { phrase: "Move old files to the archive.", translation: "Chuyển tệp cũ vào kho lưu trữ." },
  height: { phrase: "Adjust the image height.", translation: "Điều chỉnh chiều cao bức ảnh." },
  computer: { phrase: "Restart your computer.", translation: "Khởi động lại máy tính của bạn." },
  data: { phrase: "Back up the user data.", translation: "Sao lưu dữ liệu người dùng." },
  database: { phrase: "Connect to the database.", translation: "Kết nối vào cơ sở dữ liệu." },
  developer: { phrase: "Ask the lead developer.", translation: "Hỏi lập trình viên chính." },
  application: { phrase: "Deploy the web application.", translation: "Triển khai ứng dụng web." },
  information: { phrase: "Send me more information.", translation: "Gửi cho tôi thêm thông tin nhé." },
  release: { phrase: "Prepare for the next release.", translation: "Chuẩn bị cho bản phát hành tới." },
  report: { phrase: "Submit the weekly report.", translation: "Nộp báo cáo hàng tuần." },
  customer: { phrase: "Reply to the customer soon.", translation: "Phản hồi khách hàng sớm nhé." },
};

/**
 * Return a natural mini-phrase / collocation for practicing a word in real context,
 * avoiding the awkward feeling of pronouncing an isolated word.
 */
export function getWordCollocation(
  word: string,
  meaning?: string,
  customPhrase?: string,
  customPhraseVn?: string
): WordCollocation {
  if (customPhrase) {
    return {
      phrase: customPhrase,
      translation: customPhraseVn || meaning || "câu giao tiếp thực tế",
    };
  }
  const key = word.trim().toLowerCase();
  if (COMMON_COLLOCATIONS[key]) {
    return COMMON_COLLOCATIONS[key];
  }
  // If the item text is already a multi-word phrase or sentence, use it directly!
  if (key.includes(" ")) {
    return {
      phrase: word,
      translation: meaning || "cụm từ giao tiếp thực tế",
    };
  }
  if (meaning) {
    const cleanMeaning = meaning.split("—").pop()?.trim() || meaning;
    return {
      phrase: `Let's check the ${word}.`,
      translation: `Hãy kiểm tra (${cleanMeaning})`,
    };
  }
  return {
    phrase: `Can you say ${word}?`,
    translation: `Đặt "${word}" vào ngữ cảnh câu`,
  };
}

