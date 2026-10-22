# Bài học tình huống + luyện nói (2026-10-22)

Mục tiêu: giúp người **chưa giao tiếp được** nói ra những câu cần dùng trong đời thường và công việc,
không chỉ nhớ từ rời. Dùng cho bản thân và vài người quen, chưa hướng tới đông người dùng.

Đã bàn và chốt:
- Nội dung: giao tiếp đời thường + công việc chung (chưa theo ngành). Mở rộng ngành sau.
- Chấm giọng: miễn phí, chạy trên máy. Dùng **Vosk** (đã có), không dùng Whisper.
- AI: không gọi lúc học. Nội dung sinh sẵn một lần, người học dùng mà không tốn request.
- Luyện nói ưu tiên **Android**. Windows làm sau.

**Cập nhật:** đây là một **tính năng độc lập: "Trò chuyện tình huống"** (tab riêng), không gắn vào Từ vựng,
Ôn tập hay Ngữ pháp. Có bảng dữ liệu riêng, tiến độ riêng, giao diện riêng. Chỉ dùng chung hạ tầng
(TTS, Vosk, scheduler FSRS, giao diện chung). Chi tiết ở mục 1b.

**Tình trạng (2026-10-22): bản dùng được đã xong, chạy trên Android.** Khác với kế hoạch gốc:
- Tab "Hội thoại" kiểu chat. Bốn cách trả lời: Chọn câu, Ghép từ, Nói, Gõ. Chế độ "Tự động" đi theo bậc thang này theo số lần làm đúng từng câu.
- 10 tình huống (7 đời thường, 3 công việc) trong `src/data/situations/`, viết tay, có kiểm thử cấu trúc.
- Tiến độ lưu bằng localStorage (`myenglish_talk_v1`), **không có bảng `situation_progress` và chưa có lịch ôn FSRS**.
- Chưa làm: điều chỉnh theo trình độ chung (`chosenLevel()`, `isFoundationMode()`), nối XP/streak/sổ lỗi/nhiệm vụ ngày, Windows, hội thoại tự do với AI, kiểm thử độ chính xác của mic (cần log `[talk]` từ lần nói thật).

---

## 1b. Tính năng độc lập "Trò chuyện tình huống"

Trải nghiệm chính là **trò chuyện**, không phải thẻ ôn. Người học chọn một tình huống, nhân vật nói trước
(giọng TTS), người học chọn hoặc nói câu trả lời, nhân vật đáp lại. Học câu mẫu chỉ là bước khởi động trước
khi vào trò chuyện, và ôn lại các câu hay sai là bước phụ ở cuối.

Màn hình:
1. **Danh sách tình huống:** nhóm "Đời thường" / "Công việc", ghi mục tiêu ("Gọi được một ly cà phê"), trạng thái (chưa học / đã nói được / cần ôn).
2. **Khởi động:** nghe và nhại 6–8 câu của tình huống (có chế độ xem tiếng Việt).
3. **Trò chuyện:** theo cây kịch bản, có 3 mức hỗ trợ: chọn câu có sẵn → xem gợi ý đầu câu → tự nói.
4. **Tổng kết:** câu nói được, câu cần luyện lại, nút "Nói lại".

Cách nối vào app (tối thiểu, để không đụng các tính năng khác):
- Thêm `"talk"` vào `DashboardTab` ([shared.ts](../../src/components/dashboard/shared.ts)).
- Thêm một mục thanh bên ([Sidebar.tsx](../../src/components/dashboard/Sidebar.tsx)) và một nhánh `activeTab === "talk"` trong `MainDashboard.tsx`, tải lazy như `GrammarHub`.
- Code nằm trong thư mục riêng: `src/components/talk/`, `src/services/talk/`, `src/data/situations/`. Không sửa file của tính năng khác ngoài ba điểm nối trên.
- Tiến độ lưu ở bảng `situation_progress` (mục 3), không ghi vào `words`, `srs_*`, XP hay streak lúc đầu.

Để sau, nếu muốn (không bắt buộc): tính một lượt trò chuyện vào streak/XP, đưa lỗi vào sổ lỗi, nhiệm vụ ngày.

---

## 1. Hiện trạng liên quan (đã đọc code)

| Thứ | Hiện có | Giới hạn với kế hoạch này |
|---|---|---|
| Nhận diện giọng | `AsrBridge.kt`: Vosk offline, model 68MB trong APK, `start()` / `stop(grammarJson)` | Chỉ dùng cho **một từ**; `MAX_LISTEN_MS = 3500` quá ngắn cho câu |
| Kiểm tra phát âm | `pronunciationCheck.ts`: `isCheckableWord` chỉ nhận `^[a-z]+$`; mức "focus" / "word"; ngưỡng tin cậy; từ dễ nhầm | Phải mở rộng cho câu |
| Windows | Không có nhận diện giọng | Để giai đoạn sau |
| TTS | `speech.ts`: TTS Android (`TtsBridge`) + `speechSynthesis`, có chọn giọng và tốc độ chậm | Dùng lại nguyên |
| SRS | `srs_reviews` và `srs_production` khóa theo `word_id`, FK tới `words` | **Không dùng cho câu** (xem mục 3) |
| Tiền lệ SRS cho nội dung khác từ | `grammar_progress` có cột FSRS riêng, scheduler `getGrammarScheduler()`, `enable_short_term: false` | Làm theo mẫu này |
| AI | `ai_api.rs`: Gemini API với key riêng của từng người (lưu trong kho khóa OS), CLI dự phòng | Dùng để **sinh nội dung sẵn**, không dùng lúc học |
| Nội dung | `vocabCatalog.json` (Oxford, ví dụ chung chung). Không có dữ liệu câu theo tình huống | Phải tạo mới |
| Sổ lỗi | `mistakes.ts` | Nối lỗi nói sai vào đây |

---

## 2. Thiết kế dữ liệu tình huống

File mới `src/data/situations/*.ts` (hoặc `.json`), mỗi tình huống một file nhỏ để dễ duyệt tay.

```ts
interface Situation {
  id: string;            // "cafe-order"
  title_vn: string;      // "Gọi đồ ở quán cà phê"
  title_en: string;
  cefr: "A1" | "A2" | "B1";
  tags: ("daily" | "work")[];
  goal_vn: string;       // "Gọi được một ly cà phê và trả tiền" (mục tiêu "làm được gì")
  lines: SituationLine[]; // 6–8 câu cần học
  dialogue: DialogueNode[];
}

interface SituationLine {
  id: string;            // "cafe-order.l1"
  en: string;            // câu mẫu, 3–10 từ
  vi: string;
  accept: string[];      // cách nói khác chấp nhận được (cho nhận diện giọng)
  focus?: string[];      // từ khóa cần nghe thấy
}

interface DialogueNode {
  id: string;
  npc_en: string;        // câu nhân vật nói (TTS)
  npc_vi: string;
  replies: { lineId: string; next: string | null }[]; // câu trả lời hợp lệ, rẽ nhánh
}
```

Quy tắc:
- Câu ngắn, thông dụng, tự nhiên. Không dịch word-by-word.
- `accept` chỉ gồm biến thể thật sự dùng được ("Can I have a coffee?" / "I'd like a coffee, please"), để Vosk không bắt người học đọc đúng một câu.
- Cây hội thoại có tối đa 2–3 nhánh mỗi nút. Người mới không cần nhiều lựa chọn.

---

## 3. Lưu tiến độ: bảng riêng, không dùng `words`

Lý do: `words` + `srs_*` đi vào thư viện từ, đếm từ đã biết, bài spelling / cloze / letter tiles,
XP theo từ, bảng xếp hạng. Câu không hợp với các luồng đó.

Bảng mới `situation_progress` (migration mới, làm theo `grammar_progress`):

```
line_id TEXT PRIMARY KEY,
situation_id TEXT,
stability REAL, difficulty REAL, fsrs_state INTEGER,
reps INTEGER, lapses INTEGER,
next_review_date TIMESTAMP, last_review TIMESTAMP,
last_heard TEXT          -- câu máy nghe được lần gần nhất, để hiển thị
```

- Scheduler riêng như `getGrammarScheduler()` (khoảng ôn theo ngày).
- Điểm → rating: nói đúng ngay lần đầu = Good; đúng sau gợi ý = Hard; sai = Again. Dùng lại logic kiểu `gradeFromScore`.
- Lỗi nói sai đưa vào `mistakes.ts` (cần đọc file này để chọn đúng điểm nối).

---

## 4. Mở rộng "Đọc thử" từ từ sang câu

Sửa `pronunciationCheck.ts` và `AsrBridge.kt`:

1. Thêm `isCheckablePhrase` (nhiều từ, cho phép `'`, bỏ dấu câu khi so).
2. Grammar gửi cho Vosk = câu đích + `accept` + 2–3 câu **gần giống dễ nhầm**. Danh sách quá ngắn thì Vosk dễ đoán trúng đích dù nói sai.
3. `MAX_LISTEN_MS` đặt theo độ dài câu (khoảng 1,5 s + 0,5 s mỗi từ, tối đa 8 s) thay vì cố định 3,5 s.
4. Kết quả như hiện tại: `match` / `weak` / `confused` / `unclear` / `silent`. **Không cho điểm số**, vì nhận diện giọng không đo được phát âm. UI nói rõ: "máy nghe hiểu được hay chưa".
5. Kiểm tra `AsrBridge.knownWords`: từ không có trong từ điển model sẽ bị bỏ qua im lặng. Câu có từ như tên riêng phải bị loại hoặc cảnh báo khi **soạn nội dung**, không phải lúc người học nói.

Rủi ro đã biết: grammar hẹp thì máy có xu hướng "đoán" ra câu đích. Chấp nhận được với người mới, nhưng phải giữ mức khắt khe có thể chỉnh (đã có "focus" / "word").

---

## 5. Sinh nội dung sẵn (không tốn request lúc học)

Script `scripts/generate-situation.mjs`, chạy trên máy bạn:
- Đầu vào: danh sách chủ đề (`cafe-order`, `ask-direction`, `introduce-yourself`, `standup-update`, `ask-for-help`...).
- Gọi Gemini API bằng key của bạn (biến môi trường, không commit), ép trả JSON đúng định dạng mục 2.
- Tự kiểm tra: schema, độ dài câu, từ không có trong từ điển Vosk, `accept` có chứa `en`.
- Ghi ra file để **bạn đọc duyệt tay** rồi mới commit.

Số lượng ban đầu: 10 tình huống đời thường + 5 tình huống công việc chung. Chưa làm hơn cho đến khi tự dùng thử.

---

## 6. Các giai đoạn

| GĐ | Việc | Có thể dùng được | Ước lượng |
|---|---|---|---|
| 0 | Định dạng dữ liệu (mục 2) + soạn tay **1 tình huống** + 5 tình huống từ script | Chưa | 0,5 ngày |
| 1 | Tab "Trò chuyện" + bảng `situation_progress`: danh sách tình huống, khởi động (nghe, nhại), **trò chuyện theo cây kịch bản ở mức chọn câu có sẵn**, tổng kết, lịch ôn FSRS riêng. **Chưa có chấm giọng** | Có, trên Windows và Android | 2–3 ngày |
| 2 | Mở rộng "Đọc thử" sang câu (mục 4): thêm mức "tự nói" vào trò chuyện, chỉ Android; thử trên máy thật | Có, trên Android | 1–2 ngày |
| 3 | Mức gợi ý đầu câu, mục tiêu theo tuần ("hôm nay nói được 5 câu") | Có | 1 ngày |
| 4 | Tùy chọn: nối vào streak/XP, sổ lỗi, nhiệm vụ ngày | Có | 1 ngày |
| 5 | Thêm tình huống (đến 30–50), chỉnh theo trải nghiệm thật | | liên tục |
| 6 | Nhận diện giọng trên Windows (Vosk desktop) | Có, trên Windows | chưa ước lượng |
| 7 | Hội thoại tự do với AI, có hạn mức theo ngày, gom 1 request mỗi buổi, hàng đợi khi hết hạn mức | Có | khi cần |

Dừng sau GĐ 2 để tự dùng vài ngày rồi mới tiếp. Nếu thiết kế dữ liệu hay cách nói không ổn, sửa ở đây rẻ hơn nhiều so với sau khi có 50 tình huống.

---

## 7. Điều chưa kiểm tra (làm ở GĐ tương ứng)

- Mục 4: Vosk có nhận grammar là danh sách **câu** mà không cần tách từ không? (Kotlin hiện nhận danh sách từ.) Thử trên máy thật ở GĐ 2.
- Ghi âm / nhận diện trên Windows (GĐ 6): chưa biết dùng crate `vosk` hay chạy qua sidecar; cần thử.
- Mục 3: điểm nối chính xác vào `mistakes.ts` và `dailyQuests.ts` (đọc khi làm GĐ 4).
- Giao diện: chưa thiết kế. Làm GĐ 1 theo phong cách các tab hiện có (`GrammarHub` là mẫu gần nhất).

---

## 8. Không làm (cố ý)

- Whisper: nặng hơn Vosk, lại quá dễ dãi với giọng sai, khó giữ mức khắt khe cho từng bài.
- Điểm phát âm 0–100: máy nhận diện giọng không đo được, sẽ gây hiểu lầm.
- Gọi AI lúc người học đang học: hạn mức miễn phí sẽ cạn, và trải nghiệm phụ thuộc mạng.
- Đưa câu vào bảng `words`: làm ô nhiễm thư viện từ và các thống kê.
