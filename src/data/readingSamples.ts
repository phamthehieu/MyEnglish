export interface ReadingSample {
  id: string;
  level: "A1" | "A2" | "B1" | "B2";
  titleVi: string;
  titleEn: string;
  text: string;
  translationVi: string;
}

/** Graded short texts for working adults rebuilding their English foundation */
export const READING_SAMPLES: ReadingSample[] = [
  {
    id: "a1-first-day-office",
    level: "A1",
    titleVi: "Ngày đầu ở văn phòng mới",
    titleEn: "First Day at the New Office",
    text:
      "Today is my first day at the new office. I arrive at eight thirty in the morning. My manager introduces me to the team. Everyone is very friendly and helpful.\n" +
      "At noon, I have lunch with two colleagues at a small restaurant near the building. In the afternoon, I read the company guide and check my email. I feel happy about my new job.",
    translationVi:
      "Hôm nay là ngày đầu tiên của tôi ở văn phòng mới. Tôi đến lúc 8 giờ 30 sáng. Quản lý giới thiệu tôi với cả nhóm. Mọi người đều rất thân thiện và nhiệt tình giúp đỡ.\n" +
      "Buổi trưa, tôi ăn trưa cùng hai đồng nghiệp tại một quán ăn nhỏ gần tòa nhà. Buổi chiều, tôi đọc tài liệu hướng dẫn của công ty và kiểm tra email. Tôi cảm thấy rất vui với công việc mới của mình.",
  },
  {
    id: "a1-work-from-home",
    level: "A1",
    titleVi: "Email xin làm việc tại nhà",
    titleEn: "Working from Home Today",
    text:
      "Dear Anna,\n" +
      "I have a bad cold and a slight fever this morning, so I cannot come to the office today. I will work from home and check my messages every hour.\n" +
      "I can still finish the monthly report before five o'clock this afternoon. Please call me if you need anything urgent. Thank you for understanding.",
    translationVi:
      "Chào Anna,\n" +
      "Sáng nay tôi bị cảm nặng và hơi sốt nhẹ nên hôm nay tôi không thể lên văn phòng được. Tôi sẽ làm việc tại nhà và kiểm tra tin nhắn mỗi tiếng.\n" +
      "Tôi vẫn có thể hoàn thành báo cáo tháng trước 5 giờ chiều nay. Vui lòng gọi cho tôi nếu bạn cần bất cứ việc gì gấp. Cảm ơn bạn đã thông cảm.",
  },
  {
    id: "a1-evening-routine",
    level: "A1",
    titleVi: "Buổi tối sau giờ làm",
    titleEn: "My Evening After Work",
    text:
      "I usually finish work at six o'clock and go home by motorbike. On the way home, I stop at the supermarket to buy fresh vegetables and meat.\n" +
      "Cooking dinner helps me relax after a busy day. After dinner, I talk with my family, listen to music, and practice English for fifteen minutes before going to bed.",
    translationVi:
      "Tôi thường tan làm lúc 6 giờ và đi xe máy về nhà. Trên đường về, tôi ghé siêu thị để mua rau tươi và thịt.\n" +
      "Nấu bữa tối giúp tôi thư giãn sau một ngày bận rộn. Sau bữa tối, tôi trò chuyện với gia đình, nghe nhạc và luyện tiếng Anh 15 phút trước khi đi ngủ.",
  },
  {
    id: "a2-reschedule-meeting",
    level: "A2",
    titleVi: "Đổi lịch họp với khách hàng",
    titleEn: "Rescheduling Our Weekly Meeting",
    text:
      "Hi David,\n" +
      "Thank you for sending the project summary yesterday. Our team reviewed the numbers and prepared a few questions for you.\n" +
      "Unfortunately, our director has an urgent appointment on Wednesday morning. Could we move our weekly meeting to Thursday at ten o'clock instead? Please let me know if that time works for your schedule.",
    translationVi:
      "Chào David,\n" +
      "Cảm ơn bạn đã gửi bản tóm tắt dự án hôm qua. Nhóm của chúng tôi đã xem qua các số liệu và chuẩn bị một vài câu hỏi cho bạn.\n" +
      "Rất tiếc là giám đốc của chúng tôi có một lịch hẹn khẩn vào sáng thứ Tư. Chúng ta có thể dời cuộc họp hàng tuần sang 10 giờ sáng thứ Năm được không? Vui lòng cho tôi biết nếu khung giờ đó phù hợp với lịch của bạn.",
  },
  {
    id: "a2-business-trip",
    level: "A2",
    titleVi: "Chuyến công tác ngắn ngày",
    titleEn: "A Short Business Trip to Da Nang",
    text:
      "Last week, I went on a three-day business trip to Da Nang with my colleague. We took an early flight on Monday morning and went straight to the conference center.\n" +
      "During the trip, we met several partners and discussed our plans for next year. In the evening, we walked along the beach and tried local seafood. It was a tiring but successful trip.",
    translationVi:
      "Tuần trước, tôi đã có chuyến công tác ba ngày tới Đà Nẵng cùng đồng nghiệp. Chúng tôi đi chuyến bay sớm vào sáng thứ Hai và đến thẳng trung tâm hội nghị.\n" +
      "Trong chuyến đi, chúng tôi đã gặp gỡ một số đối tác và thảo luận kế hoạch cho năm tới. Buổi tối, chúng tôi đi dạo dọc bờ biển và thưởng thức hải sản địa phương. Đó là một chuyến đi tuy mệt nhưng rất thành công.",
  },
  {
    id: "a2-workplace-habits",
    level: "A2",
    titleVi: "Thói quen nhỏ giúp làm việc hiệu quả",
    titleEn: "Small Habits for a Productive Day",
    text:
      "Many people feel tired because they try to do too many things at the same time. Every morning, I spend five minutes writing down the three most important tasks for the day.\n" +
      "I always finish the hardest task first while my energy is high. Taking a short walk at lunchtime also helps me stay focused in the afternoon.",
    translationVi:
      "Nhiều người cảm thấy mệt mỏi vì cố làm quá nhiều việc cùng một lúc. Mỗi buổi sáng, tôi dành 5 phút viết ra ba đầu việc quan trọng nhất trong ngày.\n" +
      "Tôi luôn hoàn thành việc khó nhất trước khi năng lượng còn dồi dào. Đi bộ ngắn vào giờ nghỉ trưa cũng giúp tôi giữ được sự tập trung vào buổi chiều.",
  },
  {
    id: "b1-project-update",
    level: "B1",
    titleVi: "Báo cáo tiến độ công việc",
    titleEn: "Weekly Project Update",
    text:
      "Hello everyone,\n" +
      "Here is a quick update on our customer service project. This week, we completed the new training materials and received positive feedback from the department heads.\n" +
      "However, we still need two more days to review the final budget before Friday's presentation. I appreciate everyone's hard work and support in keeping the project on schedule.",
    translationVi:
      "Chào mọi người,\n" +
      "Dưới đây là cập nhật nhanh về dự án chăm sóc khách hàng của chúng ta. Tuần này, chúng ta đã hoàn thành tài liệu đào tạo mới và nhận được phản hồi tích cực từ các trưởng bộ phận.\n" +
      "Tuy nhiên, chúng ta vẫn cần thêm hai ngày để rà soát ngân sách cuối cùng trước buổi thuyết trình ngày thứ Sáu. Tôi rất trân trọng sự nỗ lực và hỗ trợ của mọi người để giữ dự án đúng tiến độ.",
  },
  {
    id: "b1-learning-adult",
    level: "B1",
    titleVi: "Học lại tiếng Anh khi đã đi làm",
    titleEn: "Rebuilding English as a Working Adult",
    text:
      "Learning a language as a busy adult is not easy, especially when you have a full-time job and family responsibilities. Many people give up because they expect fast results in just a few weeks.\n" +
      "The secret is consistency rather than long study hours. Spending fifteen minutes every day reading real sentences, speaking aloud, and learning common words builds strong confidence over time.",
    translationVi:
      "Học ngoại ngữ khi đã là người đi làm bận rộn không hề dễ dàng, nhất là khi bạn có công việc toàn thời gian và trách nhiệm gia đình. Nhiều người bỏ cuộc vì kỳ vọng kết quả nhanh chóng chỉ sau vài tuần.\n" +
      "Bí quyết nằm ở sự đều đặn chứ không phải học nhiều giờ liền. Dành 15 phút mỗi ngày đọc các câu thực tế, tập nói thành tiếng và học những từ thông dụng sẽ xây dựng sự tự tin vững chắc theo thời gian.",
  },
  {
    id: "b2-handling-feedback",
    level: "B2",
    titleVi: "Đón nhận góp ý trong công việc",
    titleEn: "Turning Constructive Feedback into Growth",
    text:
      "Receiving critical feedback at work can feel uncomfortable at first, even when it comes from a supportive manager. Our natural reaction is often to defend our decisions or explain why a mistake happened.\n" +
      "However, professionals who pause, listen carefully, and ask specific follow-up questions gain valuable insights. Treating feedback as practical guidance rather than personal criticism builds trust and accelerates career growth.",
    translationVi:
      "Nhận những góp ý thẳng thắn trong công việc ban đầu có thể khiến ta không thoải mái, ngay cả khi lời góp ý đến từ một người quản lý luôn ủng hộ mình. Phản ứng tự nhiên của chúng ta thường là bảo vệ quyết định hoặc giải thích lý do xảy ra sai sót.\n" +
      "Tuy nhiên, những người đi làm chuyên nghiệp biết lắng nghe kỹ và đặt câu hỏi cụ thể sẽ rút ra được nhiều bài học giá trị. Xem góp ý là hướng dẫn thực tế thay vì chỉ trích cá nhân sẽ giúp xây dựng niềm tin và phát triển sự nghiệp nhanh hơn.",
  },
  {
    id: "b2-remote-collaboration",
    level: "B2",
    titleVi: "Phối hợp hiệu quả khi làm việc từ xa",
    titleEn: "Clear Communication in Hybrid Teams",
    text:
      "As hybrid work becomes standard across many industries, teams can no longer rely on casual conversations at the office to stay aligned. Misunderstandings often arise when expectations and deadlines are left vague.\n" +
      "Writing concise summaries after meetings and sharing clear priorities each morning ensures that everyone knows what needs to be done, regardless of where they are working from.",
    translationVi:
      "Khi mô hình làm việc kết hợp (lên văn phòng và từ xa) trở nên phổ biến ở nhiều ngành nghề, các nhóm không thể chỉ dựa vào những cuộc trò chuyện ngẫu nhiên tại văn phòng để nắm bắt thông tin. Hiểu lầm thường phát sinh khi kỳ vọng và thời hạn bị bỏ ngỏ.\n" +
      "Việc viết tóm tắt ngắn gọn sau mỗi cuộc họp và chia sẻ rõ các ưu tiên vào mỗi sáng giúp mọi người đều nắm chắc việc cần làm, dù họ đang làm việc ở đâu.",
  },
];
