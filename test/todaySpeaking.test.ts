import { describe, expect, it } from "vitest";
import { buildTodayTasks, primaryTask, TASK_TAB } from "@/components/dashboard/todayPlan";

const base = { minutes: 10 as const, vocab: { reviews: 3, newToday: 2, minutes: 4 }, grammar: null, pronunciation: null };

describe("the speaking path in today's list", () => {
  it("is the first thing of the list, then the words", () => {
    const tasks = buildTodayTasks({ ...base, speaking: { title: "Lộ trình nói: Gọi món", detail: "Chặng 4/48", minutes: 8, done: false } });
    expect(tasks.map((t) => t.id)).toEqual(["speaking", "vocab"]);
    expect(primaryTask(tasks)?.id).toBe("speaking");
  });

  it("hands the main button to the words when the day's part of the path is done", () => {
    const tasks = buildTodayTasks({ ...base, speaking: { title: "Lộ trình nói", detail: "Xong phần hôm nay", minutes: 0, done: true } });
    expect(primaryTask(tasks)?.id).toBe("vocab");
  });

  it("leaves the list as it was when there is no path", () => {
    expect(buildTodayTasks(base).map((t) => t.id)).toEqual(["vocab"]);
    expect(buildTodayTasks({ ...base, speaking: null }).map((t) => t.id)).toEqual(["vocab"]);
  });

  it("does not push a new lesson of the grammar book on a learner of the path, but keeps reviews, redos and what was done today", () => {
    const speaking = { title: "Lộ trình nói", detail: "Chặng 1/48", minutes: 8, done: false, onPath: true };
    const grammar = { due: 0, studiedToday: false, nextTitle: "Thì hiện tại đơn", relearnTitle: null };
    const ids = (g: typeof grammar, s: typeof speaking | null) => buildTodayTasks({ ...base, speaking: s, grammar: g }).map((t) => t.id);
    expect(ids(grammar, speaking)).toEqual(["speaking", "vocab"]);
    expect(ids({ ...grammar, due: 2 }, speaking)).toContain("grammar");
    expect(ids({ ...grammar, relearnTitle: "Thì quá khứ đơn" }, speaking)).toContain("grammar");
    expect(ids({ ...grammar, studiedToday: true }, speaking)).toContain("grammar");
    // Without the path, the new lesson is offered as before
    expect(ids(grammar, null)).toContain("grammar");
  });

  it("opens the path's tab", () => {
    expect(TASK_TAB.speaking).toBe("patterns");
  });
});
