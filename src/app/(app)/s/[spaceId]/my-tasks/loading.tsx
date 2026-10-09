import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for My Tasks — the header band and grouped two-line rows,
// same widths and paddings as MyTasksView so nothing jumps when data arrives.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export default function Loading() {
  return (
    <div>
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
  );
}
