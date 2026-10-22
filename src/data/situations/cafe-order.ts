import type { Situation } from "@/types/situation";

export const CAFE_ORDER: Situation = {
  id: "cafe-order",
  group: "daily",
  title_vi: "Gọi đồ ở quán cà phê",
  title_en: "Ordering at a café",
  cefr: "A1",
  goal_vi: "Gọi được một ly cà phê, nói cỡ ly, và trả tiền.",
  partner_vi: "Nhân viên quán",
  partner_emoji: "☕",
  lines: [
    {
      id: "cafe-order.l1",
      en: "Can I have a coffee, please?",
      vi: "Cho tôi một ly cà phê nhé?",
      accept: ["I'd like a coffee, please", "A coffee, please"],
      note: "Câu gọi đồ thông dụng nhất. 'Can I have...' lịch sự, dùng được ở mọi quán.",
    },
    {
      id: "cafe-order.l2",
      en: "A large one, please.",
      vi: "Cho tôi ly lớn.",
      accept: ["Large, please", "I'd like a large one"],
      note: "'one' thay cho 'coffee', không cần nhắc lại.",
    },
    {
      id: "cafe-order.l3",
      en: "A small one, please.",
      vi: "Cho tôi ly nhỏ.",
      accept: ["Small, please", "I'd like a small one"],
    },
    {
      id: "cafe-order.l4",
      en: "No, that's all.",
      vi: "Không, vậy là đủ rồi.",
      accept: ["That's all", "No, thank you", "No, that is all"],
      note: "Trả lời khi được hỏi 'Anything else?' (Còn gì nữa không?).",
    },
    {
      id: "cafe-order.l5",
      en: "Can I have a sandwich too?",
      vi: "Cho tôi thêm một cái bánh sandwich nhé?",
      accept: ["I'd like a sandwich too", "A sandwich too, please"],
    },
    {
      id: "cafe-order.l6",
      en: "To go, please.",
      vi: "Cho tôi mang đi.",
      accept: ["To go", "Take away, please"],
      note: "'To go' là mang đi. Người Anh hay nói 'takeaway'.",
    },
    {
      id: "cafe-order.l7",
      en: "I'll have it here.",
      vi: "Tôi dùng tại quán.",
      accept: ["For here, please", "I'll drink it here"],
    },
    {
      id: "cafe-order.l8",
      en: "Thank you very much.",
      vi: "Cảm ơn bạn nhiều.",
      accept: ["Thank you", "Thanks a lot"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi! What can I get for you?",
      npc_vi: "Chào bạn! Bạn muốn dùng gì?",
      replies: [{ lineId: "cafe-order.l1", next: "n2" }],
    },
    {
      id: "n2",
      npc_en: "Sure. What size would you like?",
      npc_vi: "Vâng. Bạn muốn cỡ nào?",
      replies: [
        { lineId: "cafe-order.l2", next: "n3" },
        { lineId: "cafe-order.l3", next: "n3" },
      ],
    },
    {
      id: "n3",
      npc_en: "Anything else?",
      npc_vi: "Bạn cần gì thêm không?",
      replies: [
        { lineId: "cafe-order.l4", next: "n4" },
        { lineId: "cafe-order.l5", next: "n4" },
      ],
    },
    {
      id: "n4",
      npc_en: "That's five dollars. Here or to go?",
      npc_vi: "Tất cả năm đô. Dùng tại quán hay mang đi?",
      replies: [
        { lineId: "cafe-order.l6", next: "n5" },
        { lineId: "cafe-order.l7", next: "n5" },
      ],
    },
    {
      id: "n5",
      npc_en: "Here you go. Enjoy!",
      npc_vi: "Của bạn đây. Chúc ngon miệng!",
      replies: [{ lineId: "cafe-order.l8", next: null }],
    },
  ],
};
