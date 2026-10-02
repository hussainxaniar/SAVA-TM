"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// T-21: the (app) error boundary. Renders centered whether the space shell is up or not,
// with a retry and a way out to My Tasks in the current space.

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const space = /^\/s\/[^/]+/.exec(pathname)?.[0];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">Something went wrong.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The page couldn&apos;t finish loading. Trying again usually fixes it.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={space ? `${space}/my-tasks` : "/"} />}
          >
            My Tasks
          </Button>
        </div>
      </div>
    </div>
  );
}
