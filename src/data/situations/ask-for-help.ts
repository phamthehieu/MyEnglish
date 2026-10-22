import type { Situation } from "@/types/situation";

export const ASK_FOR_HELP: Situation = {
  id: "ask-for-help",
  group: "daily",
  title_vi: "Nhờ người khác giúp",
  title_en: "Asking for help",
  cefr: "A1",
  goal_vi: "Nhờ giúp đỡ, nói khi không hiểu, và nói khi bị mất đồ.",
  partner_vi: "Người lạ tốt bụng",
  partner_emoji: "🙋",
  lines: [
    {
      id: "ask-for-help.l1",
      en: "Can you help me, please?",
      vi: "Bạn giúp tôi được không?",
      accept: ["Could you help me", "Excuse me can you help me"],
    },
    {
      id: "ask-for-help.l2",
      en: "I don't understand.",
      vi: "Tôi không hiểu.",
      accept: ["I do not understand", "I don't understand this"],
      note: "Nói thẳng khi không hiểu là tốt. Người nghe sẽ nói chậm lại.",
    },
    {
      id: "ask-for-help.l3",
      en: "I lost my phone.",
      vi: "Tôi bị mất điện thoại.",
      accept: ["I have lost my phone", "I lost my phone here"],
    },
    {
      id: "ask-for-help.l4",
      en: "Thank you. I understand now.",
      vi: "Cảm ơn bạn. Giờ tôi hiểu rồi.",
      accept: ["Thanks I understand now", "I understand now thank you"],
    },
    {
      id: "ask-for-help.l5",
      en: "Thank you so much.",
      vi: "Cảm ơn bạn nhiều lắm.",
      accept: ["Thank you", "Thanks a lot"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi. You look lost. Are you okay?",
      npc_vi: "Chào bạn. Trông bạn có vẻ lạc đường. Bạn ổn chứ?",
      replies: [{ lineId: "ask-for-help.l1", next: "n2" }],
    },
    {
      id: "n2",
      npc_en: "Of course. What's the problem?",
      npc_vi: "Tất nhiên rồi. Bạn gặp vấn đề gì?",
      replies: [
        { lineId: "ask-for-help.l2", next: "n3" },
        { lineId: "ask-for-help.l3", next: "n4" },
      ],
    },
    {
      id: "n3",
      npc_en: "Sorry. Let me say it again, slowly.",
      npc_vi: "Xin lỗi. Để tôi nói lại, chậm hơn.",
      replies: [{ lineId: "ask-for-help.l4", next: null }],
    },
    {
      id: "n4",
      npc_en: "Oh no! Let's look for it together.",
      npc_vi: "Ôi không! Mình cùng tìm nhé.",
      replies: [{ lineId: "ask-for-help.l5", next: null }],
    },
  ],
};
