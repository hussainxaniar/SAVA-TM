import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for the list view — the same header band and status-group
// layout as ListView, same widths and paddings, so nothing jumps when data arrives.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

function Group({ first }: { first: boolean }) {
  return (
    <section className={first ? "mt-7" : "mt-6"}>
      <div className="flex h-8 w-full items-center border-b border-border">
        <span className="flex w-5 shrink-0 justify-center">
          <Bar className="size-3" />
        </span>
        <Bar className="h-6 w-24 rounded-md" />
        <Bar className="ml-2 h-3 w-4" />
      </div>
      {[0, 1].map((r) => (
        <div key={r} className="flex h-10 items-center gap-2.5 border-b border-divider">
          <Bar className="size-4 shrink-0 rounded-full" />
          <Bar className={cn("h-4", r === 0 ? "w-1/3" : "w-1/4")} />
          <span className="grow" />
          <Bar className="h-3 w-10" />
        </div>
      ))}
    </section>
  );
}

export default function Loading() {
  return (
    <div>
      <header className="w-full border-b border-border bg-sidebar/50 pb-4">
        <div className="mx-auto w-full max-w-[928px] px-4 pt-5 md:px-6">
          <div className="flex h-5 items-center gap-1.5">
            <Bar className="size-2 rounded-[2px]" />
            <Bar className="h-2 w-24" />
            <span className="grow" />
            <Bar className="h-2 w-10" />
          </div>
          <div className="mt-2 flex h-11 items-center gap-2">
            <Bar className="size-5" />
            <Bar className="h-7 w-48" />
            <span className="grow" />
            <Bar className="size-5" />
          </div>
          <Bar className="mt-0.5 h-2.5 w-40" />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[928px] px-4 pt-1 pb-24 md:px-6">
        <Group first />
        <Group first={false} />
        <Group first={false} />
      </div>
    </div>
  );
}
