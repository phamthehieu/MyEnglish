import type { Situation } from "@/types/situation";

export const INTRODUCE_YOURSELF: Situation = {
  id: "introduce-yourself",
  group: "daily",
  title_vi: "Tự giới thiệu",
  title_en: "Introducing yourself",
  cefr: "A1",
  goal_vi: "Nói được tên, bạn đến từ đâu và bạn làm gì.",
  partner_vi: "Người bạn mới",
  partner_emoji: "🙂",
  lines: [
    {
      id: "introduce-yourself.l1",
      en: "My name is Minh.",
      vi: "Tên tôi là Minh.",
      accept: ["I'm Minh", "I am Minh"],
      note: "Thay 'Minh' bằng tên của bạn khi nói thật.",
    },
    {
      id: "introduce-yourself.l2",
      en: "I'm from Vietnam.",
      vi: "Tôi đến từ Việt Nam.",
      accept: ["I am from Vietnam", "I come from Vietnam"],
    },
    {
      id: "introduce-yourself.l3",
      en: "I'm a software engineer.",
      vi: "Tôi là kỹ sư phần mềm.",
      accept: ["I am a software engineer", "I work with computers"],
    },
    {
      id: "introduce-yourself.l4",
      en: "I'm a student.",
      vi: "Tôi là sinh viên.",
      accept: ["I am a student"],
    },
    {
      id: "introduce-yourself.l5",
      en: "Nice to meet you too.",
      vi: "Tôi cũng rất vui được gặp bạn.",
      accept: ["Nice to meet you", "You too"],
    },
  ],
  dialogue: [
    {
      id: "n1",
      npc_en: "Hi! I'm Anna. What's your name?",
      npc_vi: "Chào! Mình là Anna. Bạn tên gì?",
      replies: [{ lineId: "introduce-yourself.l1", next: "n2" }],
    },
    {
      id: "n2",
      npc_en: "Nice to meet you. Where are you from?",
      npc_vi: "Rất vui được gặp bạn. Bạn đến từ đâu?",
      replies: [{ lineId: "introduce-yourself.l2", next: "n3" }],
    },
    {
      id: "n3",
      npc_en: "Cool! What do you do?",
      npc_vi: "Hay quá! Bạn làm nghề gì?",
      replies: [
        { lineId: "introduce-yourself.l3", next: "n4" },
        { lineId: "introduce-yourself.l4", next: "n4" },
      ],
    },
    {
      id: "n4",
      npc_en: "That sounds great. Nice talking to you!",
      npc_vi: "Nghe thú vị đấy. Rất vui được nói chuyện với bạn!",
      replies: [{ lineId: "introduce-yourself.l5", next: null }],
    },
  ],
};
