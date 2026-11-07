import { describe, expect, it } from "vitest";
import { dispatchBackNavigation, registerBackHandler } from "../backNavigation";

describe("backNavigation", () => {
  it("returns exit when no handlers are registered", () => {
    expect(dispatchBackNavigation()).toBe("exit");
  });

  it("executes handlers in LIFO order and stops when a handler consumes the event", () => {
    const calls: string[] = [];
    const unregRoot = registerBackHandler(() => {
      calls.push("root");
      return true;
    });
    const unregChild = registerBackHandler(() => {
      calls.push("child");
      return true;
    });

    expect(dispatchBackNavigation()).toBe("handled");
    expect(calls).toEqual(["child"]);

    unregChild();
    expect(dispatchBackNavigation()).toBe("handled");
    expect(calls).toEqual(["child", "root"]);

    unregRoot();
    expect(dispatchBackNavigation()).toBe("exit");
  });

  it("falls through to parent handler when child returns false", () => {
    const calls: string[] = [];
    const unregRoot = registerBackHandler(() => {
      calls.push("root");
      return true;
    });
    const unregPass = registerBackHandler(() => {
      calls.push("pass");
      return false;
    });

    expect(dispatchBackNavigation()).toBe("handled");
    expect(calls).toEqual(["pass", "root"]);

    unregPass();
    unregRoot();
  });
});
