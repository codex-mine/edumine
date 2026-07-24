import { Inbox } from "lucide-react";

export function EmptyState({ message = "No data found." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <Inbox className="size-6" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
