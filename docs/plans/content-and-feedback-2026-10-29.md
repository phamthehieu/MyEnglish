# Lấp nội dung B2–C1 và nghe được người học (2026-10-29)

> Kích thước: **S** = vài giờ · **M** = 1–2 ngày · **L** = ≥ 3 ngày.
> Nên làm trước: **A1 → A2 → B3 → B1/B2** (lý do ở cuối).

## Hiện trạng

**Nội dung theo trình độ** (đếm từ `src/data/`):

| | A1 | A2 | B1 | B2 | C1 |
|---|---|---|---|---|---|
| Mẫu câu (`patterns/`) | 90 | 96 | 96 | **0** | **0** |
| Chặng của lộ trình nói | 24 | 24 | 24 | **0** | **0** |
| Mẹo ngữ pháp (`grammarTips/`) | 24 | 24 | 24 | **0** | **0** |
| Shadowing (`shadowing/index.json`) | 50 | 46 | 42 | 44 | **0** |
| Tình huống (`situations/generated/`) | ✅ | ✅ | ✅ | ✅ | ✅ |

Bài xếp trình độ đi tới C1. Người học B2/C1 bị lùi về chặng B1 (`startsLower` trong `src/components/roadmap/useRoadmap.ts`).
`PatternsTab.tsx` đã báo điều này cho người học, nên đây là thiếu nội dung chứ không phải lỗi.

**Nghe người học:** app không có telemetry. Đây là lựa chọn có chủ đích, xem `scripts/install-stats.sh`. Hiện chỉ có 3 nguồn:
- Lượt tải trên GitHub Releases (`npm run stats`). Chỉ là lượt tải, không phải số người đang học.
- Dữ liệu đồng bộ của người **đã đăng nhập** (`sync_rows`), và các báo cáo `focus_retention_report` / `focus_session_report`
  (migration 0007, chạy trong SQL editor).
- Không có nút góp ý, nên người học không có cách nào nói với bạn.

Các tính năng mới (shadowing, hội thoại AI, mẫu câu, tình huống) **không ghi `learning_events`**. Vì vậy, kể cả với người đã
đăng nhập, cũng không biết có ai dùng các tính năng này hay không.

---

## A. Nghe được người học

### A1. Nút "Góp ý" + báo ngay cho bạn — M ✅

> **Đã làm (2026-10-29):**
> - Migration `supabase/migrations/0008_feedback.sql`, service `src/services/feedback.ts`, form
>   `src/components/dashboard/FeedbackForm.tsx`.
> - Form nằm ở mục "Góp ý cho app" trong Cài đặt, và có dòng "Góp ý cho app" trên `DayCloseCard` khi đã xong ngày.
> - Test: `test/feedback.test.ts`. Cách cài Telegram: `supabase/README.md`, mục "Feedback".
> - **Khác kế hoạch:** gửi lỗi thì form giữ nguyên chữ đã viết để bấm gửi lại, không có hàng đợi gửi khi có mạng.
>   Giới hạn là 5 góp ý/thiết bị/ngày và 60 góp ý/giờ cho toàn bộ app.

- **Chỗ đặt:** trong Cài đặt, và một dòng nhỏ ở màn kết thúc ngày (`DayCloseCard`). Không bật lên giữa lúc đang học.
- **Form:** loại (Lỗi / Nội dung sai / Ý tưởng / Khác), nội dung (tối đa 2000 ký tự), liên hệ để trả lời (không bắt buộc).
  App tự gắn kèm phiên bản, nền tảng (Windows/macOS/Android), màn hình đang mở và trình độ đang học.
  **Không** gắn dữ liệu học.
- **Không cần đăng nhập.** Khi mất mạng thì lưu tạm và gửi lại khi có mạng.
- **Supabase**, migration `0008_feedback.sql`:
  - Bảng `feedback`. Không cho `select` qua API, bạn đọc trong dashboard.
  - Hàm `send_feedback(...)` (security definer) để ghi, có giới hạn khoảng 5 góp ý/ngày cho mỗi `device_id`.
    `device_id` do app gửi lên nên vẫn giả mạo được. Với app nhỏ thì chấp nhận được.
- **Báo ngay cho bạn:** trigger `after insert` dùng `pg_net` gọi Telegram Bot API (token để trong Supabase Vault), hoặc một
  Edge Function nhỏ gửi email. Đây chính là phần "thông báo" đang thiếu.
- **Phương án tối thiểu (khoảng 1 giờ), nếu muốn có ngay:** nút mở nhóm Zalo/Facebook của app. Cách này không cần sửa backend,
  nhưng người học ít khi chịu rời app để viết.

### A2. Ghi sự kiện cho các tính năng mới — S

- Thêm vào `LearningEventType` (`src/services/learningEvents.ts`):
  - `shadowing_completed` (meta: lessonId, level)
  - `talk_completed` (meta: topic, turns)
  - `pattern_stage_completed` (meta: stage, level)
  - `situation_completed` (meta: id, level)
- Ghi sự kiện ở chỗ kết thúc từng bài: `ShadowingTab.tsx`, `talk/Conversation.tsx`, `roadmap/DaySession.tsx`, tab Tình huống.
- Sự kiện đi theo kênh sync có sẵn (`sync/collect.ts` đã gửi `learning_events`). Như vậy không thêm telemetry mới, chỉ người đã
  đăng nhập mới được tính.

### A3. Báo cáo cho bạn — S

Thêm hàm `usage_report(p_days)` vào migration 0008. Giống 0007, hàm này không cấp quyền cho anon/authenticated.
- Số tài khoản hoạt động trong 7 và 30 ngày (dựa vào `max(sync_rows.updated_at)` của mỗi người).
- Số người đã dùng từng tính năng, lấy từ sự kiện của A2.
- Phân bố trình độ đang học. Câu này trả lời: **có bao nhiêu người đang ở B2 trở lên?**
- Mức tùy chọn: gửi tóm tắt qua cùng bot Telegram mỗi thứ Hai bằng `pg_cron`.

Lưu ý: số liệu chỉ phản ánh người đã đăng nhập. Không nên ép đăng nhập để có số liệu.

### A4. Hỏi nhanh sau khi xong việc — S

Sau khi xong một chặng mẫu câu, một bài shadowing hoặc một hội thoại AI, hỏi một câu: "Phần này có giúp bạn không?" kèm 2 nút
Có ích / Chưa, và một dòng ghi chú (không bắt buộc).
- Mỗi tính năng hỏi tối đa 1 lần mỗi 2 tuần.
- Câu trả lời gửi vào cùng bảng `feedback` với loại `rating`.

---

## B. Nội dung B2–C1

### B1. Mẫu câu B2 — L (chủ yếu là soạn và duyệt nội dung)

- 24 chặng, khoảng 96 mẫu câu, theo đúng quy trình đã làm cho B1:
  1. AI viết theo định dạng `scripts/import/patterns/_example.txt`, lưu thành `scripts/import/patterns/B2-<chặng>-<n>.txt`.
  2. Chạy `npm run patterns:import -- <files> --check`, rồi import thật.
  3. Chạy `npm run patterns:ipa`.
- Gợi ý ngữ pháp cho các chặng B2:
  - nêu và bảo vệ quan điểm
  - phản đối lịch sự
  - giả định với câu điều kiện loại 3 và câu điều kiện hỗn hợp
  - tiếc nuối với wish / if only, should have
  - suy đoán với must / might / can't have
  - tường thuật lời người khác
  - bị động nâng cao (it is said that…, have something done)
  - nối ý tương phản (whereas, despite, even though)
  - câu nhấn mạnh (What I need is…, It was… that…)
  - thương lượng, họp, đưa ra đề xuất
- **Duyệt bằng người:** tự đọc ít nhất 1 mẫu trong mỗi chặng. AI hay viết câu B2 nghe "sách vở", không tự nhiên.

### B2. Mẹo ngữ pháp B2 — M

- 24 mẹo, mỗi chặng một mẹo: `scripts/import/tips/tips-b2a.json`, `tips-b2b.json` → `node scripts/check-tips.mjs` →
  `node scripts/merge-tips.mjs`.
- **Phải sửa script trước:** cả `check-tips.mjs` và `merge-tips.mjs` đang ghi cứng `["a1", "a2", "b1"]`. Cần thêm `"b2"`, `"c1"`,
  hoặc tự đọc danh sách file trong `src/data/patterns/`.

### B3. Shadowing C1 — S

- Tạo `scripts/shadowing-c1.tsv` (khoảng 40 video, chọn giống `shadowing-b2.tsv`), rồi thêm lệnh
  `--batch scripts/shadowing-c1.tsv --level C1` vào script `shadowing:build`.
- Chọn video có đoạn hội thoại ngắn. Tránh các video "luyện nghe 1 giờ" như vài dòng trong danh sách B2.

### B4. Mẫu câu và mẹo C1 — L, làm sau

Làm giống B1 + B2 cho C1. **Chỉ bắt đầu khi báo cáo A3 cho thấy có người đã học xong chặng B2.** Nếu chưa ai tới B2 thì C1
chưa cần.

---

## Thứ tự đề xuất

| # | Việc | Ước lượng | Lý do |
|---|---|---|---|
| 1 | A1 Nút góp ý + báo Telegram | 1 ngày | Rẻ, và là kênh duy nhất để người học tự nói với bạn |
| 2 | A2 Sự kiện cho tính năng mới | 0,5 ngày | Không có nó thì không biết shadowing / hội thoại AI có ai dùng |
| 3 | B3 Shadowing C1 | 0,5 ngày | Pipeline đã có sẵn, chỉ cần danh sách video |
| 4 | A3 Báo cáo | 0,5 ngày | Cho biết số người ở B2+ để quyết định B1/B2/B4 |
| 5 | B1 + B2 Mẫu câu và mẹo B2 | 3–5 ngày | Lỗ hổng lớn nhất cho người học trình độ cao |
| 6 | A4 Hỏi nhanh sau bài | 0,5 ngày | Biết tính năng nào có ích, không chỉ có ai dùng |
| 7 | B4 C1 | 3–5 ngày | Chỉ làm khi số liệu cho thấy cần |

Lý do để phần A lên trước: chỉ tốn khoảng 2 ngày, và nó cho biết có bao nhiêu người thực sự ở B2 trở lên. Từ đó mới quyết định
nên dành 3–5 ngày soạn nội dung B2 ngay bây giờ hay để sau.
