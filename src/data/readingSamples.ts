export interface ReadingSample {
  id: string;
  level: "A1" | "A2" | "B1";
  titleVi: string;
  titleEn: string;
  text: string;
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
  },
  {
    id: "a1-evening-routine",
    level: "A1",
    titleVi: "Buổi tối sau giờ làm",
    titleEn: "My Evening After Work",
    text:
      "I usually finish work at six o'clock and go home by motorbike. On the way home, I stop at the supermarket to buy fresh vegetables and meat.\n" +
      "Cooking dinner helps me relax after a busy day. After dinner, I talk with my family, listen to music, and practice English for fifteen minutes before going to bed.",
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
  },
  {
    id: "a2-business-trip",
    level: "A2",
    titleVi: "Chuyến công tác ngắn ngày",
    titleEn: "A Short Business Trip to Da Nang",
    text:
      "Last week, I went on a three-day business trip to Da Nang with my colleague. We took an early flight on Monday morning and went straight to the conference center.\n" +
      "During the trip, we met several partners and discussed our plans for next year. In the evening, we walked along the beach and tried local seafood. It was a tiring but successful trip.",
  },
  {
    id: "a2-workplace-habits",
    level: "A2",
    titleVi: "Thói quen nhỏ giúp làm việc hiệu quả",
    titleEn: "Small Habits for a Productive Day",
    text:
      "Many people feel tired because they try to do too many things at the same time. Every morning, I spend five minutes writing down the three most important tasks for the day.\n" +
      "I always finish the hardest task first while my energy is high. Taking a short walk at lunchtime also helps me stay focused in the afternoon.",
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
  },
  {
    id: "b1-learning-adult",
    level: "B1",
    titleVi: "Học lại tiếng Anh khi đã đi làm",
    titleEn: "Rebuilding English as a Working Adult",
    text:
      "Learning a language as a busy adult is not easy, especially when you have a full-time job and family responsibilities. Many people give up because they expect fast results in just a few weeks.\n" +
      "The secret is consistency rather than long study hours. Spending fifteen minutes every day reading real sentences, speaking aloud, and learning common words builds strong confidence over time.",
  },
];

