import { describe, it, expect } from "vitest";
import { memoryLabel, topicLabel } from "@/utils/labels";

describe("topicLabel", () => {
  it("shows the catch-all topic as 'Chung', whatever is stored", () => {
    expect(topicLabel("General Tech")).toBe("Chung");
    expect(topicLabel("  General Tech ")).toBe("Chung");
    expect(topicLabel("")).toBe("Chung");
    expect(topicLabel(null)).toBe("Chung");
    expect(topicLabel(undefined)).toBe("Chung");
  });

  it("keeps a real topic as it is", () => {
    expect(topicLabel("Travel")).toBe("Travel");
    expect(topicLabel(" Work ")).toBe("Work");
  });
});

describe("memoryLabel", () => {
  it("a word without a memory yet is 'Mới'", () => {
    expect(memoryLabel(0)).toBe("Mới");
    expect(memoryLabel(null)).toBe("Mới");
    expect(memoryLabel(undefined)).toBe("Mới");
    expect(memoryLabel(-3)).toBe("Mới");
  });

  it("says days, months or years, never a bare number", () => {
    expect(memoryLabel(0.2)).toBe("nhớ 1 ngày");
    expect(memoryLabel(3.2)).toBe("nhớ 3 ngày");
    expect(memoryLabel(29)).toBe("nhớ 29 ngày");
    expect(memoryLabel(45)).toBe("nhớ 2 tháng");
    expect(memoryLabel(400)).toBe("nhớ 1 năm");
  });
});
