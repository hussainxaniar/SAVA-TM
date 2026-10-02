import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for the doc view — header band, the 220px tree column and the
// editor column (title + paragraph bars), same widths and paddings as DocView so nothing jumps.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

const PARAGRAPHS = ["w-full", "w-full", "w-5/6", "w-full", "w-3/4", "w-1/2"];

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <header className="w-full shrink-0 border-b border-border bg-sidebar/50 pb-4">
        <div className="mx-auto w-full max-w-[880px] px-4 pt-5 md:px-6">
          <div className="flex h-5 items-center gap-1.5">
            <Bar className="size-2 rounded-[2px]" />
            <Bar className="h-2 w-24" />
          </div>
          <div className="mt-2 flex h-11 items-center">
            <Bar className="h-7 w-56" />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-panel p-2 max-md:hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-9 items-center gap-1.5 rounded-md px-2">
              <Bar className="size-3.5 shrink-0" />
              <Bar className={cn("h-3.5", i === 0 ? "w-24" : "w-16")} />
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[880px] px-6 pb-24 pt-6">
            <Bar className="mb-6 h-8 w-2/3" />
            {PARAGRAPHS.map((w, i) => (
              <Bar key={i} className={cn("mb-2.5 h-3.5", w)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
