import type { Situation } from "@/types/situation";

export const ASK_COLLEAGUE: Situation = {
  id: "ask-colleague",
  group: "work",
  title_vi: "Nhờ đồng nghiệp giúp",
  title_en: "Asking a colleague for help",
  cefr: "A2",
  goal_vi: "Xin đồng nghiệp chút thời gian, nói bạn gặp vấn đề gì và cảm ơn.",
  partner_vi: "Đồng nghiệp",
  partner_emoji: "🧑‍💻",
  lines: [
    {
      id: "ask-colleague.l1",
      en: "Do you have a minute?",
      vi: "Bạn có rảnh một phút không?",
      accept: ["Have you got a minute", "Do you have a moment"],
      note: "Cách mở lời lịch sự trước khi nhờ ai đó.",
    },
    {
      id: "ask-colleague.l2",
      en: "I have a problem with this code.",
      vi: "Tôi gặp vấn đề với đoạn mã này.",
      accept: ["I have a problem with the code", "I'm having a problem with this code"],
    },
    {
      id: "ask-colleague.l3",
      en: "I can't open this file.",
      vi: "Tôi không mở được tệp này.",
      accept: ["I cannot open this file", "I can't open the file"],
    },
    {
      id: "ask-colleague.l4",
      en: "Yes, here is the error message.",
      vi: "Có, đây là thông báo lỗi.",
      accept: ["Here is the error message", "Yes this is the error message"],
    },
    {
      id: "ask-colleague.l5",
      en: "Let me send it to you.",
      vi: "Để tôi gửi cho bạn.",
      accept: ["I will send it to you", "I'll send it to you"],
    },
    {
      id: "ask-colleague.l6",
      en: "Okay, I'll try that.",
      vi: "Được, tôi sẽ thử.",
      accept: ["I will try that", "Okay let me try"],
    },
    {
      id: "ask-colleague.l7",
      en: "Yes, it works now. Thank you!",
      vi: "Được rồi, giờ chạy rồi. Cảm ơn bạn!",
      accept: ["It works now thanks", "It works thanks"],
    },
    {
      id: "ask-colleague.l8",
      en: "No, it still doesn't work.",
      vi: "Chưa, vẫn chưa chạy.",
      accept: ["No it still does not work", "It still doesn't work"],
    },
    {
      id: "ask-colleague.l9",
      en: "Thank you for your help.",
      vi: "Cảm ơn bạn đã giúp.",
      accept: ["Thanks for your help", "Thank you for helping me"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hey, you look busy. What's up?",
      npc_vi: "Này, trông bạn bận đấy. Có chuyện gì thế?",
      replies: [{ lineId: "ask-colleague.l1", next: "n2" }],
    },
    {
      id: "n2",
      npc_en: "Sure. What do you need?",
      npc_vi: "Được chứ. Bạn cần gì?",
      replies: [
        { lineId: "ask-colleague.l2", next: "n3" },
        { lineId: "ask-colleague.l3", next: "n3" },
      ],
    },
    {
      id: "n3",
      npc_en: "Okay. Can you show me the error?",
      npc_vi: "Được. Bạn cho mình xem lỗi được không?",
      replies: [
        { lineId: "ask-colleague.l4", next: "n4" },
        { lineId: "ask-colleague.l5", next: "n4" },
      ],
    },
    {
      id: "n4",
      npc_en: "I see. Try to restart the app.",
      npc_vi: "Mình hiểu rồi. Bạn thử khởi động lại ứng dụng đi.",
      replies: [{ lineId: "ask-colleague.l6", next: "n5" }],
    },
    {
      id: "n5",
      npc_en: "Is it working now?",
      npc_vi: "Giờ chạy được chưa?",
      replies: [
        { lineId: "ask-colleague.l7", next: null },
        { lineId: "ask-colleague.l8", next: "n6" },
      ],
    },
    {
      id: "n6",
      npc_en: "Let's try another way together.",
      npc_vi: "Mình cùng thử cách khác nhé.",
      replies: [{ lineId: "ask-colleague.l9", next: null }],
    },
  ],
};
