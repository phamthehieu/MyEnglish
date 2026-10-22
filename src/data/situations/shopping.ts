import type { Situation } from "@/types/situation";

export const SHOPPING: Situation = {
  id: "shopping",
  group: "daily",
  title_vi: "Mua đồ ở cửa hàng",
  title_en: "Shopping",
  cefr: "A1",
  goal_vi: "Hỏi giá, hỏi màu khác, mặc cả nhẹ và chọn cách trả tiền.",
  partner_vi: "Nhân viên cửa hàng",
  partner_emoji: "🛍️",
  lines: [
    {
      id: "shopping.l1",
      en: "How much is this?",
      vi: "Cái này giá bao nhiêu?",
      accept: ["How much is it", "How much does this cost"],
    },
    {
      id: "shopping.l2",
      en: "Do you have this in blue?",
      vi: "Cái này có màu xanh không?",
      accept: ["Do you have it in blue", "Do you have blue"],
    },
    {
      id: "shopping.l3",
      en: "That's too expensive.",
      vi: "Đắt quá.",
      accept: ["It is too expensive", "Too expensive"],
    },
    {
      id: "shopping.l4",
      en: "Okay, I'll take it.",
      vi: "Được, tôi lấy cái này.",
      accept: ["I'll take it", "I will take it"],
    },
    {
      id: "shopping.l5",
      en: "No, thank you.",
      vi: "Thôi, cảm ơn bạn.",
      accept: ["No thanks", "No thanks a lot"],
      note: "Từ chối lịch sự khi không muốn mua.",
    },
    {
      id: "shopping.l6",
      en: "By card, please.",
      vi: "Tôi trả bằng thẻ.",
      accept: ["Card please", "I'll pay by card"],
    },
    {
      id: "shopping.l7",
      en: "Cash, please.",
      vi: "Tôi trả tiền mặt.",
      accept: ["I'll pay cash", "By cash please"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi! Can I help you?",
      npc_vi: "Chào bạn! Tôi giúp gì được không?",
      replies: [
        { lineId: "shopping.l1", next: "n2" },
        { lineId: "shopping.l2", next: "n3" },
      ],
    },
    {
      id: "n2",
      npc_en: "It's twenty dollars.",
      npc_vi: "Hai mươi đô ạ.",
      replies: [
        { lineId: "shopping.l3", next: "n4" },
        { lineId: "shopping.l4", next: "n5" },
      ],
    },
    {
      id: "n3",
      npc_en: "Yes, we do. It's twenty dollars.",
      npc_vi: "Có ạ. Giá hai mươi đô.",
      replies: [
        { lineId: "shopping.l3", next: "n4" },
        { lineId: "shopping.l4", next: "n5" },
      ],
    },
    {
      id: "n4",
      npc_en: "Sorry. I can give you a small discount.",
      npc_vi: "Xin lỗi bạn. Tôi giảm cho bạn một chút nhé.",
      replies: [
        { lineId: "shopping.l4", next: "n5" },
        { lineId: "shopping.l5", next: null },
      ],
    },
    {
      id: "n5",
      npc_en: "Great! Cash or card?",
      npc_vi: "Tuyệt! Bạn trả tiền mặt hay thẻ?",
      replies: [
        { lineId: "shopping.l6", next: null },
        { lineId: "shopping.l7", next: null },
      ],
    },
  ],
};
