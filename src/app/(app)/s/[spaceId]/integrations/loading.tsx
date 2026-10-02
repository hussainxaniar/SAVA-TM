import { cn } from "@/lib/utils";

// T-21: server-rendered skeleton for Integrations — the title block and one connection card,
// same widths and paddings as the real page so nothing jumps.

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-4 py-8 md:px-6">
      <div>
        <Bar className="h-5 w-32" />
        <Bar className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <section className="space-y-4">
        <Bar className="h-4 w-24" />
        <div className="flex items-start gap-4 rounded-lg border p-4">
          <Bar className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1">
            <Bar className="h-3.5 w-32" />
            <Bar className="mt-1.5 h-3 w-3/4 max-w-full" />
            <Bar className="mt-1 h-3 w-1/2 max-w-full" />
          </div>
        </div>
      </section>
    </div>
  );
}
