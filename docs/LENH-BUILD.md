# Các lệnh build và phát hành MyEnglish

Mọi lệnh chạy trong **PowerShell**, ở thư mục dự án. Mở PowerShell rồi gõ trước:

```
cd D:\nghich\MyEnglish
```

> Đang chạy lệnh thì **đừng bấm chuột vào cửa sổ PowerShell**: Windows sẽ "đóng băng" lệnh. Lỡ bấm thì nhấn **Esc**.

---

## 1. Thử trên điện thoại (bản debug)

Cắm điện thoại vào máy tính (đã bật gỡ lỗi USB), rồi:

```
powershell -ExecutionPolicy Bypass -File scripts/build-android-win.ps1 -Install
```

- Build bản debug và cài thẳng lên điện thoại, giữ nguyên dữ liệu học.
- Mất khoảng 1–3 phút.
- Chỉ để thử, **không gửi cho người dùng**.

---

## 2. Phát hành bản mới cho người dùng (Android + web)

**Bước 1.** Viết điểm mới của bản này vào file `D:\nghich\MyEnglish-android\release-notes.txt`. Người dùng sẽ đọc nội dung đó trong app.

**Bước 2.** Chạy thử, chưa gửi gì lên mạng:

```
npm run release -- --notes-file D:\nghich\MyEnglish-android\release-notes.txt --bump patch --web
```

**Bước 3.** Thấy báo `OK` thì phát hành thật. Lần này **bỏ `--bump patch`**, vì bước 2 đã nâng phiên bản rồi:

```
npm run release -- --notes-file D:\nghich\MyEnglish-android\release-notes.txt --web --publish
```

Muốn làm một lần cho nhanh, bỏ bước 2 và chạy thẳng:

```
npm run release -- --notes-file D:\nghich\MyEnglish-android\release-notes.txt --bump patch --web --publish
```

| Tùy chọn | Ý nghĩa |
|---|---|
| `--bump patch` | Tăng số phiên bản cuối: 0.4.1 → 0.4.2 (sửa lỗi, thêm ít) |
| `--bump minor` | Tăng số phiên bản giữa: 0.4.1 → 0.5.0 (thay đổi lớn) |
| `--web` | Đăng luôn bản web |
| `--publish` | Gửi lên mạng thật. Không có thì chỉ build và kiểm tra |

- Bản phát hành mất khoảng **5–15 phút**, vì phải build cho 2 loại máy rồi tải file 108 MB lên GitHub.
- Xong khi thấy dòng **"Xong: v… đã phát hành"**. Máy người dùng sẽ báo có bản mới.

---

## 3. Chỉ đăng lại bản web

Dùng khi chỉ sửa giao diện web, hoặc vừa đổi `.env.local`:

```
npm run web:publish -- --push
```

- Không có `--push` thì chỉ build và kiểm tra, không gửi đi.
- Trang web: https://phamthehieu.github.io/MyEnglish/ (cập nhật sau 1–3 phút).
- Trình duyệt vẫn hiện bản cũ? Đóng hẳn trang hoặc app rồi mở lại, hoặc nhấn `Ctrl + Shift + R`.

---

## 4. Kiểm tra code (trước khi phát hành)

```
npx tsc --noEmit
npm test
```

- Lệnh đầu không in gì là không có lỗi kiểu.
- Lệnh sau phải báo **all passed**.

---

## 5. Chạy bản web trên máy để xem thử

```
npm run dev
```

Mở trình duyệt vào http://localhost:1420. Nhấn `Ctrl + C` trong PowerShell để tắt.

---

## 6. Supabase (máy chủ)

**Chạy migration mới** (khi có file mới trong `supabase/migrations/`):

1. Supabase → **SQL Editor** → **New query**.
2. Dán toàn bộ nội dung file `.sql`, rồi bấm **Run**.

Đã chạy: 0001 → 0011. **Chưa chạy: 0012** (chạy xong 0012 rồi mới triển khai lại Edge Function).

**Triển khai lại Edge Function nhắc học** (khi sửa `supabase/functions/`):

```
npx supabase login
npx supabase functions deploy send-reminders --no-verify-jwt --use-api --project-ref xxixefmwctwnyxdhwznk
```

**Kiểm tra nhắc học trên web có chạy không** (SQL Editor):

```sql
select status_code, content, created from net._http_response
where content like '%"sent"%' or status_code in (401, 403)
order by created desc limit 3;
```

- `200` kèm `{"sent":…}`: đang chạy.
- `403`: `CRON_SECRET` ở hai nơi không khớp.

Chi tiết từng phần: `supabase/README.md`.

---

## 7. Khi gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Lệnh đứng yên rất lâu, không chạy tiếp | Bấm vào cửa sổ, nhấn **Esc** (chế độ chọn chữ của Windows) |
| `gh : The term 'gh' is not recognized` | Đóng PowerShell, mở cửa sổ mới |
| `Could not read package.json` | Chưa `cd D:\nghich\MyEnglish` |
| `Dừng lại: còn thay đổi chưa commit` | Có file chưa commit: nhờ Claude xem `git status` |
| `Dừng lại: bản v… đã có trên GitHub` | Thêm `--bump patch` để lên phiên bản mới |
| `The '<' operator is reserved` | Thay cả cụm `<…>` trong lệnh bằng giá trị thật, bỏ dấu `<` `>` |
| Web báo 404 ngay sau khi đăng | Đợi 2–5 phút rồi tải lại |

---

## Không bao giờ

- Cài **bản phát hành** (`MyEnglish-v….apk`) lên máy đang chạy **bản debug**: phải gỡ app, mất dữ liệu học.
- Gửi cho ai hay dán vào chat: **Private Key VAPID**, **CRON_SECRET**, khóa `service_role`, nội dung `.env.local`, file `keystore.properties`.
- Làm mất khóa ký app (file keystore): mất là người dùng không cập nhật được nữa. Giữ 2 bản ở 2 nơi an toàn.
