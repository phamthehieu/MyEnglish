import type { Situation } from "@/types/situation";

export const WEEKEND_CHAT: Situation = {
  id: "weekend-chat",
  group: "daily",
  title_vi: "Chào hỏi, kể chuyện cuối tuần",
  title_en: "Small talk about the weekend",
  cefr: "A2",
  goal_vi: "Hỏi thăm, trả lời 'bạn khỏe không' và kể ngắn về cuối tuần.",
  partner_vi: "Bạn cùng lớp",
  partner_emoji: "👋",
  lines: [
    {
      id: "weekend-chat.l1",
      en: "I'm fine, thank you. And you?",
      vi: "Tôi khỏe, cảm ơn. Còn bạn?",
      accept: ["I am fine thank you and you", "Fine thanks and you"],
    },
    {
      id: "weekend-chat.l2",
      en: "I'm a bit tired.",
      vi: "Tôi hơi mệt.",
      accept: ["I am a bit tired", "I'm tired"],
    },
    {
      id: "weekend-chat.l3",
      en: "I stayed at home and rested.",
      vi: "Tôi ở nhà nghỉ ngơi.",
      accept: ["I stayed home and rested", "I rested at home"],
      note: "'stayed', 'rested' là quá khứ: thêm -ed vào động từ.",
    },
    {
      id: "weekend-chat.l4",
      en: "I went out with my friends.",
      vi: "Tôi đi chơi với bạn bè.",
      accept: ["I went out with friends", "I went out with my friend"],
      note: "'went' là quá khứ bất quy tắc của 'go'.",
    },
    {
      id: "weekend-chat.l5",
      en: "How about you?",
      vi: "Còn bạn thì sao?",
      accept: ["And you", "What about you"],
    },
    {
      id: "weekend-chat.l6",
      en: "That sounds fun.",
      vi: "Nghe vui đấy.",
      accept: ["Sounds fun", "That sounds great"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi! How are you today?",
      npc_vi: "Chào bạn! Hôm nay bạn thế nào?",
      replies: [
        { lineId: "weekend-chat.l1", next: "n2" },
        { lineId: "weekend-chat.l2", next: "n3" },
      ],
    },
    {
      id: "n2",
      npc_en: "I'm good! What did you do at the weekend?",
      npc_vi: "Mình khỏe! Cuối tuần bạn làm gì?",
      replies: [
        { lineId: "weekend-chat.l3", next: "n4" },
        { lineId: "weekend-chat.l4", next: "n4" },
      ],
    },
    {
      id: "n3",
      npc_en: "Oh, I'm sorry to hear that. What did you do at the weekend?",
      npc_vi: "Ôi, mình tiếc khi nghe vậy. Cuối tuần bạn làm gì?",
      replies: [
        { lineId: "weekend-chat.l3", next: "n4" },
        { lineId: "weekend-chat.l4", next: "n4" },
      ],
    },
    {
      id: "n4",
      npc_en: "That sounds nice!",
      npc_vi: "Nghe thích đấy!",
      replies: [{ lineId: "weekend-chat.l5", next: "n5" }],
    },
    {
      id: "n5",
      npc_en: "I watched a movie.",
      npc_vi: "Mình xem phim.",
      replies: [{ lineId: "weekend-chat.l6", next: null }],
    },
  ],
};
