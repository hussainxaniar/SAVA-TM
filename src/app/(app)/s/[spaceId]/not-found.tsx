"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// T-21: not-found boundary for everything under the space segment (a list, doc or settings
// page that called notFound()). The spaceId comes from the URL, since boundaries get no params.

export default function SpaceNotFound() {
  const pathname = usePathname();
  const space = /^\/s\/[^/]+/.exec(pathname)?.[0];

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">We can&apos;t find that.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          It may have been deleted, or you don&apos;t have access.
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="outline" nativeButton={false} render={<Link href={space ?? "/"} />}>
            Back to the space
          </Button>
        </div>
      </div>
    </div>
  );
}
