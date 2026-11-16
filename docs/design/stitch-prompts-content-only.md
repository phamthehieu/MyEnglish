# MyEnglish: prompt Stitch, mỗi prompt một màn

Chỉ mô tả màn hình có gì và làm được gì. Giao diện để Stitch tự quyết.

## Cách dùng
1. Tạo một dự án Stitch (Mobile). Làm tất cả trong cùng một dự án.
2. Dán **BỐI CẢNH** (bên dưới) làm prompt đầu tiên, hoặc dán kèm vào prompt 1.
3. Dán từng màn một, theo thứ tự. Chờ Stitch làm xong màn này mới dán màn tiếp.
4. Màn 1 nên tạo lại vài lần để chọn phong cách. Các màn sau Stitch tự bám theo.
5. Màn nào lệch phong cách thì gõ: "Giữ giống phong cách màn Hôm nay".

## BỐI CẢNH

```text
App "MyEnglish": học tiếng Anh cho nhân viên văn phòng Việt Nam (22-45 tuổi), học 5-15 phút mỗi ngày, chủ yếu trên điện thoại.
Toàn bộ chữ trên giao diện là tiếng Việt đúng như trong ngoặc kép. Tiếng Anh chỉ là nội dung học.
Thanh điều hướng 5 mục: "Hôm nay", "Từ vựng", "Luyện nói", "Ngữ pháp", "Tôi".
Mỗi màn chỉ có một hành động chính nổi bật. Phong cách, màu, font, bố cục do bạn quyết, giữ thống nhất mọi màn.
```

---

## A. Hôm nay

**1. Hôm nay**
```text
Màn "Hôm nay". Lời chào "Chào Lan" và ngày hôm nay. Chuỗi "12 ngày", mục tiêu "12/20 câu".
Danh sách 5 việc hôm nay: "Lộ trình nói · 3 phút" (xong), "Ôn từ & từ mới · 4 phút" (xong),
"1 bài ngữ pháp · 3 phút", "Phát âm · 2 phút", "Luyện phản xạ · 1 phút". Tóm tắt "2/5 việc · còn ~6 phút".
Hành động chính "Tiếp tục hôm nay". Hành động phụ "Chỉ 1 phút", "Tập trung 10 phút".
Có mục "Cấp của bạn: A2" và mục thu gọn "Xem thêm".
```

**2. Hôm nay, xong cả ngày**
```text
Màn "Hôm nay" khi đã xong hết việc: "Xong cả ngày", chuỗi "13 ngày", "Ngày mai: 15 thẻ ôn · ~6 phút".
Hành động "Muốn học thêm?" và liên kết "Góp ý cho app".
```

**3. Hôm nay, sắp mất chuỗi**
```text
Màn "Hôm nay" vào buổi tối khi chưa học gì: cảnh báo "Sắp mất chuỗi 12 ngày, chỉ cần 1 phút".
Hành động chính "Học 1 phút". Danh sách việc hôm nay 0/5, nút "Bắt đầu hôm nay".
```

**4. Hôm nay, xem thêm**
```text
Mục "Xem thêm" của màn "Hôm nay" khi mở rộng:
"Nhiệm vụ hôm nay" có 3 nhiệm vụ ("Ôn 20 thẻ 14/20", "Nói 5 câu 5/5", "Học 1 bài ngữ pháp 0/1") và rương thưởng "Mở rương phần thưởng" mở khi xong cả 3.
"Cuộc đua tuần này": 3 người đứng đầu kèm XP, và "Bạn: hạng 8 · 420 XP".
"Lộ trình từ vựng Oxford": A1 92%, A2 40%, B1 5%, "Xong A2 khoảng 3 tháng nữa".
```

## B. Từ vựng

Mục "Từ vựng" có các trang con: "Ôn tập", "Kho từ", "Từ hay quên", "Đã biết", "Lộ trình".

**5. Ôn tập, màn bắt đầu**
```text
Trang "Ôn tập" của mục "Từ vựng". "Hôm nay: 18 thẻ ôn · 5 từ mới · ~7 phút". Hành động chính "Bắt đầu học".
Phụ: "Tập trung 10 phút", "Luyện thêm (không tính lịch)". Dự báo số thẻ cần ôn 7 ngày tới.
Danh sách theo cấp A1, A2, B1 kèm số lượng và hai hành động "Ôn", "Luyện".
```

**6. Thẻ lật, mặt trước**
```text
Màn học thẻ từ, tập trung, không có thanh điều hướng. Tiến độ "Thẻ 4/20", "Đúng liền 3", nút thoát.
Thẻ hiện từ "deadline", phiên âm "/ˈdedlaɪn/", hai nút nghe (thường, chậm). Hành động "Lật thẻ".
```

**7. Thẻ lật, mặt sau**
```text
Cùng thẻ "deadline" sau khi lật: nghĩa "hạn chót", ví dụ "The deadline is Friday." / "Hạn chót là thứ Sáu.", mục "Mẹo ghi nhớ" có thể mở.
Người học tự chấm 4 mức, mỗi mức ghi khi nào gặp lại: "Quên · 10 phút", "Khó · 1 ngày", "Nhớ · 3 ngày", "Dễ · 7 ngày".
```

**8. Bài trắc nghiệm**
```text
Bài "Chọn nghĩa đúng của từ": từ "invoice" có nút nghe, 4 nghĩa để chọn, đáp án đúng là "hóa đơn".
Hiện trạng thái sau khi chọn đúng và nút "Tiếp tục". Đúng/sai không chỉ phân biệt bằng màu.
```

**9. Bài điền từ**
```text
Bài "Điền từ còn thiếu": câu "Please send me the ___ by Monday." Người học gõ từ còn thiếu.
Có "Gợi ý" và "Kiểm tra".
```

**10. Bài xếp câu**
```text
Bài "Xếp thành câu đúng": đề tiếng Việt "Tôi sẽ gửi báo cáo vào ngày mai." Các mảnh từ "I'll", "send", "the", "report", "tomorrow" để người học sắp xếp. Nút "Kiểm tra". Hiện cả trạng thái làm sai.
```

**11. Bài nói to**
```text
Bài đọc to: từ "schedule" kèm phiên âm. Người học thu âm bằng "Chạm để nói", rồi tự báo "Đọc được" hoặc "Chưa chắc".
Có lối nhỏ "Tôi không nói to được lúc này".
```

**12. Tổng kết phiên học**
```text
Màn "Xong phiên học!": "Nhớ 16", "Từ mới 5", "Cần ôn lại 4", "3 từ đã vào trí nhớ dài hạn" (liệt kê từ), "+120 XP".
Hành động: "Hoàn tất" (chính), "Ôn lỗi sai", "Thêm 5 phút".
```

**13. Kho từ**
```text
Trang "Kho từ": danh sách toàn bộ từ của người học. Ô tìm "Tìm từ…". Lọc theo cấp (A1, A2, B1, B2, C1) và theo lịch ôn ("Đến hạn", "Hôm nay", "1–3 ngày", "4–7 ngày", "Chưa học").
Mỗi từ có: từ, nghĩa, mức nhớ, "Ôn sau 2 ngày", nút nghe.
```

**14. Chi tiết từ**
```text
Chi tiết từ "negotiate" /nɪˈɡoʊʃieɪt/, nghĩa "đàm phán", 2 ví dụ có dịch, từ liên quan, "Mẹo ghi nhớ".
"Nhớ lúc này 82%", "Ôn tiếp: 3 ngày nữa", "Lịch sử ôn". Hành động "Tạm ngưng ôn" và "Xoá từ".
```

**15. Từ hay quên**
```text
Trang "Từ hay quên": "Đang hay quên 12", "Câu sai 7 ngày qua 18", "Đã nhớ lại 30". Hành động chính "Ôn 12 từ hay quên".
Danh sách các từ, mỗi từ có "sai 4 lần", mức nhớ và "Mẹo nhớ".
```

**16. Đã biết**
```text
Trang "Đã biết": "Những từ bạn đánh dấu đã biết, kiểm tra nhanh để chắc chắn".
"Chờ kiểm tra 24", "Đã xác nhận 180", "Kiểm tra sai 6". Hành động chính "Kiểm tra ngay 10 từ".
```

**17. Lộ trình từ vựng**
```text
Trang "Lộ trình" (bộ Oxford 5000): mỗi cấp A1, A2, B1, B2, C1 có tiến độ "512/900 từ", "Xong khoảng tháng 3", và cho biết cấp nào đang học.
Có "Đã biết cả cấp" và ô "Tìm từ và học sớm".
```

## C. Luyện nói

Mục "Luyện nói" có các trang con: "Mẫu câu", "Hội thoại", "Phát âm", "Shadowing".

**18. Mẫu câu, lộ trình**
```text
Trang "Mẫu câu". Chọn mục tiêu "Du lịch", "Đi làm", "Đời sống", "Kết bạn" và cấp A1–C1.
Lộ trình là chuỗi các chặng: chặng đã xong, chặng hiện tại "Chặng 5: Hẹn lịch họp · 2/4 mẫu", chặng chưa mở.
Hành động chính "Bắt đầu hôm nay (~5 phút)".
```

**19. Một chặng mẫu câu**
```text
Chặng "Hẹn lịch họp" gồm 4 mẫu câu, ví dụ "Are you free on ___?" / "Bạn có rảnh vào ___ không?".
Mỗi mẫu học qua 4 bước cách nhau một ngày: "Học mẫu câu", "Thay chỗ trống", "Ghép câu", "Hỏi đáp nhanh".
Hiện bước đã xong và bước "Mở vào ngày mai". Có "Làm bài kiểm tra để bỏ qua chặng".
```

**20. Học một mẫu câu**
```text
Màn học mẫu "I'd like to ___." / "Tôi muốn ___.", phiên âm, nút nghe, một ghi chú ngắn, 6 ví dụ để chọn điền
("book a meeting room", "reschedule our call"…), liên kết "Vì sao nói vậy?" mở giải thích ngữ pháp.
```

**21. Hội thoại, danh sách**
```text
Trang "Hội thoại": gợi ý "Gợi ý hôm nay: Gọi món ở nhà hàng". Lọc theo cấp A1–C1 và "Đời thường" / "Công việc".
Mỗi tình huống có tiêu đề, mô tả ngắn, trạng thái "Mới" / "Đang học" / "Đã nói được", 0–3 sao, hành động "Học câu trước" và "Nói thử".
```

**22. Đang hội thoại**
```text
Màn trò chuyện giữa app và người học. Lời của đối tác nghe được. Người học trả lời bằng cách nói ("Chạm để nói"),
chọn câu, ghép từ hoặc gõ. Có "Xem gợi ý" và menu tùy chọn.
```

**23. Tổng kết hội thoại**
```text
Màn "Bạn đã nói xong!": "Đúng ngay lần đầu 80%", 3 sao, danh sách "Câu nên luyện thêm" có nghe lại.
Hành động "Nói lại" và "Về danh sách".
```

**24. Phát âm**
```text
Trang "Phát âm": chuyển giữa "Bảng 44 âm" (âm IPA, âm đã học được đánh dấu) và "Bài theo chủ đề".
"Bài tiếp: âm /θ/ và /s/" với "Bắt đầu luyện". Mục "Cặp âm dễ nhầm" với "Luyện phân biệt ngay".
```

**25. Shadowing, danh sách**
```text
Trang "Shadowing": danh sách video theo cấp, mỗi video có ảnh bìa, tiêu đề, thời lượng, cấp độ.
```

**26. Shadowing, đang học**
```text
Màn học shadowing: video và phụ đề theo câu. 4 chế độ "Phụ đề", "Shadowing", "Chính tả", "Điền từ".
Câu hiện tại nổi bật, chạm câu bất kỳ để nhảy tới, có nghĩa tiếng Việt. Điều khiển: lặp câu, tốc độ "0.75x", thu âm.
Sau khi thu, mỗi từ có điểm.
```

## D. Ngữ pháp

Mục "Ngữ pháp" có các trang con: "Ngữ pháp", "Đọc", "Viết".

**27. Ngữ pháp, trang chính**
```text
Trang "Ngữ pháp": "Tiếp theo: Thì hiện tại hoàn thành" với "Học bài mới", và "Ôn lại 3 bài đến hạn".
Tiến độ "12/60 bài". Danh sách chương và bài kèm trạng thái. Liên kết "Luyện theo thì".
```

**28. Một bài ngữ pháp**
```text
Màn một bài ngữ pháp có 3 phần: "Sổ tay", "Bài tập", "Kiểm tra nhanh". Phần "Sổ tay" hiện công thức câu
(phân biệt chủ ngữ, động từ, tân ngữ), giải thích ngắn tiếng Việt, ví dụ có dịch.
```

**29. Bài tập ngữ pháp**
```text
Bài tập "Câu 3/8", "Chọn đáp án đúng": "She ___ here since 2020." với 4 đáp án.
Hỗ trợ: "Gợi ý", "Dạng dễ hơn", "Xem đáp án", và "Kiểm tra". Hiện cả trạng thái trả lời sai kèm giải thích ngắn bằng tiếng Việt.
```

**30. Đọc**
```text
Trang "Đọc": một email tiếng Anh người học dán vào. Mỗi từ được đánh dấu theo trạng thái
"Đã thuộc", "Đang học", "Mới thêm", "Từ lạ" (có chú giải). Chạm vào từ hiện nghĩa, phiên âm, nút nghe và "Lưu từ".
```

**31. Viết**
```text
Trang "Viết": "Standup hôm nay", khung viết có gợi ý "Hôm qua tôi đã…, hôm nay tôi sẽ…", các từ đang học có thể dùng,
hành động "Nhờ AI sửa" với "Còn 2 lượt hôm nay".
```

**32. Kết quả bài viết**
```text
Kết quả sau khi AI sửa: "Điểm 78/100", danh sách lỗi (câu sai, câu đúng, lý do ngắn bằng tiếng Việt).
Mục "Sổ lỗi của bạn" với "Luyện lại 5 câu".
```

## E. Tôi

Mục "Tôi" có các trang con: "Tiến độ", "Xếp hạng", "Tài khoản", "Cài đặt".

**33. Tiến độ**
```text
Trang "Tiến độ" có 5 phần "Tổng quan", "Từ vựng", "Thói quen", "Lịch ôn", "Thành tựu". Phần "Tổng quan":
"Tỷ lệ nhớ 86%", "Nhớ lâu 340 từ", "Chuỗi 12 ngày", lịch sử học 3 tháng gần nhất theo ngày,
"Trình độ ước tính: A2 · 64/100" với "Kiểm tra trình độ".
```

**34. Xếp hạng**
```text
Trang "Xếp hạng": "Tuần này", "Tổng", "Chuỗi ngày"; chọn "Mọi người" hoặc "Nhóm của tôi".
Bảng xếp hạng có ảnh đại diện, tên, XP; vị trí của người dùng luôn thấy được. Hành động "Tạo nhóm mới", "Vào nhóm bằng mã".
```

**35. Cài đặt**
```text
Trang "Cài đặt" chia nhóm:
"Học mỗi ngày": "Mục tiêu mỗi ngày 20 câu", "Từ mới mỗi ngày 5".
"Nhắc học": bật/tắt, "Nhắc mỗi 60 phút", giờ học "07:30", "12:30", "20:00" và "+ Giờ khác", "Không nhắc ban đêm", "Xong mục tiêu thì thôi nhắc".
"Giao diện & âm thanh": "Sáng / Tối / Theo máy", cỡ chữ "Vừa / Lớn / Rất lớn", "Giọng đọc".
Nhóm ít dùng có thể thu gọn: "AI (không bắt buộc)", "Nâng cao", "Dữ liệu & sao lưu". Và "Góp ý cho app".
```

**36. Tài khoản**
```text
Trang "Tài khoản": ảnh đại diện, tên "Nguyễn Lan", email, trạng thái "Đã đồng bộ lúc 08:42" với "Đồng bộ ngay",
công tắc "Hiện cuộc đua xếp hạng", "Đăng xuất".
```

**37. Góp ý**
```text
Màn "Góp ý cho app": chọn loại "Lỗi" / "Nội dung" / "Ý tưởng" / "Khác", ô nội dung "Bạn muốn nói gì với người làm app?",
ô "Cách liên hệ (không bắt buộc)", nút "Gửi". Có cả trạng thái sau khi gửi "Đã gửi, cảm ơn bạn!".
```

## F. Bắt đầu lần đầu

Mỗi bước một câu hỏi, có "Bước n/4" và cách quay lại, không có thanh điều hướng.

**38. Bước 1**
```text
Bước 1/4 "Tiếng Anh của bạn đang ở mức nào?": "A0 · Mất gốc", "A1 · Biết vài câu chào", "A2 · Nói được câu đơn giản",
"B1 · Giao tiếp cơ bản", "B2 · Làm việc được", "C1 · Thành thạo", và "Không chắc? Kiểm tra nhanh (2–4 phút)".
```

**39. Bước 2**
```text
Bước 2/4 "Bạn muốn học từ vựng cấp nào?": các cấp kèm số từ, một cấp được đánh dấu "Gợi ý".
```

**40. Bước 3**
```text
Bước 3/4 "Chọn thì bạn muốn bắt đầu học": danh sách các thì kèm mô tả ngắn tiếng Việt, "Hiện tại đơn" chọn sẵn.
```

**41. Bước 4**
```text
Bước 4/4 "Mỗi ngày bạn học bao lâu, vào lúc nào?": "5 phút", "10 phút", "15 phút", "20 phút";
giờ "07:30 Sáng sớm", "12:30 Nghỉ trưa", "17:30 Cuối giờ làm", "20:00 Buổi tối", "21:30 Trước khi ngủ", "+ Giờ khác";
"Nhắc tôi học mỗi ngày". Hành động cuối "Học 5 từ đầu tiên ngay".
```

## G. Màn nhỏ

**42. Thông báo Android**
```text
Thông báo trên màn hình khóa Android: "MyEnglish · Đến giờ học bạn đã hẹn", "18 thẻ đang chờ, ~5 phút".
```

**43. Câu hỏi nhanh nổi**
```text
Câu hỏi nhanh hiện nổi trên một app khác: "Câu hỏi nhanh", từ "deadline", 3 đáp án, hành động "Học ngay" và "Để sau".
```

**44. Lên cấp**
```text
Chúc mừng "Lên cấp 8!", danh hiệu mới, hành động "Tuyệt".
```

**45. Ôn tập trống**
```text
Trang "Ôn tập" khi không còn thẻ: "Không có thẻ nào cần ôn lúc này", "Quay lại lúc 14:00 hoặc học thêm từ mới", hành động "Học từ mới".
```

**46. Xác nhận thoát**
```text
Hỏi xác nhận "Thoát phiên học?", "Bạn đã làm 7/20 thẻ, phần đã làm vẫn được lưu.", hành động "Học tiếp" (nên chọn) và "Thoát".
```

## H. Bản máy tính (đổi sang chế độ Web)

**47. Hôm nay, máy tính**
```text
Bản máy tính (1440x900) của app, cùng nhận diện với bản điện thoại. Điều hướng 5 mục "Hôm nay", "Từ vựng", "Luyện nói", "Ngữ pháp", "Tôi";
luôn thấy chuỗi "12 ngày", mục tiêu "12/20 câu", ảnh đại diện.
Màn "Hôm nay": danh sách việc hôm nay với "Tiếp tục hôm nay", cùng "Nhiệm vụ hôm nay", "Cuộc đua tuần này", "Lộ trình từ vựng Oxford".
```

**48. Thẻ lật, máy tính**
```text
Màn học thẻ tập trung trên máy tính, không có điều hướng. Gợi ý phím: "1 Quên", "2 Khó", "3 Nhớ", "4 Dễ", "Space: lật thẻ".
```

**49. Kho từ, máy tính**
```text
"Kho từ" dạng bảng (từ, nghĩa, cấp, mức nhớ, lần ôn kế tiếp). Chọn một từ thì chi tiết từ hiện ngay cạnh bảng.
```
