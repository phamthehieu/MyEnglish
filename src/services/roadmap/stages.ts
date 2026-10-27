import type { Pattern, PatternGoal, PatternLevel } from "@/types/pattern";

/** "Lộ trình nói": the sentence patterns of a level as a path of stages, one topic per stage */

export type RoadmapGoal = PatternGoal | "all";

export const GOAL_LABEL: Record<RoadmapGoal, string> = {
  travel: "Du lịch",
  work: "Đi làm",
  daily: "Đời sống hằng ngày",
  social: "Kết bạn, giao lưu",
  all: "Tất cả chủ đề",
};

/** The conversation of each topic (all of them are in src/data/situations); A1 has one for every topic, the other levels for most */
export const STAGE_CONVERSATION: Record<string, string> = {
  "greetings-introductions": "introduce-yourself",
  family: "talking-about-family-a1",
  "personal-info": "birthday-date-a1",
  "food-drink-ordering": "cafe-order",
  "food-likes": "cooking-rice-with-grandma-a1",
  "shopping-prices": "price-of-shoes-a1",
  "directions-places": "ask-direction",
  transport: "bus-to-the-park-a1",
  "travel-tickets": "buying-a-train-ticket-a1",
  "time-dates": "telling-the-time-a1",
  weather: "talking-about-weather-a1",
  "daily-routine": "morning-routine-a1",
  "health-body": "toothache-at-dentist-a1",
  feelings: "stomachache-at-home-a1",
  "emergency-help": "ask-for-help",
  "home-things": "describing-my-house-a1",
  "clothes-colors": "buying-a-shirt-a1",
  "hobbies-free-time": "football-on-sunday-a1",
  "jobs-work": "what-do-you-do-a1",
  "school-study": "first-day-at-school-a1",
  "phone-internet": "phone-battery-low-a1",
  "plans-invitations": "visiting-a-friend-home-a1",
  "asking-for-help-repeating": "asking-the-teacher-a1",
  "hotel-accommodation": "hotel-check-in-a1",
  // A2 (a stage without a conversation simply has no conversation part)
  "a2-past-weekend": "bike-ride-to-the-lake-a2",
  "a2-past-trips": "beach-trip-story-a2",
  "a2-future-plans": "new-year-plans-a2",
  "a2-work-intro": "daily-standup",
  "a2-work-schedule": "online-meeting",
  "a2-work-requests": "ask-colleague",
  "a2-phone-calls": "dentist-appointment-by-phone-a2",
  "a2-doctor-health": "seeing-the-doctor-with-fever-a2",
  "a2-pharmacy": "pharmacy-a2",
  "a2-bank-post": "opening-a-bank-account-a2",
  "a2-restaurant-requests": "ordering-pizza-delivery-a2",
  "a2-shopping-compare": "buying-a-gift-for-mom-a2",
  "a2-returns-complaints": "returning-shoes-a2",
  "a2-travel-booking": "booking-a-taxi-to-the-airport-a2",
  "a2-airport-hotel": "airport-check-in-a2",
  "a2-opinions": "talking-about-a-film-a2",
  "a2-likes-reasons": "favorite-music-a2",
  "a2-describing": "describing-my-family-a2",
  "a2-invitations": "invitation-to-birthday-party-a2",
  "a2-experiences": "talking-about-hobbies-a2",
  "a2-home-neighbors": "meeting-a-new-neighbor-a2",
  // B1
  "b1-past-stories": "coffee-break-hiking-chat-b1",
  "b1-advice": "advice-about-studying-abroad-b1",
  "b1-suggestions": "planning-a-study-group-b1",
  "b1-preferences": "choosing-an-evening-course-b1",
  "b1-job-interview": "job-interview-strengths-b1",
  "b1-meetings": "deciding-which-task-first-b1",
  "b1-presentations": "practicing-a-short-presentation-b1",
  "b1-reports-updates": "correcting-a-report-mistake-b1",
  "b1-deadlines": "asking-for-a-longer-deadline-b1",
  "b1-customer-service": "returning-a-faulty-blender-b1",
  "b1-travel-problems": "flight-delayed-at-the-airport-b1",
  "b1-renting-booking": "wrong-hotel-booking-b1",
  "b1-opinions-reasons": "discussing-a-bus-lane-in-the-news-b1",
  "b1-agree-disagree": "disagreeing-about-a-launch-date-b1",
  "b1-reporting-speech": "taking-a-phone-message-b1",
  "b1-conditionals": "thinking-about-a-job-offer-b1",
  "b1-health-lifestyle": "doctor-visit-for-a-headache-b1",
  "b1-technology": "fixing-a-projector-before-a-talk-b1",
  "b1-feelings-reactions": "talking-about-a-mystery-novel-b1",
  "b1-plans-hopes": "organizing-a-farewell-party-b1",
  "b1-polite-questions": "asking-to-work-from-home-b1",
};

/** Minutes each part of a stage takes (an estimate, used to fit a day to the minutes the learner chose) */
export const MINUTES = { learn: 2, substitute: 2, tiles: 2, rapid: 1.5, test: 3, conversation: 4 } as const;
/** The stage that always comes first: you have to say who you are before anything else */
const FIRST_TOPIC = "greetings-introductions";
const SKIP_WORDS = new Set(["a", "an", "the", "some", "any", "my", "your", "this", "that", "these", "those"]);

export interface Stage {
  /** The topic slug (topics of a level above A1 start with the level: "a2-past-trips") */
  id: string;
  level: PatternLevel;
  title: string;
  patterns: Pattern[];
  /** The words of the blanks of this stage, to meet again in its sentences */
  words: string[];
  conversationId?: string;
  /** About how long the whole stage takes, in minutes */
  minutes: number;
}

/** How well a topic fits a goal: the share of its patterns tagged with it, then how many */
function fit(patterns: readonly Pattern[], goal: PatternGoal): [number, number] {
  const n = patterns.filter((p) => p.goals.includes(goal)).length;
  return [n / patterns.length, n];
}

/** The stages of a level for a goal: greetings first, then the topics that serve the goal best (all of them, in file order, for "all") */
export function buildStages(patterns: readonly Pattern[], goal: RoadmapGoal): Stage[] {
  const byTopic = new Map<string, Pattern[]>();
  for (const p of patterns) byTopic.set(p.topic, [...(byTopic.get(p.topic) ?? []), p]);
  let topics = [...byTopic.entries()];
  if (goal !== "all") {
    const rank = (list: Pattern[]) => fit(list, goal);
    topics = topics
      .map((t, i) => ({ t, i }))
      .sort((a, b) => {
        if (a.t[0] === FIRST_TOPIC) return -1;
        if (b.t[0] === FIRST_TOPIC) return 1;
        const [ra, na] = rank(a.t[1]);
        const [rb, nb] = rank(b.t[1]);
        return rb - ra || nb - na || a.i - b.i;
      })
      .map((x) => x.t);
  }
  return topics.map(([topic, list]) => {
    const words = [...new Set(list.flatMap((p) => p.slots.flatMap((s) => s.en.toLowerCase().match(/[a-z']+/g) ?? [])))].filter((w) => !SKIP_WORDS.has(w));
    const minutes = (list.length * (MINUTES.learn + MINUTES.substitute + MINUTES.tiles + MINUTES.rapid) + MINUTES.test + MINUTES.conversation) * 1.2;
    return { id: topic, level: list[0].level, title: list[0].topic_vi, patterns: list, words, conversationId: STAGE_CONVERSATION[topic], minutes: Math.round(minutes) };
  });
}

/**
 * The whole path: the stages of each level in turn, each level ordered for the goal. It starts at `fromLevel` (the
 * lowest level the learner studies; A1 when not given); when there are no sentences at that level yet, it starts at
 * the highest level there is.
 */
export function buildPathStages(patterns: readonly Pattern[], goal: RoadmapGoal, fromLevel?: string | null): Stage[] {
  const levels = [...new Set(patterns.map((p) => p.level))].sort();
  const at = fromLevel ? levels.findIndex((l) => l >= fromLevel) : 0;
  return levels.slice(at === -1 ? levels.length - 1 : at).flatMap((level) => buildStages(patterns.filter((p) => p.level === level), goal));
}

/** Days to finish `stages` at `minutesPerDay` */
export const estimateDays = (stages: readonly Stage[], minutesPerDay: number): number =>
  Math.ceil(stages.reduce((a, s) => a + s.minutes, 0) / Math.max(1, minutesPerDay));
