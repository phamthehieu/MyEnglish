import type { Situation } from "@/types/situation";

export const RESTAURANT: Situation = {
  id: "restaurant",
  group: "daily",
  title_vi: "Gọi món ở nhà hàng",
  title_en: "Eating at a restaurant",
  cefr: "A1",
  goal_vi: "Xin bàn, gọi món, hỏi gợi ý và gọi đồ uống.",
  partner_vi: "Nhân viên phục vụ",
  partner_emoji: "🍜",
  lines: [
    {
      id: "restaurant.l1",
      en: "A table for two, please.",
      vi: "Cho tôi một bàn hai người.",
      accept: ["Table for two please", "For two please"],
    },
    {
      id: "restaurant.l2",
      en: "Just me, please.",
      vi: "Chỉ mình tôi thôi.",
      accept: ["A table for one please", "Table for one please"],
    },
    {
      id: "restaurant.l3",
      en: "I'd like the chicken, please.",
      vi: "Cho tôi món gà.",
      accept: ["Can I have the chicken please", "I will have the chicken"],
    },
    {
      id: "restaurant.l4",
      en: "What do you recommend?",
      vi: "Bạn gợi ý món nào?",
      accept: ["What do you suggest", "What is good here"],
      note: "Khi không biết gọi gì, hỏi câu này là cách nhanh nhất.",
    },
    {
      id: "restaurant.l5",
      en: "Okay, I'll have the fish.",
      vi: "Được, tôi sẽ lấy món cá.",
      accept: ["I'll have the fish", "The fish please"],
    },
    {
      id: "restaurant.l6",
      en: "Just water, please.",
      vi: "Cho tôi nước lọc thôi.",
      accept: ["Water please", "Only water please"],
    },
    {
      id: "restaurant.l7",
      en: "Thank you very much.",
      vi: "Cảm ơn bạn nhiều.",
      accept: ["Thank you", "Thanks a lot"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hello! Table for how many?",
      npc_vi: "Xin chào! Bàn cho mấy người ạ?",
      replies: [
        { lineId: "restaurant.l1", next: "n2" },
        { lineId: "restaurant.l2", next: "n2" },
      ],
    },
    {
      id: "n2",
      npc_en: "Here is the menu. What would you like?",
      npc_vi: "Thực đơn đây ạ. Bạn muốn dùng gì?",
      replies: [
        { lineId: "restaurant.l3", next: "n4" },
        { lineId: "restaurant.l4", next: "n3" },
      ],
    },
    {
      id: "n3",
      npc_en: "The fish is very good today.",
      npc_vi: "Hôm nay món cá rất ngon.",
      replies: [{ lineId: "restaurant.l5", next: "n4" }],
    },
    {
      id: "n4",
      npc_en: "Anything to drink?",
      npc_vi: "Bạn uống gì không?",
      replies: [{ lineId: "restaurant.l6", next: "n5" }],
    },
    {
      id: "n5",
      npc_en: "Of course. Enjoy your meal!",
      npc_vi: "Vâng ạ. Chúc bạn ngon miệng!",
      replies: [{ lineId: "restaurant.l7", next: null }],
    },
  ],
};
