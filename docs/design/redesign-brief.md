# MyEnglish: danh sách tính năng và prompt thiết kế lại giao diện

Tài liệu gồm 2 phần:

- **Phần 1:** danh sách đầy đủ tính năng hiện có, đọc từ code ngày 2026-10-29.
- **Phần 2:** 16 prompt ngắn cho Google Stitch, mỗi lần hỏi dán một prompt. Prompt viết bằng tiếng Anh vì Stitch hiểu tiếng Anh tốt hơn. Chữ hiển thị trong app vẫn giữ tiếng Việt.

---

## Phần 1. Tính năng hiện có

### Khung chung
- **Thanh bên (máy tính):**
  - Logo và số phiên bản. Nhấn vào số phiên bản để kiểm tra, tải bản mới và khởi động lại.
  - 14 mục điều hướng.
  - "Truy cập nhanh": Từ hay quên, Xếp hạng.
  - Ô thống kê: chuỗi ngày 🔥, số lần đóng băng chuỗi 🧊, mục tiêu "x/y câu", cấp độ, hạng tuần.
  - Nút tài khoản (có chấm báo đồng bộ).
  - Nút giao diện sáng / tối / theo máy.
- **Chế độ đơn giản:** thanh bên gom lại thành 8 nhóm, mỗi nhóm có dải tab con trên đầu trang.
- **Điện thoại:**
  - Thanh dưới có 5 nút: Hôm nay, Từ vựng, Ngữ pháp, Hội thoại, Thêm. Nút "Thêm" mở menu kéo ra.
  - Thanh dưới tự ẩn khi bàn phím hiện.
- **Thanh đầu trang:**
  - Chip chuỗi ngày và mục tiêu.
  - Chip "Hoãn nhắc đến HH:MM".
  - Nút chính "Ôn tập ngay [n]" / "Tiếp tục ôn" / "Tập trung".
  - Nút "Từ Oxford" khi đang ở trang Từ đã học.
  - Android: banner xin quyền "Xuất hiện trên cùng".
- **Thanh tiến trình trong ngày:** "Hôm nay · i/n", "Xong, tiếp: …", nút dừng.
- **Cửa sổ nổi:**
  - Thông báo nhỏ.
  - Hộp xác nhận thoát giữa chừng, hộp xác nhận xóa từ.
  - Bảng chi tiết từ trượt từ cạnh.
  - Chúc mừng lên cấp và mở khóa danh hiệu.
  - Thử thách phản xạ.
  - Chúc mừng khi một từ "vào trí nhớ dài hạn".
- **Chế độ tập trung:** ẩn hết, chỉ còn thẻ học.
- **Phím tắt:**
  - `/` tìm từ, `j/k` chuyển từ, `r` ôn từ đến hạn, `f` vào tập trung.
  - Khi ôn thẻ: `1–4` chấm điểm, `Space` lật thẻ.

### 1. Hôm nay (màn hình chính)
- Lời chào, ngày, 3 ô số liệu: chuỗi ngày, số từ Nhớ lâu / Đang học, % hiểu tài liệu IT.
- Danh sách việc hôm nay:
  - Các việc: lộ trình nói, ôn từ và học từ mới, 1 bài ngữ pháp, phát âm, luyện phản xạ.
  - Hiện "x/y việc · còn ~n phút".
  - Nút "Bắt đầu hôm nay", "Tập trung 10′", "Chỉ 1 phút".
  - Buổi tối nếu chưa học thì có cảnh báo sắp mất chuỗi ngày.
- Thẻ kết thúc ngày: chuỗi ngày, lượng bài ngày mai, gợi ý học thêm, link Góp ý.
- Kế hoạch quay lại cho người nghỉ học lâu: chia phần bài tồn theo ngày.
- Thẻ bắt đầu tập trung (chọn số phút).
- Banner có bản cập nhật (Android).
- Thanh "Cấp của bạn" kèm nút Đổi cấp.
- Thẻ lộ trình nói.
- Nhiệm vụ hôm nay: 3 nhiệm vụ, xong cả 3 thì mở rương thưởng (XP, có khi được thêm lượt đóng băng chuỗi).
- Bảng đua tuần (toàn bộ / nhóm).
- Banner luyện phản xạ.
- Thẻ lộ trình từ vựng Oxford: tiến độ từng cấp, ngày dự kiến xong.
- Thẻ "Tuần trước của bạn".

### 2. Ôn tập (học và ôn từ vựng theo lịch)
- **Màn bắt đầu:**
  - Số thẻ cần ôn và số từ mới hôm nay.
  - Nút Bắt đầu học, Tập trung n phút, Luyện tất cả.
  - Ôn hoặc luyện theo từng cấp.
  - Danh sách từ đang chờ ôn.
  - Biểu đồ lượng bài 7 ngày tới, có cảnh báo khi quá tải.
- **Trong phiên học:**
  - Chọn kiểu bài: Thích ứng, Thẻ lật, Trắc nghiệm, Nối từ, Điền từ, Luyện gõ, Ghép câu, Luyện nghe.
  - Có tổng cộng 11 dạng bài:
    - Thẻ lật
    - Trắc nghiệm
    - Điền từ vào câu
    - Gõ lại từ
    - Nghe và chọn nghĩa
    - Nối từ với câu
    - Nối từ với nghĩa
    - Chọn từ cho câu
    - Xếp câu
    - Tự viết câu (AI chấm)
    - Xếp chữ cái
  - Thẻ giới thiệu từ mới có nút "Đã biết từ này".
  - "Đoán nghĩa trước khi học" (có thể tắt).
  - Đọc to từ bằng micro, có nút "Tôi không nói to được lúc này".
  - Mẹo ghi nhớ (AI), cảnh báo từ dễ nhầm.
  - Chấm điểm Quên / Khó / Nhớ / Dễ, mỗi nút ghi rõ lần ôn kế tiếp.
  - Đồng hồ đếm ngược của phiên tập trung.
- **Tổng kết:** số từ nhớ / mới / quay lại, XP, cấp. Nút "Ôn lỗi sai" và "Thêm 5 phút".

### 3. Từ đã học (thư viện từ)
- Tìm kiếm, xem dạng lưới hoặc bảng.
- Lọc theo cấp và theo lịch ôn (đến hạn, hôm nay, 1–3 ngày…), có phân trang.
- **Bảng chi tiết từ:**
  - Số liệu nhớ, độ chính xác, số lần quên.
  - Các mục: nghĩa, ví dụ (có phân tích câu), từ liên quan, mẹo nhớ, lịch ôn và lịch sử ôn.
  - Đọc thường / đọc chậm, tạm ngưng ôn, xóa từ.

### 4. Đã biết
- Kiểm tra lại các từ người học tự đánh dấu là đã biết.
- Thống kê: Chờ kiểm tra / Đã xác nhận / Kiểm tra sai.
- Lọc, sắp xếp, kiểm tra từng từ.

### 5. Từ hay quên
- Số từ đang hay quên, số câu sai trong 7 ngày, số từ đã nhớ lại.
- Ôn riêng nhóm từ này hoặc vào tập trung.
- Mỗi từ hiện số lần sai, khả năng nhớ, dạng bài yếu, mẹo nhớ.
- Cài đặt "từ khó": sai bao nhiêu lần thì đánh dấu, học lại hoặc tạm ngưng.

### 6. Lộ trình từ vựng (bộ Oxford 5000)
- Chọn cấp đang học từ A1 đến C1, kèm tiến độ và ngày dự kiến xong.
- Đánh dấu đã biết cả cấp.
- Lướt nhanh và đánh dấu những từ đã biết.
- Tìm một từ để học sớm.

### 7. Ngữ pháp
- **Việc hôm nay:** học bài mới / học lại / ôn bài đến hạn / luyện theo thì.
- "Ngữ pháp cho nói" theo cấp.
- **Chọn lộ trình:** theo bài, hoặc theo thì.
- **Mỗi bài có 3 phần:**
  - Sổ tay (lý thuyết).
  - Bài tập: gõ đáp án, chọn đáp án, chọn câu đúng, xếp câu, dịch, chạm vào chỗ sai, tự chấm.
  - Kiểm tra nhanh (8 câu).
- **Khi làm bài:** gợi ý, đổi sang dạng dễ hơn, xem đáp án, ẩn câu lỗi, "Mình thấy đúng".
- **Kết quả:** điểm, ngày ôn lại, những câu cần xem lại.
- Lần đầu vào sẽ chọn thì muốn học.

### 8. Mẫu câu (Lộ trình nói)
- Chọn mục tiêu: Du lịch / Đi làm / Đời sống / Kết bạn.
- 5 cấp A1 đến C1, mỗi cấp 24 chặng, mỗi chặng 4 mẫu câu.
- Mỗi mẫu học qua 4 bước, cách nhau một ngày: Học mẫu câu, Thay chỗ trống, Ghép câu, Hỏi đáp nhanh.
- Dịch câu: 10 câu có tính giờ, dùng gợi ý thì bị trừ điểm.
- Hỏi đáp nhanh: trả lời bằng giọng nói hoặc gõ.
- Làm bài kiểm tra để bỏ qua chặng.
- Mỗi chặng có mẹo ngữ pháp "Vì sao nói vậy?".
- Từ trong chặng được thêm vào kho từ vựng.

### 9. Hội thoại (trò chuyện theo tình huống)
- Gợi ý tình huống, ôn lại các câu trong ngày.
- Lọc theo cấp A1 đến C2 và theo nhóm Đời thường / Công việc.
- Mỗi tình huống có trạng thái Mới / Đang học / Đã nói được, kèm số sao.
- "Học câu trước": nghe, nghe chậm, nói theo, nghe lại giọng mình.
- **Khi trò chuyện:**
  - Cách trả lời: chọn câu, ghép từ, nói hoặc gõ.
  - Tùy chọn: chỉ nghe, đổi vai, thử thách, nói chậm, hỏi lại bất ngờ, giọng ngẫu nhiên, rảnh tay.
- Tổng kết: % đúng ngay lần đầu, các câu cần luyện.
- Tạo hội thoại mới bằng AI (cần khóa Gemini).

### 10. Phát âm
- Bảng 44 âm IPA, hoặc học theo chủ đề.
- Mỗi bài có 3 bước: Nghe mẫu, Đọc to, Bài nghe. Có ngưỡng điểm qua bài.
- Luyện phân biệt các cặp âm dễ nhầm.
- Kiểm tra micro trước khi luyện.

### 11. Shadowing (luyện nói theo video YouTube)
- Danh sách video theo cấp.
- Chế độ: phụ đề, shadowing (thu âm, chấm từng từ), chính tả, điền từ.
- Chạm vào câu để nhảy tới đoạn đó.
- Lặp câu, chỉnh tốc độ, hiện IPA và nghĩa tiếng Việt, tự cuộn theo, chỉnh cỡ chữ.

### 12. Đọc
- Dán một đoạn văn, app tô màu từ theo trạng thái: đã thuộc / đang học / mới thêm / từ lạ.
- Chạm vào từ để xem nghĩa và lưu từ.
- Lưu một câu làm ví dụ cho từ.

### 13. Viết & sổ lỗi
- Viết "Standup hôm nay", rồi bấm "Nhờ AI sửa" (giới hạn số lượt mỗi ngày).
- Kết quả: danh sách lỗi đã sửa, điểm trên 100.
- Sổ lỗi: gõ lại câu đúng để luyện, có gợi ý loại lỗi.

### 14. Tiến độ
Gồm 5 tab:
- **Tổng quan:** tỷ lệ nhớ, số từ Nhớ lâu, chuỗi ngày, lịch học dạng ô màu theo ngày.
- **Từ vựng:** đánh giá trình độ (điểm trên 100), bài kiểm tra trình độ, độ chính xác 14 ngày, số từ nhớ lâu theo cấp.
- **Thói quen.**
- **Lịch ôn:** lượng bài ngày mai và 7 ngày tới, hiệu quả ghi nhớ trong 30 ngày.
- **Thành tựu:** huy hiệu và danh hiệu.

### 15. Xếp hạng
- Bảng Tuần này / Tổng / Chuỗi ngày, xem toàn bộ hoặc theo nhóm.
- Tạo nhóm, vào nhóm bằng mã mời, rời nhóm.

### 16. Tài khoản
- Đăng nhập, tạo tài khoản, quên mật khẩu, đổi tên, chọn ảnh đại diện.
- Đồng bộ giữa các máy: trạng thái, nút "Đồng bộ ngay", xử lý khi dữ liệu hai máy khác nhau.
- Bật / tắt hiện cuộc đua XP.

### 17. Cài đặt
1. **Học mỗi ngày:**
   - Mục tiêu mỗi ngày, độ dài phiên tập trung.
   - Số từ mới mỗi ngày, số thẻ tối đa mỗi phiên.
   - Bật / tắt "Đoán nghĩa trước khi học".
2. **Nhắc học:**
   - Bật / tắt, nhắc mỗi bao lâu, giờ học cố định (chọn giờ).
   - Không nhắc ban đêm, xong mục tiêu thì thôi nhắc, giới hạn số lần nhắc mỗi ngày.
   - Riêng máy tính: khởi động cùng máy, cửa sổ nhắc nổi, hoãn nhắc, không làm phiền khi đang bận.
3. **Giao diện:** cỡ chữ, chế độ đơn giản, chế độ mất gốc, âm thanh phản hồi, giọng đọc và tốc độ đọc.
4. **AI (không bắt buộc):** khóa Gemini.
5. **Lịch ôn thông minh (nâng cao):** tỷ lệ nhớ mong muốn, tối ưu theo trí nhớ của người học, khoảng ôn tối đa.
6. **Dữ liệu:** sao lưu, xuất danh sách từ, khôi phục, đặt lại dữ liệu.
7. **Góp ý cho app.**

### Bắt đầu lần đầu (4 bước)
1. Chọn trình độ, hoặc làm bài kiểm tra nhanh 2–4 phút.
2. Chọn cấp từ vựng.
3. Chọn thì ngữ pháp muốn bắt đầu.
4. Chọn thời gian học mỗi ngày và giờ nhắc, rồi "Học n từ đầu tiên ngay".

### Phần thưởng và thi đua
- Chuỗi ngày, lượt đóng băng chuỗi.
- XP, cấp, danh hiệu, thành tựu.
- Nhiệm vụ ngày có rương thưởng, thử thách tuần.
- Bảng xếp hạng tuần và theo nhóm.
- Thử thách phản xạ 3 chặng.
- Mốc "Nhớ lâu" 100 / 250 / 500 / 1000 từ.

### Khác nhau giữa máy tính và điện thoại
- **Nhắc học:**
  - Máy tính: cửa sổ nhắc nổi ở góc màn hình, hoặc bài kiểm tra nhanh toàn màn hình.
  - Android: thông báo hệ thống, thêm quiz nổi trên màn hình.
- **Chấm giọng nói:** chỉ có trên Android.
- **Cập nhật:** máy tính qua số phiên bản ở thanh bên, Android qua banner ở màn Hôm nay.

### Đang ẩn hoặc chưa xong
- **Thêm từ bằng AI và các tính năng AI cho từ vựng:** đang tắt. Code vẫn còn.
- **Công cụ nhập bài tập ngữ pháp:** chỉ hiện ở bản dành cho người phát triển.
- **Chữ hiển thị chưa thống nhất:** vẫn còn từ tiếng Anh hoặc từ kỹ thuật (Leech, FSRS, Level…).

---

## Phần 2. Prompt cho Google Stitch, mỗi lần hỏi một prompt

### Cách dùng
1. **Tạo dự án:** vào stitch.withgoogle.com, tạo một dự án mới, chọn chế độ **Mobile**. Làm tất cả trong **cùng một dự án** để Stitch nhìn thấy các màn đã có.
2. **Dán lần lượt:** mỗi lần dán **một** khung prompt bên dưới, theo thứ tự từ 1 đến 15. Đợi ra kết quả rồi mới dán prompt tiếp theo.
3. **Không cần dán thêm gì:** khung phong cách (STYLE) đã nằm sẵn trong mỗi prompt.
4. **Prompt 1 là quan trọng nhất,** vì nó quyết định phong cách cho cả app:
   - Tạo lại 2–3 lần, chọn bản ưng nhất.
   - Bạn đổi màu hay font thì sửa luôn khung STYLE trong **tất cả** các prompt sau cho giống.
5. **Nếu một màn bị lệch phong cách:** gõ thêm "Match the style of the Hôm nay screen exactly", rồi tạo lại.
6. **Soát chữ tiếng Việt:** xem có sai dấu hay bị đổi câu không. Muốn sửa nhỏ thì gõ thẳng, ví dụ: "Đổi nút thành 'Bắt đầu hôm nay'".
7. **Xuất code:** ưng màn nào thì bấm xuất code (HTML/Tailwind) hoặc chụp ảnh, rồi gửi mình để chuyển vào app.

Thứ tự các prompt:

| # | Màn |
|---|---|
| 1 | Hôm nay (trạng thái chính) |
| 2 | Hôm nay: các trạng thái khác |
| 3 | Ôn tập: màn bắt đầu và thẻ lật |
| 4 | Ôn tập: các dạng bài |
| 5 | Tổng kết phiên, Kho từ, chi tiết từ |
| 6 | Từ hay quên, Đã biết, Lộ trình từ vựng |
| 7 | Mẫu câu (lộ trình nói) |
| 8 | Hội thoại |
| 9 | Phát âm và Shadowing |
| 10 | Ngữ pháp |
| 11 | Đọc và Viết |
| 12 | Tôi: Tiến độ và Xếp hạng |
| 13 | Tài khoản, Cài đặt, Góp ý |
| 14 | Bắt đầu lần đầu (4 bước) |
| 15 | Nhắc học, chúc mừng, màn trống |
| 16 | Bản máy tính (đổi sang chế độ Web) |

---

### Prompt 1: Hôm nay (trạng thái chính)

```text
Design the home screen of "MyEnglish", an English-learning app for Vietnamese office workers.
This first screen sets the visual style for the whole app.

STYLE (keep identical on every screen of this project):
- Users: Vietnamese office workers aged 22-45, basic English, busy, not tech-savvy. Study 5-15 min a day on the phone.
- Calm, professional, trustworthy, fine to open at the office. Not childish, no mascot, gamification subtle.
- Primary color teal #0F766E, success green #16A34A, warning amber #D97706, error red #DC2626,
  background #F7F8FA, cards white, text #0F172A, secondary text #64748B.
- Font: Be Vietnam Pro. Body 16px, line height 1.5. Rounded corners 16px, soft shadows, generous spacing.
- Lucide-style line icons. Tap targets at least 48px. WCAG AA contrast.
- All UI text in Vietnamese, exactly as written in quotes. English only for learning content.
- One obvious primary action per screen, everything else secondary.
- Bottom tab bar with 5 items: "Hôm nay", "Từ vựng", "Luyện nói", "Ngữ pháp", "Tôi".
- Top bar: screen title, streak chip "🔥 12 ngày", round avatar.

SCREEN: "Hôm nay" (active tab: Hôm nay)
- Greeting "Chào Lan" and date "Thứ Tư, 29 tháng 10". Small ring "12/20 câu" for the daily goal.
- Hero card "Hôm nay của bạn" with a checklist, each row with an icon, a check circle and minutes:
  "Lộ trình nói · 3 phút" (done), "Ôn từ & từ mới · 4 phút" (done), "1 bài ngữ pháp · 3 phút",
  "Phát âm · 2 phút", "Luyện phản xạ · 1 phút". Under it "2/5 việc · còn ~6 phút".
- ONE big full-width primary button "Tiếp tục hôm nay". Under it two small text links:
  "Chỉ 1 phút" and "Tập trung 10 phút".
- Card "Cấp của bạn: A2" with a small "Đổi cấp" link.
- Collapsed row "Xem thêm: nhiệm vụ, xếp hạng tuần, lộ trình từ vựng" with a chevron.
```

### Prompt 2: Hôm nay, các trạng thái khác

```text
Create 3 more variants of the "Hôm nay" screen, same layout and style as the existing Hôm nay screen.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Xong cả ngày": a celebratory but calm card "Xong cả ngày 🎉", streak "🔥 13 ngày",
   "Ngày mai: 15 thẻ ôn · ~6 phút", button "Muốn học thêm?" (secondary), small link "Góp ý cho app".
2) Evening warning: amber banner "Sắp mất chuỗi 12 ngày, chỉ cần 1 phút" with button "Học 1 phút",
   checklist below with 0/5 done, primary button "Bắt đầu hôm nay".
3) "Xem thêm" expanded: under the hero card show
   - "Nhiệm vụ hôm nay": 3 quests with progress bars ("Ôn 20 thẻ 14/20", "Nói 5 câu 5/5",
     "Học 1 bài ngữ pháp 0/1") and a gift button "Mở rương phần thưởng" (disabled until all done).
   - "Cuộc đua tuần này": top 3 rows with avatars and XP, and "Bạn: hạng 8 · 420 XP".
   - "Lộ trình từ vựng Oxford": A1 92%, A2 40%, B1 5% bars, "Xong A2 khoảng 3 tháng nữa".
```

### Prompt 3: Ôn tập, màn bắt đầu và thẻ lật

```text
Design 3 screens for the "Từ vựng" tab, same style as the Hôm nay screen.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Ôn tập" start screen (active tab Từ vựng). Under the title, horizontal sub-tab chips:
   "Ôn tập" (selected) · "Kho từ" · "Từ hay quên" · "Đã biết" · "Lộ trình".
   Card "Hôm nay: 18 thẻ ôn · 5 từ mới · ~7 phút" with primary button "Bắt đầu học".
   Secondary buttons "Tập trung 10 phút" and "Luyện thêm (không tính lịch)".
   Small bar chart "7 ngày tới" (Mon-Sun, today highlighted).
   List "Theo cấp độ": rows A1, A2, B1 with counts and two small buttons "Ôn" / "Luyện".
2) Study session, flip card, FRONT side. Full screen, no tab bar. Top bar: close X, progress bar,
   "Thẻ 4/20", small chip "Đúng liền 3". Big card with the English word "deadline", IPA "/ˈdedlaɪn/",
   two audio buttons (normal, slow). Primary button at the bottom "Lật thẻ".
3) Same card, BACK side: word, IPA, meaning "hạn chót", example "The deadline is Friday." with
   "Hạn chót là thứ Sáu.", small "Mẹo ghi nhớ" expandable. Bottom grading row with 4 buttons,
   each with the next review time under it: "Quên · 10 phút" (red), "Khó · 1 ngày" (amber),
   "Nhớ · 3 ngày" (teal), "Dễ · 7 ngày" (green).
```

### Prompt 4: Ôn tập, các dạng bài

```text
Design 4 exercise screens of the study session, same full-screen session layout as the flip card
(top bar with X, progress "Thẻ 7/20", no tab bar).

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted. Correct = green,
wrong = red, both with an icon, not color alone.

1) Multiple choice: "Chọn nghĩa đúng của từ" + word "invoice" with audio, 4 large option cards
   ("hóa đơn" selected and correct in green, others neutral), button "Tiếp tục".
2) Fill in the sentence: "Điền từ còn thiếu" + "Please send me the ___ by Monday." with a text input,
   hint link "Gợi ý", primary button "Kiểm tra".
3) Order words: "Xếp thành câu đúng" + Vietnamese "Tôi sẽ gửi báo cáo vào ngày mai." + word tiles
   "I'll", "send", "the", "report", "tomorrow" to tap into an answer line, button "Kiểm tra".
4) Say aloud: word "schedule" with IPA, big round mic button "Chạm để nói", buttons "Đọc được" /
   "Chưa chắc", small text link "Tôi không nói to được lúc này".
```

### Prompt 5: Tổng kết phiên, Kho từ, chi tiết từ

```text
Design 3 screens, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) Session summary (full screen, no tab bar): "Xong phiên học! 🎉", 3 stat tiles "Nhớ 16",
   "Từ mới 5", "Cần ôn lại 4", a line "3 từ đã vào trí nhớ dài hạn" with the words as chips,
   "+120 XP". Buttons: primary "Hoàn tất", secondary "Ôn lỗi sai" and "Thêm 5 phút".
2) "Kho từ" (active tab Từ vựng, sub-tab chip "Kho từ" selected): search field "Tìm từ…",
   level chips A1 A2 B1 B2 C1, time chips "Đến hạn", "Hôm nay", "1–3 ngày", "4–7 ngày", "Chưa học".
   List rows: word, meaning, small memory bar, next review "Ôn sau 2 ngày", speaker icon.
3) Word detail as a bottom sheet over Kho từ: "negotiate" /nɪˈɡoʊʃieɪt/, meaning "đàm phán",
   2 examples with Vietnamese, "Từ liên quan" chips, "Mẹo ghi nhớ", memory card "Nhớ lúc này 82%",
   "Ôn tiếp: 3 ngày nữa", link "Lịch sử ôn", buttons "Tạm ngưng ôn" and "Xoá từ" (red text).
```

### Prompt 6: Từ hay quên, Đã biết, Lộ trình từ vựng

```text
Design 3 screens of the "Từ vựng" tab, same style and same sub-tab chips as the Ôn tập screen.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Từ hay quên": 3 tiles "Đang hay quên 12", "Câu sai 7 ngày qua 18 ↓", "Đã nhớ lại 30".
   Primary button "Ôn 12 từ hay quên". List rows: word, "sai 4 lần", recall bar, link "Mẹo nhớ".
2) "Đã biết": short explanation "Những từ bạn đánh dấu đã biết, kiểm tra nhanh để chắc chắn".
   Tiles "Chờ kiểm tra 24", "Đã xác nhận 180", "Kiểm tra sai 6". Primary "Kiểm tra ngay 10 từ".
3) "Lộ trình" (Oxford 5000): cards per level A1, A2, B1, B2, C1, each with progress bar,
   "512/900 từ", "Xong khoảng tháng 3", toggle "Đang học". Link "Đã biết cả cấp".
   Section "Tìm từ và học sớm" with a search field.
```

### Prompt 7: Mẫu câu (lộ trình nói)

```text
Design 3 screens of the "Luyện nói" tab, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Mẫu câu" path (active tab Luyện nói). Sub-tab chips: "Mẫu câu" (selected) · "Hội thoại" ·
   "Phát âm" · "Shadowing". Goal chips "Du lịch", "Đi làm" (selected), "Đời sống", "Kết bạn".
   Level selector A1 A2 B1 B2 C1. A vertical path of stage cards: done stages with a check,
   the current stage highlighted "Chặng 5: Hẹn lịch họp · 2/4 mẫu", locked stages greyed.
   Primary button "Bắt đầu hôm nay (~5 phút)".
2) Stage page "Hẹn lịch họp": 4 pattern cards, each showing the frame with the blank highlighted,
   e.g. "Are you free on ___?" with "Bạn có rảnh vào ___ không?", and a 4-step ladder of dots:
   "Học mẫu câu" → "Thay chỗ trống" → "Ghép câu" → "Hỏi đáp nhanh" (some steps done,
   next one says "Mở vào ngày mai"). Link "Làm bài kiểm tra để bỏ qua chặng".
3) Pattern learning screen (full screen): frame "I'd like to ___." big, blank highlighted,
   Vietnamese "Tôi muốn ___.", IPA, audio buttons, one-line note, list of 6 example fillers to tap
   ("book a meeting room", "reschedule our call"...), link "Vì sao nói vậy?" opening a grammar tip.
```

### Prompt 8: Hội thoại

```text
Design 3 screens of "Hội thoại" (role-play conversations), same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) List (sub-tab chip "Hội thoại" selected): suggested card "Gợi ý hôm nay: Gọi món ở nhà hàng".
   Filters: level A1…C1 and "Đời thường" / "Công việc". Situation cards with title, short
   description, status badge "Mới" / "Đang học" / "Đã nói được", 0-3 stars, buttons
   "Học câu trước" and "Nói thử".
2) Conversation screen (full screen): chat layout, partner bubbles on the left with a speaker
   icon, the learner's answers on the right. Bottom answer area: big round mic button
   "Chạm để nói", and small toggles "Chọn câu" · "Ghép từ" · "Gõ". Link "Xem gợi ý".
   Top right "⋯" opens options.
3) End summary: "Bạn đã nói xong!", "Đúng ngay lần đầu 80%", 3 stars, list "Câu nên luyện thêm"
   with replay buttons, primary "Nói lại", secondary "Về danh sách".
```

### Prompt 9: Phát âm và Shadowing

```text
Design 3 screens of the "Luyện nói" tab, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Phát âm" (sub-tab chip selected): toggle "Bảng 44 âm" / "Bài theo chủ đề". Next lesson card
   "Bài tiếp: âm /θ/ và /s/" with "Bắt đầu luyện". Card "Cặp âm dễ nhầm" with
   "Luyện phân biệt ngay". Grid of IPA sound tiles (vowels, consonants), learned ones marked.
2) "Shadowing" list: level chips, video cards with thumbnail, title, duration, level badge.
3) Shadowing player (full screen): video on top, mode tabs "Phụ đề" · "Shadowing" · "Chính tả" ·
   "Điền từ". Scrolling transcript, current line highlighted, tap a line to jump. Under the
   current line: Vietnamese meaning. Bottom controls: loop, speed "0.75x", record button,
   score per word colored after recording.
```

### Prompt 10: Ngữ pháp

```text
Design 3 screens of the "Ngữ pháp" tab, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) Grammar home (active tab Ngữ pháp). Sub-tab chips "Ngữ pháp" (selected) · "Đọc" · "Viết".
   Card "Tiếp theo: Thì hiện tại hoàn thành" with primary "Học bài mới" and secondary
   "Ôn lại 3 bài đến hạn". Progress "12/60 bài". List of chapters with lessons and status.
   Link "Luyện theo thì".
2) Lesson screen: title, tabs "Sổ tay" · "Bài tập" · "Kiểm tra nhanh". Sổ tay content with a
   formula card where sentence parts are colored (subject, verb, object), short Vietnamese
   explanations, examples with translations.
3) Exercise: "Câu 3/8", "Chọn đáp án đúng", sentence "She ___ here since 2020." with 4 options,
   helper links "Gợi ý", "Dạng dễ hơn", "Xem đáp án", primary "Kiểm tra". Show a wrong answer
   state with a short Vietnamese explanation.
```

### Prompt 11: Đọc và Viết

```text
Design 2 screens under the "Ngữ pháp" tab (sub-tab chips "Đọc" and "Viết"), same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Đọc": an English email pasted as text, words underlined in colors with a legend
   "Đã thuộc" (green), "Đang học" (teal), "Mới thêm" (amber), "Từ lạ" (grey dotted).
   A bottom sheet for the tapped word: meaning, IPA, audio, primary "Lưu từ".
2) "Viết": card "Standup hôm nay" with a text area and placeholder "Hôm qua tôi đã…, hôm nay tôi
   sẽ…", chips of words being learned to use, primary "Nhờ AI sửa" and "Còn 2 lượt hôm nay".
   Result card: "Điểm 78/100", a list of corrections (wrong in red strikethrough, right in green,
   short Vietnamese reason). Section "Sổ lỗi của bạn" with "Luyện lại 5 câu".
```

### Prompt 12: Tôi, Tiến độ và Xếp hạng

```text
Design 2 screens of the "Tôi" tab, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Tiến độ" (active tab Tôi; sub-tab chips "Tiến độ" (selected) · "Xếp hạng" · "Tài khoản" ·
   "Cài đặt"). Inner segmented control "Tổng quan" · "Từ vựng" · "Thói quen" · "Lịch ôn" ·
   "Thành tựu". Tổng quan shows: "Tỷ lệ nhớ 86%", "Nhớ lâu 340 từ", "Chuỗi 12 ngày", a calendar
   heatmap "Lịch sử học mỗi ngày" (last 3 months), and a card "Trình độ ước tính: A2 · 64/100"
   with link "Kiểm tra trình độ".
2) "Xếp hạng": segmented "Tuần này" · "Tổng" · "Chuỗi ngày", toggle "Mọi người" / "Nhóm của tôi".
   Top 3 podium (subtle, not cartoonish), then ranked list with avatar, name, XP; the user's own
   row pinned at the bottom. Buttons "Tạo nhóm mới" and "Vào nhóm bằng mã".
```

### Prompt 13: Tài khoản, Cài đặt, Góp ý

```text
Design 3 screens of the "Tôi" tab, same style and sub-tab chips as the Tiến độ screen.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted, bottom tab bar
"Hôm nay" · "Từ vựng" · "Luyện nói" · "Ngữ pháp" · "Tôi".

1) "Tài khoản": avatar, name "Nguyễn Lan", email, sync card "Đã đồng bộ lúc 08:42" with a green
   dot and "Đồng bộ ngay", toggle "Hiện cuộc đua xếp hạng", button "Đăng xuất".
2) "Cài đặt": grouped settings list, simple first:
   "Học mỗi ngày" (Mục tiêu mỗi ngày 20 câu, Từ mới mỗi ngày 5),
   "Nhắc học" (toggle on, "Nhắc mỗi 60 phút", study-time chips "07:30", "12:30", "20:00" with
   "+ Giờ khác", toggles "Không nhắc ban đêm", "Xong mục tiêu thì thôi nhắc"),
   "Giao diện & âm thanh" (Giao diện Sáng/Tối/Theo máy, Cỡ chữ Vừa/Lớn/Rất lớn, Giọng đọc),
   collapsed rows "AI (không bắt buộc)", "Nâng cao", "Dữ liệu & sao lưu", and "Góp ý cho app".
3) "Góp ý cho app" bottom sheet: chips "Lỗi" · "Nội dung" · "Ý tưởng" · "Khác", text area
   "Bạn muốn nói gì với người làm app?", optional field "Cách liên hệ (không bắt buộc)",
   primary "Gửi". Also show the sent state "Đã gửi, cảm ơn bạn!".
```

### Prompt 14: Bắt đầu lần đầu (4 bước)

```text
Design the 4-step first-run flow, same style as the project. No tab bar. Progress "Bước n/4"
at the top, back arrow, one question per screen, primary button fixed at the bottom.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted.

1) "Tiếng Anh của bạn đang ở mức nào?": selectable cards "A0 · Mất gốc", "A1 · Biết vài câu chào",
   "A2 · Nói được câu đơn giản", "B1 · Giao tiếp cơ bản", "B2 · Làm việc được", "C1 · Thành thạo",
   plus an outlined card "Không chắc? Kiểm tra nhanh (2–4 phút)". Button "Tiếp tục".
2) "Bạn muốn học từ vựng cấp nào?": level cards with word counts, recommended one tagged "Gợi ý".
3) "Chọn thì bạn muốn bắt đầu học": list of tenses with short Vietnamese descriptions,
   "Hiện tại đơn" preselected.
4) "Mỗi ngày bạn học bao lâu, vào lúc nào?": chips "5 phút", "10 phút" (selected), "15 phút",
   "20 phút"; study-time chips "07:30 Sáng sớm", "12:30 Nghỉ trưa" (selected),
   "17:30 Cuối giờ làm", "20:00 Buổi tối", "21:30 Trước khi ngủ", "+ Giờ khác";
   toggle "Nhắc tôi học mỗi ngày". Primary "Học 5 từ đầu tiên ngay".
```

### Prompt 15: Nhắc học, chúc mừng, màn trống

```text
Design these small screens and overlays, same style as the project.

STYLE (same as the project): teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA,
16px corners, calm and professional, Vietnamese UI text exactly as quoted.

1) Android notification mockup on a lock screen: "MyEnglish · Đến giờ học bạn đã hẹn ⏰ · 18 thẻ đang chờ, ~5 phút".
2) Floating quick-quiz card over another app: "Câu hỏi nhanh", word "deadline", 3 options,
   buttons "Học ngay" and "Để sau".
3) Celebration overlay: "Lên cấp 8!" with a subtle confetti, new title badge, button "Tuyệt".
4) Empty state on Ôn tập: simple illustration, "Không có thẻ nào cần ôn lúc này",
   "Quay lại lúc 14:00 hoặc học thêm từ mới", button "Học từ mới".
5) Confirm dialog: "Thoát phiên học?", "Bạn đã làm 7/20 thẻ, phần đã làm vẫn được lưu.",
   buttons "Học tiếp" (primary) and "Thoát".
```

### Prompt 16: Bản máy tính

Tạo một dự án mới ở chế độ **Web**, hoặc đổi sang Web nếu Stitch cho phép đổi. Dán prompt này. Sau đó có thể xin tiếp từng màn khác theo cách tương tự.

```text
Design the desktop version (1440x900) of "MyEnglish" for Windows/macOS, same visual style as the
mobile screens: teal #0F766E primary, Be Vietnam Pro 16px, white cards on #F7F8FA, 16px corners,
calm and professional, Vietnamese UI text exactly as quoted.

Layout: left sidebar 240px with logo "MyEnglish", 5 items "Hôm nay", "Từ vựng", "Luyện nói",
"Ngữ pháp", "Tôi", and at the bottom a small streak/goal card ("🔥 12 ngày", "12/20 câu") and the
user's avatar. Content area max width 960px, centered.

1) "Hôm nay": the hero checklist card on the left (wide) with primary "Tiếp tục hôm nay",
   and a right column with "Nhiệm vụ hôm nay", "Cuộc đua tuần này", "Lộ trình từ vựng Oxford".
2) Study session flip card, distraction-free: sidebar hidden, card centered (max 640px),
   keyboard hints under the grading buttons: "1 Quên", "2 Khó", "3 Nhớ", "4 Dễ", "Space: lật thẻ".
3) "Kho từ": table view (word, meaning, level, memory, next review) with a side panel on the right
   showing the selected word's detail.
```
