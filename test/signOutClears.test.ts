import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Signing out (authStore.signOut): everything saved to the account first, then the machine cleared; when not
 * everything could be saved, the data stays and the learner is told why.
 */
const finishBeforeSignOut = vi.fn();
const resetAllAppData = vi.fn();
const forgetAccount = vi.fn();
const authSignOut = vi.fn();

vi.mock("@/services/sync/manager", () => ({ finishBeforeSignOut }));
vi.mock("@/services/appReset", () => ({ resetAllAppData }));
vi.mock("@/services/sync/engine", () => ({ forgetAccount }));
vi.mock("@/services/supabase", () => ({
  getSupabase: () => ({ auth: { signOut: authSignOut } }),
  isCloudConfigured: () => true,
}));

const reload = vi.fn();

beforeEach(() => {
  vi.resetModules();
  for (const f of [finishBeforeSignOut, resetAllAppData, forgetAccount, authSignOut, reload]) f.mockReset();
  authSignOut.mockResolvedValue({ error: null });
  forgetAccount.mockResolvedValue(undefined);
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
});

async function signedIn() {
  const { useAuthStore } = await import("@/stores/authStore");
  useAuthStore.setState({ user: { id: "u1", email: "a@b.c" } });
  return useAuthStore;
}

describe("signing out", () => {
  it("clears the machine once everything is on the account, then starts the app again", async () => {
    finishBeforeSignOut.mockResolvedValue(null);
    resetAllAppData.mockResolvedValue(true);
    const store = await signedIn();
    await store.getState().signOut();
    expect(resetAllAppData).toHaveBeenCalledWith({ keepCloud: true });
    expect(forgetAccount).not.toHaveBeenCalled();
    expect(authSignOut).toHaveBeenCalled();
    expect(store.getState().user).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it("keeps the data when it could not all be saved, and says so", async () => {
    finishBeforeSignOut.mockResolvedValue("Chưa lưu được lên tài khoản (có thể do mất mạng), nên dữ liệu học vẫn được giữ trên máy này.");
    const store = await signedIn();
    await store.getState().signOut();
    expect(resetAllAppData).not.toHaveBeenCalled();
    expect(forgetAccount).toHaveBeenCalled(); // still tied to this account: another one is asked first
    expect(store.getState().user).toBeNull();
    expect(store.getState().notice).toMatch(/^Đã đăng xuất\. Chưa lưu được/);
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps the data when clearing the machine failed", async () => {
    finishBeforeSignOut.mockResolvedValue(null);
    resetAllAppData.mockResolvedValue(false);
    const store = await signedIn();
    await store.getState().signOut();
    expect(store.getState().notice).toMatch(/vẫn còn ở đây/);
    expect(forgetAccount).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("still signs out here when the network is gone", async () => {
    finishBeforeSignOut.mockResolvedValue("offline");
    authSignOut.mockImplementation(async (opts?: { scope?: string }) => {
      if (opts?.scope !== "local") throw new Error("Failed to fetch");
      return { error: null };
    });
    const store = await signedIn();
    await store.getState().signOut();
    expect(authSignOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(store.getState().user).toBeNull();
  });
});
