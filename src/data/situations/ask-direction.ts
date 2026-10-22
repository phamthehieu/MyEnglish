import type { Situation } from "@/types/situation";

export const ASK_DIRECTION: Situation = {
  id: "ask-direction",
  group: "daily",
  title_vi: "Hỏi đường",
  title_en: "Asking for directions",
  cefr: "A1",
  goal_vi: "Hỏi được một nơi ở đâu, hỏi xa không, và nhờ nói lại khi chưa hiểu.",
  partner_vi: "Người qua đường",
  partner_emoji: "🧭",
  lines: [
    {
      id: "ask-direction.l1",
      en: "Excuse me, where is the station?",
      vi: "Xin lỗi, nhà ga ở đâu ạ?",
      accept: ["Where is the station", "Excuse me where's the station"],
      note: "'Excuse me' để bắt đầu nói chuyện với người lạ.",
    },
    {
      id: "ask-direction.l2",
      en: "Excuse me, where is the bathroom?",
      vi: "Xin lỗi, nhà vệ sinh ở đâu ạ?",
      accept: ["Where is the bathroom", "Excuse me where's the bathroom"],
    },
    {
      id: "ask-direction.l3",
      en: "Is it far from here?",
      vi: "Chỗ đó có xa đây không?",
      accept: ["Is it far", "Is it far from here please"],
    },
    {
      id: "ask-direction.l4",
      en: "Can you say that again, please?",
      vi: "Bạn nói lại được không ạ?",
      accept: ["Say that again please", "Can you repeat that please"],
      note: "Câu cứu nguy khi chưa nghe kịp. Dùng bao nhiêu lần cũng được.",
    },
    {
      id: "ask-direction.l5",
      en: "Thank you so much.",
      vi: "Cảm ơn bạn nhiều lắm.",
      accept: ["Thank you", "Thanks a lot", "Thanks"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi. Can I help you?",
      npc_vi: "Chào bạn. Tôi giúp gì được không?",
      replies: [
        { lineId: "ask-direction.l1", next: "n2" },
        { lineId: "ask-direction.l2", next: "n2" },
      ],
    },
    {
      id: "n2",
      npc_en: "Go straight, then turn left.",
      npc_vi: "Đi thẳng, rồi rẽ trái.",
      replies: [
        { lineId: "ask-direction.l3", next: "n4" },
        { lineId: "ask-direction.l4", next: "n3" },
      ],
    },
    {
      id: "n3",
      npc_en: "Sure. Go straight, then turn left.",
      npc_vi: "Được chứ. Đi thẳng, rồi rẽ trái.",
      replies: [{ lineId: "ask-direction.l3", next: "n4" }],
    },
    {
      id: "n4",
      npc_en: "No, it's about five minutes on foot.",
      npc_vi: "Không xa, đi bộ khoảng năm phút.",
      replies: [{ lineId: "ask-direction.l5", next: null }],
    },
  ],
};
