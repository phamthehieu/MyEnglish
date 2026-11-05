import { getDatabase, insertCatalogWords } from "./db";
import { MASTERED_STABILITY_DAYS } from "./progress";
import { notifyWordsChanged } from "./reviewRecorder";
import {
  ensureCatalogSeeded,
  getCatalogEntries,
  rowsToEntries,
  type CatalogEntry,
  type CatalogRow,
  type StudyLevel,
} from "./vocabCatalog";
import { markCatalogWordsKnown, toCatalogWordInput } from "./vocabFeed";

export interface LevelFolderMeta {
  level: StudyLevel;
  title: string;
  subtitle: string;
  description: string;
  badgeText: string;
}

export const LEVEL_FOLDER_META: Record<StudyLevel, LevelFolderMeta> = {
  A1: {
    level: "A1",
    title: "Foundation A1 — Sơ cấp",
    subtitle: "Mới bắt đầu · Lấy gốc nền tảng",
    description:
      "Các bộ từ vựng cơ bản nhất cho người mới bắt đầu và người đi làm lấy lại gốc tiếng Anh: chào hỏi, gia đình, thời gian, màu sắc, ẩm thực và giao tiếp hằng ngày.",
    badgeText: "Sơ cấp A1",
  },
  A2: {
    level: "A2",
    title: "Elementary A2 — Cơ bản",
    subtitle: "Giao tiếp đời sống & Công sở cơ bản",
    description:
      "Mở rộng vốn từ thông dụng cho công việc và đời sống: email cơ bản, lịch họp, di chuyển, mua sắm, sức khỏe, cảm xúc và thiết bị công nghệ.",
    badgeText: "Cơ bản A2",
  },
  B1: {
    level: "B1",
    title: "Intermediate B1 — Trung cấp",
    subtitle: "Làm việc độc lập & Thảo luận",
    description:
      "Từ vựng phục vụ thuyết trình, thảo luận công việc, quản lý dự án, kinh doanh, công nghệ thông tin và diễn đạt quan điểm cá nhân rõ ràng.",
    badgeText: "Trung cấp B1",
  },
  B2: {
    level: "B2",
    title: "Upper B2 — Trung cao cấp",
    subtitle: "Chuyên sâu công việc & Học thuật",
    description:
      "Bộ từ vựng nâng cao giúp đọc hiểu tài liệu chuyên ngành, đàm phán, phân tích dữ liệu, lập luận sắc bén và giao tiếp chuyên nghiệp.",
    badgeText: "Khá giỏi B2",
  },
  C1: {
    level: "C1",
    title: "Advanced C1 — Thành thạo",
    subtitle: "Diễn đạt tự nhiên & Chuyên gia",
    description:
      "Từ vựng cấp độ thành thạo cho báo cáo chiến lược, học thuật chuyên sâu, văn phong trang trọng và diễn đạt tinh tế như người bản xứ.",
    badgeText: "Thành thạo C1",
  },
};

export interface VocabPack {
  id: string;
  /** 1-based pack number (01, 02, 03...) */
  index: number;
  level: StudyLevel;
  title: string;
  description: string;
  isThematic: boolean;
  total: number;
  met: number;
  remembered: number;
  known: number;
  wordIds: string[];
}

export type PackWordStatus = "unstudied" | "learning" | "remembered" | "known";

export interface PackWordItem {
  entry: CatalogEntry;
  status: PackWordStatus;
}

interface ThemeDef {
  title: string;
  summary: string;
  maxWords: number;
  match: (word: string, vn: string, pos: string, it: boolean) => boolean;
}

const hasAny = (text: string, keywords: readonly string[]): boolean => {
  for (const kw of keywords) {
    if (text.includes(kw)) return true;
  }
  return false;
};

const exactWord = (word: string, list: readonly string[]): boolean => list.includes(word);

const LEVEL_THEMES: Record<StudyLevel, ThemeDef[]> = {
  A1: [
    {
      title: "Chào hỏi & Giao tiếp",
      summary: "Chào hỏi, giới thiệu bản thân, đại từ và các từ giao tiếp lịch sự hằng ngày",
      maxWords: 45,
      match: (w, vn) =>
        exactWord(w, [
          "hello", "hi", "goodbye", "bye", "please", "thank", "thanks", "sorry", "excuse", "welcome",
          "yes", "no", "ok", "okay", "name", "meet", "speak", "talk", "say", "tell", "ask", "answer",
          "call", "email", "phone", "message", "letter", "language", "english", "word", "sentence",
          "question", "understand", "mean", "help", "friend", "people", "person", "mr", "mrs", "miss",
        ]) || hasAny(vn, ["xin chào", "tạm biệt", "cảm ơn", "xin lỗi", "giao tiếp", "trò chuyện", "hỏi", "trả lời"]),
    },
    {
      title: "Gia đình & Cơ thể người",
      summary: "Thành viên gia đình, mối quan hệ, bộ phận cơ thể và sức khỏe cơ bản",
      maxWords: 55,
      match: (w, vn) =>
        exactWord(w, [
          "family", "mother", "mom", "mum", "father", "dad", "parent", "child", "children", "son",
          "daughter", "brother", "sister", "husband", "wife", "baby", "man", "woman", "boy", "girl",
          "body", "head", "face", "eye", "ear", "nose", "mouth", "tooth", "hair", "hand", "arm",
          "leg", "foot", "heart", "back", "health", "healthy", "sick", "ill", "doctor", "hospital",
        ]) ||
        hasAny(vn, [
          "gia đình", "bố", "mẹ", "cha", "anh trai", "chị gái", "em trai", "em gái", "con trai", "con gái",
          "vợ", "chồng", "cơ thể", "đầu", "mắt", "mũi", "miệng", "tai", "tóc", "tay", "chân", "bác sĩ", "bệnh viện",
        ]),
    },
    {
      title: "Số đếm & Thời gian",
      summary: "Số đếm, ngày trong tuần, tháng, mùa, giờ giấc và lịch trình hằng ngày",
      maxWords: 65,
      match: (w, vn) =>
        exactWord(w, [
          "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
          "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
          "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred",
          "thousand", "million", "first", "second", "third", "number", "time", "hour", "minute",
          "second", "o'clock", "day", "today", "tomorrow", "yesterday", "week", "weekend", "month",
          "year", "morning", "afternoon", "evening", "night", "monday", "tuesday", "wednesday",
          "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may",
          "june", "july", "august", "september", "october", "november", "december", "spring", "summer",
          "autumn", "fall", "winter", "early", "late", "always", "usually", "often", "sometimes", "never",
        ]) || hasAny(vn, ["thời gian", "buổi sáng", "buổi chiều", "buổi tối", "hôm nay", "ngày mai", "hôm qua", "phút", "tuần", "tháng", "năm"]),
    },
    {
      title: "Màu sắc & Tính từ A1",
      summary: "Màu sắc, kích thước, hình dáng, cảm xúc và các tính từ mô tả thông dụng nhất",
      maxWords: 60,
      match: (w, vn, pos) =>
        exactWord(w, [
          "color", "colour", "red", "blue", "green", "yellow", "black", "white", "brown", "orange",
          "pink", "purple", "grey", "gray", "big", "large", "small", "little", "long", "short",
          "tall", "high", "low", "new", "old", "young", "good", "bad", "great", "nice", "fine",
          "happy", "sad", "angry", "tired", "hungry", "thirsty", "hot", "cold", "warm", "cool",
          "fast", "slow", "easy", "difficult", "hard", "right", "wrong", "true", "false", "same",
          "different", "important", "interesting", "boring", "beautiful", "pretty", "clean", "dirty",
        ]) || (pos.includes("adj") && hasAny(vn, ["màu", "đẹp", "xấu", "nhanh", "chậm", "dễ", "khó", "vui", "buồn", "mới", "cũ", "trẻ", "già", "nóng", "lạnh"])),
    },
    {
      title: "Đồ ăn & Ẩm thực",
      summary: "Thực phẩm, đồ uống, trái cây, bữa ăn, nhà hàng và nấu nướng",
      maxWords: 55,
      match: (w, vn) =>
        exactWord(w, [
          "food", "eat", "drink", "meal", "breakfast", "lunch", "dinner", "water", "milk", "tea",
          "coffee", "juice", "beer", "wine", "bread", "rice", "meat", "chicken", "fish", "egg",
          "cheese", "butter", "sugar", "salt", "soup", "salad", "sandwich", "cake", "chocolate",
          "ice", "cream", "fruit", "apple", "banana", "orange", "tomato", "potato", "vegetable",
          "restaurant", "cafe", "menu", "waiter", "cook", "kitchen", "cup", "glass", "plate", "bottle",
        ]) || hasAny(vn, ["thức ăn", "đồ ăn", "bữa sáng", "bữa trưa", "bữa tối", "uống", "nhà hàng", "quán", "trái cây", "rau", "thịt", "cá", "cà phê", "trà", "nấu ăn"]),
    },
    {
      title: "Cuộc sống hằng ngày & Công việc",
      summary: "Nhà cửa, văn phòng, trường học, phương tiện đi lại và sinh hoạt thường nhật",
      maxWords: 90,
      match: (w, vn) =>
        exactWord(w, [
          "home", "house", "room", "bedroom", "bathroom", "door", "window", "floor", "wall", "table",
          "chair", "bed", "desk", "key", "work", "job", "office", "company", "business", "worker",
          "school", "class", "classroom", "student", "teacher", "study", "learn", "book", "page",
          "pen", "pencil", "paper", "computer", "internet", "website", "car", "bus", "train", "plane",
          "bicycle", "bike", "taxi", "boat", "ticket", "station", "airport", "street", "road", "city",
          "town", "village", "country", "shop", "store", "market", "bank", "hotel", "park", "money",
          "buy", "sell", "pay", "cost", "price", "wear", "clothes", "shirt", "dress", "coat", "shoe",
        ]) || hasAny(vn, ["văn phòng", "công việc", "công ty", "trường học", "nhà cửa", "phòng", "xe buýt", "tàu hỏa", "máy bay", "sân bay", "cửa hàng", "mua", "bán", "tiền", "quần áo"]),
    },
  ],
  A2: [
    {
      title: "Giao tiếp Công sở & Email",
      summary: "Từ vựng trao đổi công việc, viết email, gọi điện và phối hợp cùng đồng nghiệp",
      maxWords: 55,
      match: (_w, vn, _pos, it) =>
        it ||
        hasAny(vn, ["đồng nghiệp", "văn phòng", "giao tiếp", "thông báo", "tin nhắn", "liên lạc", "trả lời", "xác nhận", "báo cáo", "tài liệu", "họp", "cuộc họp"]),
    },
    {
      title: "Kế hoạch, Lịch trình & Thời hạn",
      summary: "Sắp xếp lịch làm việc, quản lý thời gian, mục tiêu và kế hoạch",
      maxWords: 50,
      match: (_w, vn) =>
        hasAny(vn, ["lịch", "kế hoạch", "thời hạn", "hạn chót", "tương lai", "chuẩn bị", "bắt đầu", "kết thúc", "hoàn thành", "tiếp tục", "thay đổi", "quyết định", "mục tiêu"]),
    },
    {
      title: "Du lịch, Di chuyển & Công tác",
      summary: "Sân bay, khách sạn, phương tiện giao thông, chỉ đường và chuyến đi",
      maxWords: 55,
      match: (_w, vn) =>
        hasAny(vn, ["du lịch", "chuyến đi", "hành khách", "hành lý", "khách sạn", "máy bay", "tàu", "xe", "giao thông", "đường", "bản đồ", "hướng", "cầu", "biển", "núi", "đảo"]),
    },
    {
      title: "Cảm xúc, Tính cách & Con người",
      summary: "Miêu tả tính cách, tâm trạng, thái độ và mối quan hệ xã hội",
      maxWords: 55,
      match: (_w, vn, pos) =>
        pos.includes("adj") &&
        hasAny(vn, ["lo lắng", "hào hứng", "ngạc nhiên", "sợ", "tự hào", "thân thiện", "thông minh", "chăm chỉ", "lịch sự", "cẩn thận", "tốt bụng", "hạnh phúc", "buồn", "vui"]),
    },
    {
      title: "Mua sắm, Tài chính & Dịch vụ",
      summary: "Chi tiêu, hóa đơn, ngân hàng, giá trị và dịch vụ khách hàng",
      maxWords: 50,
      match: (_w, vn) =>
        hasAny(vn, ["tiền", "giá", "mua", "bán", "trả", "hóa đơn", "ngân hàng", "tài khoản", "tiết kiệm", "đắt", "rẻ", "miễn phí", "khách hàng", "dịch vụ", "chất lượng"]),
    },
    {
      title: "Sức khỏe, Đời sống & Giải trí",
      summary: "Chăm sóc sức khỏe, thể thao, âm nhạc, phim ảnh và hoạt động thường ngày",
      maxWords: 60,
      match: (_w, vn) =>
        hasAny(vn, ["sức khỏe", "bệnh", "đau", "thuốc", "tập", "thể thao", "bóng", "nhạc", "phim", "trò chơi", "nghỉ ngơi", "ngủ", "nấu", "vườn"]),
    },
  ],
  B1: [
    {
      title: "Thuyết trình & Thảo luận Công việc",
      summary: "Đưa ý kiến, thuyết phục, đồng tình, phản biện và trình bày giải pháp",
      maxWords: 55,
      match: (_w, vn) =>
        hasAny(vn, ["thảo luận", "tranh luận", "ý kiến", "quan điểm", "đề xuất", "gợi ý", "đồng ý", "phản đối", "giải thích", "trình bày", "thuyết phục", "kết luận"]),
    },
    {
      title: "Quản lý Dự án & Hiệu suất",
      summary: "Tổ chức công việc, phân công, tiến độ, giải quyết sự cố và đánh giá kết quả",
      maxWords: 55,
      match: (_w, vn, _pos, it) =>
        it || hasAny(vn, ["dự án", "quản lý", "nhiệm vụ", "trách nhiệm", "tiến độ", "hiệu quả", "thành công", "thất bại", "kết quả", "mục tiêu", "giải pháp", "vấn đề"]),
    },
    {
      title: "Kinh doanh, Tài chính & Nghề nghiệp",
      summary: "Thị trường, đầu tư, hợp đồng, tuyển dụng và phát triển sự nghiệp",
      maxWords: 60,
      match: (_w, vn) =>
        hasAny(vn, ["kinh doanh", "thương mại", "thị trường", "đầu tư", "lợi nhuận", "chi phí", "hợp đồng", "tuyển dụng", "phỏng vấn", "lương", "sự nghiệp", "doanh nghiệp"]),
    },
    {
      title: "Công nghệ, Dữ liệu & Hệ thống",
      summary: "Phần mềm, mạng, dữ liệu, thiết bị số và quy trình kỹ thuật",
      maxWords: 55,
      match: (_w, vn, _pos, it) =>
        it || hasAny(vn, ["dữ liệu", "hệ thống", "mạng", "phần mềm", "kỹ thuật", "công nghệ", "thiết bị", "kết nối", "truy cập", "bảo mật", "tập tin"]),
    },
    {
      title: "Xã hội, Giáo dục & Môi trường",
      summary: "Văn hóa, giáo dục, truyền thông, chính sách và môi trường sống",
      maxWords: 55,
      match: (_w, vn) =>
        hasAny(vn, ["xã hội", "văn hóa", "giáo dục", "truyền thông", "môi trường", "khí hậu", "năng lượng", "tự nhiên", "chính phủ", "luật", "cộng đồng"]),
    },
    {
      title: "Tư duy, Phân tích & Đánh giá",
      summary: "So sánh, đo lường, nguyên nhân – kết quả và suy luận logic",
      maxWords: 55,
      match: (_w, vn) =>
        hasAny(vn, ["phân tích", "đánh giá", "so sánh", "nguyên nhân", "ảnh hưởng", "tác động", "nghiên cứu", "bằng chứng", "xác định", "ước tính"]),
    },
  ],
  B2: [
    {
      title: "Đàm phán & Chiến lược Kinh doanh",
      summary: "Chiến lược doanh nghiệp, thương lượng, hợp tác và quản trị rủi ro",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["chiến lược", "đàm phán", "thương lượng", "đối tác", "cạnh tranh", "rủi ro", "tài chính", "ngân sách", "thị phần", "doanh thu", "lợi thế"]),
    },
    {
      title: "Kỹ thuật, Kiến trúc & Vận hành",
      summary: "Từ vựng chuyên ngành kỹ thuật, hạ tầng, quy trình và tối ưu hóa",
      maxWords: 65,
      match: (_w, vn, _pos, it) =>
        it || hasAny(vn, ["hệ thống", "cấu trúc", "quy trình", "vận hành", "triển khai", "tích hợp", "cơ chế", "thông số", "giao diện", "tự động"]),
    },
    {
      title: "Lập luận, Phản biện & Báo cáo",
      summary: "Trình bày báo cáo chuyên sâu, dẫn chứng, giả định và bác bỏ",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["lập luận", "giả định", "chứng minh", "minh họa", "nhấn mạnh", "ngụ ý", "kết luận", "quan điểm", "tiêu chí", "phạm vi"]),
    },
    {
      title: "Tâm lý, Hành vi & Lãnh đạo",
      summary: "Động lực, cảm xúc phức tạp, giao tiếp nhân sự và nghệ thuật lãnh đạo",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["nhận thức", "thái độ", "động lực", "hành vi", "tâm lý", "cảm thông", "cam kết", "uy tín", "lãnh đạo", "truyền cảm hứng"]),
    },
    {
      title: "Kinh tế, Luật pháp & Quản trị",
      summary: "Quy định, tuân thủ, chính sách công, thương mại quốc tế và pháp lý",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["quy định", "pháp lý", "luật", "chính sách", "kinh tế", "thuế", "lạm phát", "cơ quan", "ủy ban", "hiệp định"]),
    },
    {
      title: "Khoa học, Đổi mới & Xu hướng",
      summary: "Nghiên cứu khoa học, phát minh, chuyển đổi số và xu hướng toàn cầu",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["khoa học", "phát minh", "đổi mới", "tiến bộ", "xu hướng", "toàn cầu", "bền vững", "sinh học", "vật lý", "hiện tượng"]),
    },
  ],
  C1: [
    {
      title: "Diễn ngôn Điều hành & Chiến lược",
      summary: "Từ vựng cấp quản lý cấp cao, hoạch định tầm nhìn và tái cấu trúc",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["chiến lược", "tầm nhìn", "quản trị", "điều hành", "thâu tóm", "liên minh", "độc quyền", "bền vững", "khủng hoảng", "đột phá"]),
    },
    {
      title: "Học thuật & Phân tích Chuyên sâu",
      summary: "Thuật ngữ nghiên cứu, phương pháp luận, tổng hợp và đánh giá học thuật",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["học thuật", "lý thuyết", "giả thuyết", "thực nghiệm", "tương quan", "hệ quả", "bản chất", "khái niệm", "trừu tượng", "logic"]),
    },
    {
      title: "Văn phong Trang trọng & Sắc thái",
      summary: "Tính từ và động từ sắc thái tinh tế cho văn viết và phát biểu trang trọng",
      maxWords: 65,
      match: (_w, vn, pos) =>
        pos.includes("adj") && hasAny(vn, ["tinh tế", "sâu sắc", "rõ rệt", "hiển nhiên", "mơ hồ", "khắt khe", "kiên quyết", "thận trọng", "vượt trội"]),
    },
    {
      title: "Pháp chế, Ngoại giao & Chính sách",
      summary: "Hiến pháp, hiệp ước, quyền hạn, chế tài và quan hệ quốc tế",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["ngoại giao", "chủ quyền", "hiến pháp", "pháp령", "chế tài", "trọng tài", "ủy quyền", "ban hành", "bãi bỏ", "cưỡng chế"]),
    },
    {
      title: "Kinh tế Vĩ mô & Thị trường",
      summary: "Biến động tài chính, đầu cơ, thanh khoản, suy thoái và tăng trưởng",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["vĩ mô", "tài khóa", "tiền tệ", "suy thoái", "thặng dư", "thâm hụt", "cổ tức", "vốn", "bất động sản", "biến động"]),
    },
    {
      title: "Phê bình, Nghệ thuật & Nhân văn",
      summary: "Triết học, văn học, nghệ thuật, đạo đức và phê bình xã hội",
      maxWords: 65,
      match: (_w, vn) =>
        hasAny(vn, ["triết học", "đạo đức", "nhân văn", "nghệ thuật", "thẩm mỹ", "biểu tượng", "ẩn dụ", "châm biếm", "di sản", "tư tưởng"]),
    },
  ],
};

const CORE_PACK_PREFIX: Record<StudyLevel, string> = {
  A1: "Foundation A1",
  A2: "Elementary A2",
  B1: "Intermediate B1",
  B2: "Upper B2",
  C1: "Advanced C1",
};

const CORE_PACK_SIZE = 75;

const ACTIVE_PACK_KEY = "myenglish_active_vocab_pack_v1";

export function getActivePackId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PACK_KEY);
  } catch {
    return null;
  }
}

export function setActivePackId(packId: string | null): void {
  try {
    if (packId) localStorage.setItem(ACTIVE_PACK_KEY, packId);
    else localStorage.removeItem(ACTIVE_PACK_KEY);
    window.dispatchEvent(new CustomEvent("myenglish-active-pack-changed", { detail: { packId } }));
  } catch {}
}

/**
 * Load all structured vocabulary packs (01..N) for a CEFR level, enriched with real user SRS progress.
 */
export async function loadPacksForLevel(level: StudyLevel): Promise<VocabPack[]> {
  await ensureCatalogSeeded();
  const db = await getDatabase();

  const [catalogRows, statusRows] = await Promise.all([
    db.select<Array<{ id: string; word: string; pos: string; vn: string; it: number; study_order: number }>>(
      `SELECT id, word, pos, vn, it, study_order FROM vocab_catalog WHERE cefr = $1 ORDER BY study_order ASC`,
      [level]
    ),
    db.select<Array<{ catalog_id: string; met: number; remembered: number; known: number }>>(
      `SELECT w.catalog_id,
              CASE WHEN COALESCE(s.reps, 0) > 0 THEN 1 ELSE 0 END AS met,
              CASE WHEN s.state = 2 AND COALESCE(s.stability, 0) >= $1 AND EXISTS (
                SELECT 1 FROM review_logs r WHERE r.word_id = w.id AND r.exercise_type NOT IN ('known', 'intro')
                  AND COALESCE(r.is_scheduled, 1) != 2
              ) THEN 1 ELSE 0 END AS remembered,
              CASE WHEN EXISTS (
                SELECT 1 FROM review_logs r WHERE r.word_id = w.id AND r.exercise_type = 'known'
              ) THEN 1 ELSE 0 END AS known
       FROM words w
       JOIN srs_reviews s ON s.word_id = w.id
       WHERE w.catalog_id IS NOT NULL AND w.cefr_level = $2`,
      [MASTERED_STABILITY_DAYS, level]
    ),
  ]);

  const statusMap = new Map(statusRows.map((r) => [r.catalog_id, r]));
  const themes = LEVEL_THEMES[level] || [];
  const themeBuckets: Array<{ def: ThemeDef; ids: string[] }> = themes.map((def) => ({ def, ids: [] }));
  const remainingIds: string[] = [];

  for (const row of catalogRows) {
    const wLower = row.word.toLowerCase().trim();
    const vnLower = (row.vn || "").toLowerCase();
    const posLower = (row.pos || "").toLowerCase();
    const isIt = row.it === 1;

    let assigned = false;
    for (const bucket of themeBuckets) {
      if (bucket.ids.length < bucket.def.maxWords && bucket.def.match(wLower, vnLower, posLower, isIt)) {
        bucket.ids.push(row.id);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      remainingIds.push(row.id);
    }
  }

  const packs: VocabPack[] = [];
  let packIdx = 1;
  const levelLabel = LEVEL_FOLDER_META[level].subtitle.toLowerCase();

  const buildPack = (title: string, customDesc: string | null, ids: string[], isThematic: boolean): VocabPack => {
    let met = 0;
    let remembered = 0;
    let known = 0;
    for (const id of ids) {
      const st = statusMap.get(id);
      if (st) {
        if (st.met) met++;
        if (st.remembered) remembered++;
        if (st.known) known++;
      }
    }
    const idx = packIdx++;
    const numStr = String(idx).padStart(2, "0");
    return {
      id: `${level}-pack-${numStr}`,
      index: idx,
      level,
      title,
      description:
        customDesc ??
        `${ids.length} từ vựng "${title}" — trình độ ${level} (${levelLabel}). Có phiên âm IPA, nghĩa tiếng Việt & câu ví dụ.`,
      isThematic,
      total: ids.length,
      met,
      remembered,
      known,
      wordIds: ids,
    };
  };

  for (const bucket of themeBuckets) {
    if (bucket.ids.length >= 8) {
      packs.push(
        buildPack(
          bucket.def.title,
          `${bucket.ids.length} từ vựng "${bucket.def.title}" — trình độ ${level}. ${bucket.def.summary}.`,
          bucket.ids,
          true
        )
      );
    } else {
      remainingIds.unshift(...bucket.ids);
    }
  }

  const prefix = CORE_PACK_PREFIX[level];
  let coreNum = 1;
  for (let i = 0; i < remainingIds.length; i += CORE_PACK_SIZE) {
    const chunk = remainingIds.slice(i, i + CORE_PACK_SIZE);
    // If the very last tail chunk is tiny (< 25 words) and we already have a core pack, merge it into the previous pack
    if (chunk.length < 25 && packs.length > 0 && !packs[packs.length - 1].isThematic) {
      const prev = packs[packs.length - 1];
      prev.wordIds.push(...chunk);
      prev.total = prev.wordIds.length;
      for (const id of chunk) {
        const st = statusMap.get(id);
        if (st) {
          if (st.met) prev.met++;
          if (st.remembered) prev.remembered++;
          if (st.known) prev.known++;
        }
      }
      prev.description = `${prev.total} từ vựng "${prev.title}" — trình độ ${level} (${levelLabel}). Có phiên âm IPA, nghĩa tiếng Việt & câu ví dụ.`;
      continue;
    }
    const title = `${prefix} — Bộ ${coreNum++}`;
    packs.push(buildPack(title, null, chunk, false));
  }

  return packs;
}

/**
 * Load all CatalogEntries + their study status for a specific pack so the learner can inspect, listen, mark known, or study.
 */
export async function loadPackWords(wordIds: string[]): Promise<PackWordItem[]> {
  if (wordIds.length === 0) return [];
  await ensureCatalogSeeded();
  const db = await getDatabase();

  const entries: CatalogEntry[] = [];
  for (let i = 0; i < wordIds.length; i += 400) {
    const chunk = wordIds.slice(i, i + 400);
    const rows = await db.select<CatalogRow[]>(
      `SELECT id, word, cefr, list, study_order, freq, it, pos, vn, data
       FROM vocab_catalog WHERE id IN (${chunk.map((_, j) => `$${j + 1}`).join(", ")})`,
      chunk
    );
    entries.push(...rowsToEntries(rows));
  }

  const statusRows = await db.select<Array<{ catalog_id: string; reps: number; state: number; stability: number; is_known: number }>>(
    `SELECT w.catalog_id,
            COALESCE(s.reps, 0) AS reps,
            COALESCE(s.state, 0) AS state,
            COALESCE(s.stability, 0) AS stability,
            CASE WHEN EXISTS (
              SELECT 1 FROM review_logs r WHERE r.word_id = w.id AND r.exercise_type = 'known'
            ) THEN 1 ELSE 0 END AS is_known
     FROM words w
     JOIN srs_reviews s ON s.word_id = w.id
     WHERE w.catalog_id IN (${wordIds.map((_, i) => `$${i + 1}`).join(", ")})`,
    wordIds
  );

  const stMap = new Map(statusRows.map((r) => [r.catalog_id, r]));
  const orderMap = new Map(wordIds.map((id, idx) => [id, idx]));
  entries.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  return entries.map((entry) => {
    const st = stMap.get(entry.id);
    let status: PackWordStatus = "unstudied";
    if (st) {
      if (st.is_known === 1) status = "known";
      else if (st.state === 2 && st.stability >= MASTERED_STABILITY_DAYS) status = "remembered";
      else if (st.reps > 0) status = "learning";
    }
    return { entry, status };
  });
}

/**
 * Prioritize a pack: pulls up to `batchSize` unstudied words of this pack to the very front of the new-word queue
 * so the learner's next study session immediately teaches words from this pack.
 */
export async function prioritizePackForStudy(pack: VocabPack, batchSize = 25): Promise<number> {
  await ensureCatalogSeeded();
  const db = await getDatabase();
  setActivePackId(pack.id);

  if (pack.wordIds.length === 0) return 0;

  const existingRows = await db.select<Array<{ id: string; catalog_id: string; reps: number; state: number }>>(
    `SELECT w.id, w.catalog_id, COALESCE(s.reps, 0) AS reps, COALESCE(s.state, 0) AS state
     FROM words w
     LEFT JOIN srs_reviews s ON s.word_id = w.id
     WHERE w.catalog_id IN (${pack.wordIds.map((_, i) => `$${i + 1}`).join(", ")})`,
    pack.wordIds
  );
  const existingMap = new Map(existingRows.map((r) => [r.catalog_id, r]));

  const unstudiedCatalogIds = pack.wordIds
    .filter((cid) => {
      const ex = existingMap.get(cid);
      return !ex || (ex.reps === 0 && ex.state === 0);
    })
    .slice(0, batchSize);

  if (unstudiedCatalogIds.length === 0) return 0;

  const firstWaiting = await db.select<Array<{ first: string | null }>>(
    `SELECT MIN(s.next_review_date) AS first FROM words w JOIN srs_reviews s ON s.word_id = w.id
     WHERE COALESCE(s.reps, 0) = 0 AND COALESCE(s.state, 0) = 0`
  );
  const firstMs = firstWaiting[0]?.first ? Date.parse(firstWaiting[0].first) : Date.now();
  const baseMs = Math.min(firstMs, Date.now()) - (unstudiedCatalogIds.length + 2) * 1000;

  const toInsertIds: string[] = [];
  for (let i = 0; i < unstudiedCatalogIds.length; i++) {
    const cid = unstudiedCatalogIds[i];
    const ex = existingMap.get(cid);
    const at = new Date(baseMs + i * 1000).toISOString();
    if (ex) {
      await db.execute(`UPDATE words SET created_at = $1, suspended = 0, updated_at = $1 WHERE id = $2`, [at, ex.id]);
      await db.execute(`UPDATE srs_reviews SET next_review_date = $1 WHERE word_id = $2`, [at, ex.id]);
    } else {
      toInsertIds.push(cid);
    }
  }

  if (toInsertIds.length > 0) {
    const entries = await getCatalogEntries(toInsertIds);
    await insertCatalogWords(
      entries.map((e, idx) => toCatalogWordInput(e, new Date(baseMs + idx * 1000).toISOString()))
    );
  }

  notifyWordsChanged();
  return unstudiedCatalogIds.length;
}

export { markCatalogWordsKnown };

