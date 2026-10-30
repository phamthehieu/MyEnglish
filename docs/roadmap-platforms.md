# MyEnglish trên mọi nền tảng: checklist

Cập nhật: 30/10/2026, sau bản 0.4.0. Đánh dấu `[x]` khi xong.

Ký hiệu: **[Bắt buộc]** không có thì không phát hành được hoặc bị cửa hàng từ chối · **[Nên]** đáng làm sớm · **[Thêm]** làm khi có thời gian.

## Hiện trạng

| Nền tảng | Tình trạng | Ghi chú |
|---|---|---|
| Android | ✅ Đang phát hành (APK trên GitHub, tự cập nhật trong app) | Chưa lên Google Play |
| Windows, macOS | ✅ Chạy được (Tauri) | Chưa ký số bộ cài, macOS chưa notarize |
| Web | ❌ Giao diện chạy được, **không lưu được dữ liệu** | `src/services/db.ts` dùng SQLite của Tauri, trình duyệt không có |
| iOS | ❌ Chưa có | Cần máy Mac và tài khoản Apple Developer |

Những phần chỉ chạy trên Android, các nền tảng khác phải có cách thay thế hoặc ẩn đi:

| Phần | Android dùng | Web | iOS |
|---|---|---|---|
| Giọng đọc | `AndroidTTS` (TtsBridge.kt) | `speechSynthesis` của trình duyệt | AVSpeechSynthesizer |
| Nhận dạng giọng nói | `AndroidASR`, Vosk offline | Vosk bản WASM (~40 MB) hoặc tự chấm | Vosk iOS hoặc Apple Speech (on-device) |
| Nhắc học | `AndroidReminders`, thẻ hỏi nhanh nổi | Web Push | Thông báo cục bộ, không có cửa sổ nổi |
| Cập nhật app | `AndroidUpdater` | Tự cập nhật khi tải lại trang | Chỉ qua App Store |
| Bàn phím | `--ime-height` từ MainActivity | `visualViewport` (đã có trong Sidebar) | Cần kiểm tra lại |

---

## Giai đoạn 0: Nền móng chung (làm trước mọi nền tảng mới)

- [ ] **[Bắt buộc]** Tách lớp lưu trữ: `db.ts` gọi qua một giao diện chung, có 2 bản: SQLite (Tauri) và bản cho trình duyệt (wa-sqlite + OPFS, hoặc sql.js lưu vào IndexedDB). Dùng chung lược đồ và các bước nâng cấp dữ liệu.
- [ ] **[Bắt buộc]** Tạo `src/services/platform.ts` gom các khả năng theo nền tảng (giọng đọc, nhận dạng giọng nói, nhắc học, cập nhật, bàn phím). Màn nào cần thì hỏi "có không", không gọi thẳng `window.AndroidXXX`.
- [ ] **[Bắt buộc]** Màn hình ẩn hoặc thay thế gọn những phần nền tảng không có (ví dụ: không có nhận dạng giọng nói thì cho tự chấm).
- [ ] **[Bắt buộc]** Kiểm tra đồng bộ Supabase khi một người dùng 2–3 thiết bị khác loại: đăng nhập trên máy mới thì kéo đủ dữ liệu, hai máy học cùng lúc không mất tiến độ.
- [ ] **[Nên]** Ghi lỗi từ máy người dùng về một chỗ (bảng Supabase hoặc Sentry), để biết app lỗi ở đâu mà không cần người dùng chụp màn hình.
- [ ] **[Nên]** CI (`.github/workflows/ci.yml`) chạy `tsc` và `vitest` cho mọi nền tảng, thêm test cho lớp lưu trữ bản web.
- [ ] **[Thêm]** Thống kê sử dụng tối thiểu, ẩn danh: bao nhiêu người học mỗi ngày, màn nào ít dùng.

## Giai đoạn 1: Bản web / PWA (iPhone và máy tính công ty dùng được ngay)

- [ ] **[Bắt buộc]** Lớp lưu trữ bản web (giai đoạn 0) chạy thật, dữ liệu còn sau khi tắt trình duyệt.
- [ ] **[Bắt buộc]** Biến app thành PWA: manifest, biểu tượng, service worker (vite-plugin-pwa), cài được lên màn hình chính iPhone và Android.
- [ ] **[Bắt buộc]** Chạy được không cần mạng: lưu sẵn mã app và dữ liệu bài học (~16 MB). Gói dữ liệu từng cấp độ chỉ tải khi cần.
- [ ] **[Bắt buộc]** Chọn nơi đặt web (Cloudflare Pages, Vercel hoặc GitHub Pages) và tên miền. Thêm địa chỉ web vào danh sách chuyển hướng đăng nhập của Supabase.
- [ ] **[Bắt buộc]** Sửa các điểm riêng của Safari trên iPhone: vùng tai thỏ (safe area), chiều cao màn hình (`100dvh`), bàn phím che ô nhập.
- [ ] **[Bắt buộc]** Giọng đọc bằng `speechSynthesis`, chọn được giọng tiếng Anh như bản Android.
- [ ] **[Nên]** Nhận dạng giọng nói trên web: thử Vosk WASM (nặng ~40 MB, chỉ tải khi mở bài nói). Không được thì dùng tự chấm.
- [ ] **[Nên]** Nhắc học bằng Web Push: Supabase Edge Function gửi theo giờ học đã đặt. Trên iPhone chỉ chạy khi đã cài lên màn hình chính (iOS 16.4 trở lên).
- [ ] **[Nên]** Thêm bước "đăng bản web" vào `scripts/release.mjs` để một lệnh phát hành cả Android lẫn web.
- [ ] **[Thêm]** Hướng dẫn cài lên màn hình chính cho người dùng iPhone, có hình minh họa từng bước.

## Giai đoạn 2: Android lên Google Play

- [ ] **[Bắt buộc]** Tài khoản Google Play Console (25 USD, trả một lần).
- [ ] **[Bắt buộc]** Build ra AAB (Play yêu cầu) bên cạnh APK hiện tại, dùng chung khóa ký.
- [ ] **[Bắt buộc]** Bản Play **tắt tự cập nhật trong app**, vì Play cấm app tự tải APK. Bản APK trên GitHub giữ nguyên cách cập nhật hiện tại.
- [ ] **[Bắt buộc]** Trang chính sách quyền riêng tư (chưa có), điền mục Data safety trên Play Console.
- [ ] **[Bắt buộc]** Chức năng **xóa tài khoản** ngay trong app và trên một trang web (chưa có; cả Google Play và App Store đều bắt buộc).
- [ ] **[Bắt buộc]** Xin quyền thông báo trên Android 13 trở lên. Giải thích rõ lý do khi xin quyền hiển thị trên ứng dụng khác (thẻ hỏi nhanh nổi).
- [ ] **[Nên]** Thử trên vài máy: Android 7 (minSdk 24), màn hình 320px, máy Xiaomi/Oppo (hay chặn chạy nền và chặn nhắc học).
- [ ] **[Nên]** Widget ngoài màn hình chính: số thẻ cần ôn hôm nay, bấm là vào ôn.
- [ ] **[Nên]** "Chia sẻ → MyEnglish": lưu từ hoặc câu từ Gmail, Slack, trình duyệt vào lịch ôn, kèm câu gốc.
- [ ] **[Thêm]** Chế độ nghe khi đi xe: ghép từ đang học thành bài nghe, phát được khi tắt màn hình.

## Giai đoạn 3: iOS app (nếu bản web chưa đủ)

Nên làm sau khi bản web chạy ổn: web đã phục vụ được phần lớn người dùng iPhone, còn iOS thật thì tốn tiền và công nhất.

- [ ] **[Bắt buộc]** Máy Mac có Xcode. Tài khoản Apple Developer (99 USD/năm, dùng chung cho cả notarize bản macOS).
- [ ] **[Bắt buộc]** `tauri ios init`, build và chạy được trên iPhone thật.
- [ ] **[Bắt buộc]** Viết lại các cầu nối Android bằng Swift: giọng đọc (AVSpeechSynthesizer), nhận dạng giọng nói (Vosk iOS hoặc Apple Speech chạy trên máy), nhắc học (thông báo cục bộ).
- [ ] **[Bắt buộc]** Bỏ tự cập nhật trong app (Apple cấm), cập nhật qua App Store.
- [ ] **[Bắt buộc]** Thay thẻ hỏi nhanh nổi (iOS không cho cửa sổ nổi) bằng thông báo có nút trả lời, hoặc widget.
- [ ] **[Bắt buộc]** Xóa tài khoản trong app, chính sách quyền riêng tư, nhãn quyền riêng tư trên App Store, ảnh chụp màn hình các cỡ iPhone.
- [ ] **[Bắt buộc]** Thử bàn phím, vùng tai thỏ, cỡ chữ hệ thống lớn trên iPhone.
- [ ] **[Nên]** Phát hành thử qua TestFlight cho vài người trước khi lên App Store.
- [ ] **[Thêm]** Widget iOS (WidgetKit).

## Giai đoạn 4: Máy tính (Windows, macOS)

- [ ] **[Nên]** Ký số bộ cài Windows, để Windows không cảnh báo "ứng dụng không rõ nguồn gốc" (cần mua chứng chỉ ký mã).
- [ ] **[Nên]** Notarize bản macOS (dùng tài khoản Apple Developer của giai đoạn 3).
- [ ] **[Nên]** Phím tắt toàn hệ thống: bôi đen chữ ở bất kỳ app nào, bấm phím tắt là lưu vào lịch ôn (tauri-plugin-global-shortcut).
- [ ] **[Nên]** Đưa bước build và đăng bản Windows/macOS vào `scripts/release.mjs`.

## Giai đoạn 5: Tính năng mới cho mọi nền tảng

- [ ] **[Nên]** Lưu từ khi đang làm việc: share sheet (Android), phím tắt (máy tính), tiện ích trình duyệt (web).
- [ ] **[Nên]** Luyện thi TOEIC: Part 5 (điền từ vào câu), Part 7 (đọc email, thông báo), bài thi thử có chấm điểm. Phần tốn công nhất là soạn đề.
- [ ] **[Nên]** Chấm đọc cả câu (hiện Vosk chỉ chấm từng từ): đọc to email mẫu, câu mở đầu cuộc họp.
- [ ] **[Thêm]** Nhóm công ty: thử thách tuần cho cả phòng, trang cho trưởng nhóm giao lộ trình và xem tiến độ.
- [ ] **[Thêm]** Xuất và nhập dữ liệu học ra file, để chuyển máy khi không dùng tài khoản.

## Bảo mật và vận hành (luôn đúng, mọi giai đoạn)

- [ ] **[Bắt buộc]** Đổi token bot Telegram đã lộ trước đây.
- [ ] **[Bắt buộc]** Rà lại quyền truy cập dữ liệu (RLS) trên Supabase trước khi mở bản web công khai, vì web dễ bị dò hơn app.
- [ ] **[Bắt buộc]** Giữ khóa ký Android ở 2 nơi an toàn. Mất khóa là người dùng không cập nhật được nữa.
- [ ] **[Nên]** Theo dõi hạn mức và chi phí Supabase khi người dùng tăng.
- [ ] **[Nên]** Trang hỗ trợ: liên hệ, câu hỏi thường gặp, chính sách. Dùng chung cho cả hai cửa hàng.

---

## Chi phí cần chuẩn bị

| Khoản | Chi phí | Khi nào cần |
|---|---|---|
| Google Play Console | 25 USD, một lần | Giai đoạn 2 |
| Apple Developer | 99 USD/năm | Giai đoạn 3, hoặc notarize macOS |
| Máy Mac | Mua hoặc thuê máy Mac trên mạng | Giai đoạn 3 |
| Tên miền cho bản web | ~10–15 USD/năm | Giai đoạn 1 |
| Đặt web | Miễn phí (Cloudflare Pages / GitHub Pages) | Giai đoạn 1 |
| Chứng chỉ ký mã Windows | Vài trăm USD/năm | Giai đoạn 4, không bắt buộc |
| Supabase | Miễn phí đến một mức người dùng, sau đó ~25 USD/tháng | Khi người dùng tăng |

## Thứ tự đề xuất

1. Giai đoạn 0: nền móng. Không có nó thì không làm được web hay iOS.
2. Giai đoạn 1: bản web/PWA. Có ngay người dùng iPhone và máy tính công ty, gần như không tốn tiền.
3. Xóa tài khoản và chính sách quyền riêng tư. Nhỏ nhưng là điều kiện để lên cả hai cửa hàng.
4. Giai đoạn 2: Google Play, kèm widget và "Chia sẻ → MyEnglish".
5. Giai đoạn 5: tính năng mới, xen kẽ với các giai đoạn trên.
6. Giai đoạn 3: iOS app, khi có Mac và thấy bản web chưa đủ.
