import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for the calendar — the header band with its toolbar row and
// a week grid of lines filling the rest, same paddings as CalendarView so nothing jumps.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

const DAYS = 7;
const ROWS = 6;

export default function Loading() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="w-full shrink-0 border-b border-border bg-sidebar/50 px-4 pb-3 pt-5 md:px-6">
        <div className="flex h-11 items-center">
          <Bar className="h-7 w-40" />
        </div>
        <div className="flex items-center gap-1">
          <Bar className="h-7 w-16 rounded-[min(var(--radius-md),12px)]" />
          <Bar className="size-7 rounded-[min(var(--radius-md),12px)]" />
          <Bar className="size-7 rounded-[min(var(--radius-md),12px)]" />
          <Bar className="ml-1 h-4 w-36" />
          <span className="grow" />
          <Bar className="h-7 w-36 rounded-md" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 border-b border-border">
          {Array.from({ length: DAYS }, (_, i) => (
            <div key={i} className="flex h-9 items-center justify-center border-r border-border last:border-r-0">
              <Bar className="h-3 w-10" />
            </div>
          ))}
        </div>
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} className="grid min-h-0 flex-1 grid-cols-7 border-b border-border last:border-b-0">
            {Array.from({ length: DAYS }, (_, c) => (
              <div key={c} className="min-w-0 border-r border-border p-1.5 last:border-r-0">
                <Bar className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
