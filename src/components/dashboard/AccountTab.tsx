import { Trophy } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "../ui/kit";
import AccountSettings from "./AccountSettings";
import { PAGE_CONTAINER } from "./shared";

/** The account screen: sign in / up, sync state, and a way into the leaderboard */
export default function AccountTab({ onOpenLeaderboard }: { onOpenLeaderboard?: () => void }) {
  const signedIn = useAuthStore((s) => !!s.user);
  return (
    <div className={PAGE_CONTAINER}>
      <div className="space-y-4 max-w-2xl">
        <p className="text-sm text-slate-500 dark:text-zinc-400">Đăng nhập, đồng bộ tiến trình giữa các máy và đua XP với bạn bè.</p>
        <AccountSettings />
        {signedIn && onOpenLeaderboard && (
          <Button variant="secondary" onClick={onOpenLeaderboard}>
            <Trophy className="w-5 h-5" /> Xem bảng xếp hạng
          </Button>
        )}
      </div>
    </div>
  );
}
