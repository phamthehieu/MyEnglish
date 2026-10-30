import { Button, Card } from "./ui/kit";

/** The web app is already open in another tab: one tab at a time, or the two would overwrite each other's progress */
export default function OpenElsewhere({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4 dark:bg-zinc-950">
      <Card className="w-full max-w-sm space-y-4 text-center">
        <div className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Đang mở ở tab khác</div>
        <p className="text-base text-slate-700 dark:text-zinc-300">{message}</p>
        <Button block onClick={() => window.location.reload()}>
          Tải lại
        </Button>
      </Card>
    </div>
  );
}
