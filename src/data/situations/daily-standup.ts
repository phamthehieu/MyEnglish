import type { Situation } from "@/types/situation";

export const DAILY_STANDUP: Situation = {
  id: "daily-standup",
  group: "work",
  title_vi: "Báo cáo công việc buổi sáng",
  title_en: "Daily standup",
  cefr: "A2",
  goal_vi: "Nói hôm qua bạn làm gì, hôm nay sẽ làm gì, và có vướng mắc không.",
  partner_vi: "Trưởng nhóm",
  partner_emoji: "💼",
  lines: [
    {
      id: "daily-standup.l1",
      en: "Yesterday I fixed a bug.",
      vi: "Hôm qua tôi sửa một lỗi.",
      accept: ["I fixed a bug yesterday", "Yesterday I fixed the bug"],
      note: "Dùng quá khứ (-ed) cho việc đã xong: fixed, worked, finished.",
    },
    {
      id: "daily-standup.l2",
      en: "I worked on a new feature.",
      vi: "Tôi làm một tính năng mới.",
      accept: ["Yesterday I worked on a new feature", "I worked on the new feature"],
    },
    {
      id: "daily-standup.l3",
      en: "Today I will write some tests.",
      vi: "Hôm nay tôi sẽ viết một số bài kiểm thử.",
      accept: ["I will write some tests today", "Today I'll write tests"],
      note: "'will' + động từ nguyên mẫu cho việc sắp làm.",
    },
    {
      id: "daily-standup.l4",
      en: "Today I will review code.",
      vi: "Hôm nay tôi sẽ xem lại mã.",
      accept: ["I will review code today", "Today I'll review code"],
    },
    {
      id: "daily-standup.l5",
      en: "No, everything is fine.",
      vi: "Không, mọi thứ ổn cả.",
      accept: ["Everything is fine", "No problem"],
    },
    {
      id: "daily-standup.l6",
      en: "Yes, I need some help.",
      vi: "Có, tôi cần được giúp một chút.",
      accept: ["I need some help", "Yes I need help"],
    },
    {
      id: "daily-standup.l7",
      en: "Thank you very much.",
      vi: "Cảm ơn bạn nhiều.",
      accept: ["Thank you", "Thanks"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Good morning! What did you do yesterday?",
      npc_vi: "Chào buổi sáng! Hôm qua bạn làm gì?",
      replies: [
        { lineId: "daily-standup.l1", next: "n2" },
        { lineId: "daily-standup.l2", next: "n2" },
      ],
    },
    {
      id: "n2",
      npc_en: "Great. What will you do today?",
      npc_vi: "Tốt. Hôm nay bạn sẽ làm gì?",
      replies: [
        { lineId: "daily-standup.l3", next: "n3" },
        { lineId: "daily-standup.l4", next: "n3" },
      ],
    },
    {
      id: "n3",
      npc_en: "Do you have any problems?",
      npc_vi: "Bạn có vướng mắc gì không?",
      replies: [
        { lineId: "daily-standup.l5", next: "n5" },
        { lineId: "daily-standup.l6", next: "n4" },
      ],
    },
    {
      id: "n4",
      npc_en: "Okay. Let's talk after the meeting.",
      npc_vi: "Được. Mình nói chuyện sau cuộc họp nhé.",
      replies: [{ lineId: "daily-standup.l7", next: null }],
    },
    {
      id: "n5",
      npc_en: "Good. Have a great day!",
      npc_vi: "Tốt. Chúc bạn một ngày làm việc tốt!",
      replies: [{ lineId: "daily-standup.l7", next: null }],
    },
  ],
};
