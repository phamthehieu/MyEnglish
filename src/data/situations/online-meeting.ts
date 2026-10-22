import type { Situation } from "@/types/situation";

export const ONLINE_MEETING: Situation = {
  id: "online-meeting",
  group: "work",
  title_vi: "Họp trực tuyến",
  title_en: "An online meeting",
  cefr: "A2",
  goal_vi: "Nói bạn nghe được hay không, nhờ chia sẻ màn hình, và sẵn sàng bắt đầu.",
  partner_vi: "Đồng nghiệp trong cuộc họp",
  partner_emoji: "💻",
  lines: [
    {
      id: "online-meeting.l1",
      en: "Yes, I can hear you.",
      vi: "Có, tôi nghe được.",
      accept: ["Yes I hear you", "I can hear you"],
    },
    {
      id: "online-meeting.l2",
      en: "Sorry, I can't hear you.",
      vi: "Xin lỗi, tôi không nghe thấy bạn.",
      accept: ["Sorry I cannot hear you", "I can't hear you"],
      note: "Báo ngay khi không nghe được, đừng chờ.",
    },
    {
      id: "online-meeting.l3",
      en: "Can you share your screen, please?",
      vi: "Bạn chia sẻ màn hình được không?",
      accept: ["Please share your screen", "Could you share your screen"],
    },
    {
      id: "online-meeting.l4",
      en: "Yes, it's better now.",
      vi: "Có, giờ tốt hơn rồi.",
      accept: ["Yes it is better now", "It's better now"],
    },
    {
      id: "online-meeting.l5",
      en: "No, I'm ready.",
      vi: "Không, tôi sẵn sàng rồi.",
      accept: ["No I am ready", "I'm ready"],
    },
    {
      id: "online-meeting.l6",
      en: "Yes, I can see it.",
      vi: "Có, tôi thấy rồi.",
      accept: ["I can see it", "Yes I see it"],
    },
    {
      id: "online-meeting.l7",
      en: "Okay, thank you.",
      vi: "Được, cảm ơn bạn.",
      accept: ["Okay thanks", "Thank you"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi everyone. Can you hear me?",
      npc_vi: "Chào mọi người. Mọi người nghe được mình không?",
      replies: [
        { lineId: "online-meeting.l1", next: "n3" },
        { lineId: "online-meeting.l2", next: "n2" },
      ],
    },
    {
      id: "n2",
      npc_en: "Oh, sorry. Is it better now?",
      npc_vi: "Ôi, xin lỗi. Giờ đỡ hơn chưa?",
      replies: [{ lineId: "online-meeting.l4", next: "n3" }],
    },
    {
      id: "n3",
      npc_en: "Great, let's start. Any questions before we begin?",
      npc_vi: "Tốt, mình bắt đầu nhé. Có câu hỏi nào trước khi bắt đầu không?",
      replies: [
        { lineId: "online-meeting.l3", next: "n4" },
        { lineId: "online-meeting.l5", next: "n5" },
      ],
    },
    {
      id: "n4",
      npc_en: "Sure. Can you see my screen?",
      npc_vi: "Được thôi. Bạn thấy màn hình của mình chưa?",
      replies: [{ lineId: "online-meeting.l6", next: "n5" }],
    },
    {
      id: "n5",
      npc_en: "Perfect. Let's begin.",
      npc_vi: "Tuyệt. Mình bắt đầu nhé.",
      replies: [{ lineId: "online-meeting.l7", next: null }],
    },
  ],
};
