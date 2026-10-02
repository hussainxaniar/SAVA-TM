import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for space settings — the title line and a section card,
// same container widths and paddings as the real page so nothing jumps.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-4 py-8 md:px-6">
      <Bar className="h-5 w-36" />
      <section className="space-y-4">
        <Bar className="h-4 w-28" />
        <div className="divide-y rounded-lg border">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Bar className="size-8 shrink-0 rounded-full" />
              <Bar className={cn("h-3.5", i === 0 ? "w-28" : "w-24")} />
              <span className="grow" />
              <Bar className="h-3 w-16" />
              <Bar className="h-7 w-16 rounded-[min(var(--radius-md),12px)]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
