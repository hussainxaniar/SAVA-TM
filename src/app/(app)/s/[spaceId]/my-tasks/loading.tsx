import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for My Tasks — the header band and grouped two-line rows,
// same widths and paddings as MyTasksView so nothing jumps when data arrives.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export default function Loading() {
  return (
    <>
      <PhoneSkeleton />
      <div className="hidden md:block">
      <header className="w-full border-b border-border bg-sidebar/50 pb-4">
        <div className="mx-auto w-full max-w-[928px] px-4 pt-5 md:px-6">
          <div className="flex h-11 items-center">
            <Bar className="h-7 w-44" />
          </div>
          <Bar className="mt-0.5 h-2.5 w-24" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[928px] px-4 pt-1 pb-24 md:px-6">
        {[0, 1].map((g) => (
          <section key={g} className={g === 0 ? "mt-7" : "mt-6"}>
            <div className="flex h-8 w-full items-center border-b border-border">
              <span className="flex w-5 shrink-0 justify-center">
                <Bar className="size-3" />
              </span>
              <Bar className="h-6 w-20 rounded-md" />
              <Bar className="ml-2 h-3 w-4" />
            </div>
            {[0, 1].map((r) => (
              <div key={r} className="flex items-start gap-3 border-b border-divider py-2.5">
                <Bar className="mt-0.5 size-4 shrink-0 rounded-full" />
                <div className="flex min-w-0 grow flex-col gap-[3px]">
                  <Bar className={cn("h-4", r === 0 ? "w-1/3" : "w-1/4")} />
                  <Bar className="h-3 w-1/5" />
                </div>
                <Bar className="mt-1 h-3 w-12 shrink-0" />
              </div>
            ))}
          </section>
        ))}
      </div>
      </div>
    </>
  );
}

/** Below 768px (docs/design/mobile.md "States"): the large title and skeleton rows, never a spinner. */
function PhoneSkeleton() {
  const rows = [
    ["w-[240px]", "w-[120px]"],
    ["w-[180px]", "w-[90px]"],
    ["w-[270px]", "w-[140px]"],
    ["w-[150px]", "w-[100px]"],
  ];
  return (
    <div className="animate-pulse md:hidden">
      <div className="flex flex-col gap-2 px-4 pb-3 pt-2">
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">My tasks</h1>
        <div className="h-3 w-[120px] rounded-full bg-pill" />
      </div>
      <div className="flex h-11 items-center border-b border-border px-4">
        <div className="h-3.5 w-[72px] rounded-full bg-pill" />
      </div>
      {rows.map(([title, meta]) => (
        <div key={title} className="flex items-start pl-1 pr-4">
          <div className="flex size-11 shrink-0 items-center justify-center">
            <div className="size-5 rounded-full bg-pill" />
          </div>
          <div className="flex flex-1 flex-col gap-2.5 border-b border-divider pb-3.5 pt-[15px]">
            <div className={cn("h-3.5 max-w-full rounded-full bg-pill", title)} />
            <div className={cn("h-2.5 rounded-full bg-divider", meta)} />
          </div>
        </div>
      ))}
    </div>
  );
}
