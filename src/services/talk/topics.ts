import type { SituationGroup } from "@/types/situation";

/**
 * Topics the AI can write a conversation for. None repeats a built-in conversation (src/data/situations):
 * café, introductions, directions, restaurant, shopping, asking for help, weekend small talk, stand-up,
 * asking a colleague, online meeting. `topic` is the English description given to the model.
 */
export interface TalkTopic {
  id: string;
  group: SituationGroup;
  topic: string;
}

export const TALK_TOPICS: TalkTopic[] = [
  { id: "hotel-checkin", group: "daily", topic: "checking in at a hotel" },
  { id: "taxi", group: "daily", topic: "taking a taxi to a place" },
  { id: "train-ticket", group: "daily", topic: "buying a train or bus ticket" },
  { id: "pharmacy", group: "daily", topic: "buying medicine at a pharmacy" },
  { id: "doctor", group: "daily", topic: "telling a doctor what is wrong" },
  { id: "phone-booking", group: "daily", topic: "booking a table or a room by phone" },
  { id: "food-delivery", group: "daily", topic: "ordering food for delivery" },
  { id: "rent-room", group: "daily", topic: "asking about renting a room" },
  { id: "airport", group: "daily", topic: "checking in at the airport" },
  { id: "supermarket", group: "daily", topic: "finding things in a supermarket" },
  { id: "haircut", group: "daily", topic: "getting a haircut" },
  { id: "weather-plans", group: "daily", topic: "talking about the weather and plans for the day" },
  { id: "borrow", group: "daily", topic: "borrowing something from a neighbor" },
  { id: "invite-friend", group: "daily", topic: "inviting a friend to do something" },
  { id: "return-item", group: "daily", topic: "returning something to a shop" },
  { id: "ask-time", group: "daily", topic: "asking the time and when something starts" },
  { id: "hobbies", group: "daily", topic: "talking about hobbies and free time" },
  { id: "family", group: "daily", topic: "talking about your family" },
  { id: "job-interview", group: "work", topic: "a short job interview" },
  { id: "ask-leave", group: "work", topic: "asking your manager for a day off" },
  { id: "explain-delay", group: "work", topic: "explaining why a task is late" },
  { id: "present-intro", group: "work", topic: "starting a short presentation" },
  { id: "ask-feedback", group: "work", topic: "asking a colleague for feedback" },
  { id: "code-review", group: "work", topic: "talking about a code review comment" },
  { id: "report-bug", group: "work", topic: "reporting a bug to a tester" },
  { id: "schedule-meeting", group: "work", topic: "finding a time for a meeting" },
  { id: "say-no", group: "work", topic: "politely saying no to an extra task" },
  { id: "client-call", group: "work", topic: "a short phone call with a client" },
  { id: "first-day", group: "work", topic: "your first day at a new job" },
  { id: "extend-deadline", group: "work", topic: "asking for more time to finish" },
  { id: "lunch-colleagues", group: "work", topic: "having lunch with colleagues" },
  { id: "meeting-wrapup", group: "work", topic: "ending a meeting and agreeing next steps" },
];

/** What the model is asked for when every topic above has already been used */
export const FREE_TOPIC: TalkTopic = {
  id: "free",
  group: "daily",
  topic: "any other useful everyday situation that is clearly different from the existing ones",
};

/** A topic that no conversation of the learner was written for yet; `random` picks among them */
export function pickTopic(usedTopicIds: ReadonlySet<string>, random: () => number = Math.random): TalkTopic {
  const free = TALK_TOPICS.filter((t) => !usedTopicIds.has(t.id));
  if (free.length === 0) return FREE_TOPIC;
  return free[Math.floor(random() * free.length)];
}
