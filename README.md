# MyEnglish

Ứng dụng học tiếng Anh đa nền tảng (**Web / PWA · Windows · macOS · Android**) thiết kế ưu tiên cho người học Việt Nam từ mức **mất gốc (A0)** đến **C1**, hoạt động **offline-first** và đồng bộ đám mây tùy chọn qua Supabase.

## Tính năng chính

- **Lộ trình hằng ngày (`Hôm nay`):** Tự động lập kế hoạch học theo quỹ thời gian chọn trước (`5 / 10 / 15` phút/ngày), có chế độ giữ chuỗi nhanh **1 phút** và kế hoạch quay lại (**Comeback**) khi nghỉ học nhiều ngày.
- **Từ vựng Oxford 3000 & 5000 (5.004 từ, A1–C1):** Đầy đủ IPA US/UK, nghĩa tiếng Việt theo từng nét nghĩa và câu ví dụ song ngữ; lập lịch ôn bằng thuật toán **FSRS-6 (`ts-fsrs`)** tách riêng 2 chiều *Nhận diện* và *Nhớ chủ động*.
- **Lộ trình nói & Hội thoại tình huống:** 474 mẫu câu theo chủ đề/mục tiêu (*Đi làm, Du lịch, Đời sống, Kết bạn*) học theo thang 4 bước + hơn 230 tình huống hội thoại có đổi vai và ôn lại câu sai.
- **Phát âm & 47 video khẩu hình IPA:** 10 bài phát âm trọng tâm lỗi người Việt hay mắc (âm cuối, `-s/-es`, `-ed`, `/θ/–/ð/`, nối âm, nhịp câu) kèm bảng IPA có video hướng dẫn và chấm giọng nói (Android Vosk offline / Web Speech API).
- **Shadowing YouTube (182 bài):** Karaoke chạy theo từng từ, chạm từ xem nghĩa, chế độ Chính tả và Điền từ, có nhóm bài ngắn kèm dịch tiếng Việt cho người mới.
- **Ngữ pháp & Viết:** Sổ tay 31 chương / 394 bài học cùng hơn 2.900 câu bài tập chia theo thì, kết hợp luyện viết ngắn hằng ngày và Sổ lỗi cá nhân.

## Công nghệ sử dụng

- **Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, Vite (`vite-plugin-pwa`)
- **Desktop & Mobile Shell:** Tauri v2 (Rust), `@tauri-apps/plugin-sql` (SQLite), `sql.js` (Web)
- **SRS & Backend:** `ts-fsrs` v5 (FSRS-6), Supabase (Auth, Cloud Sync, Leaderboard, Web Push)

## Cài đặt & Chạy dự án

```bash
# Cài đặt dependencies
npm install

# Chạy bản Web (dev server)
npm run dev

# Kiểm tra TypeScript
npm run check

# Chạy toàn bộ unit tests (Vitest)
npm test

# Build bản Web / PWA production
npm run build
```

Xem thêm hướng dẫn đóng gói Desktop/Android tại [docs/LENH-BUILD.md](docs/LENH-BUILD.md).
