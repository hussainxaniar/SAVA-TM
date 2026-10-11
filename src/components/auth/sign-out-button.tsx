"use client";

import { removePushBeforeSignOut } from "@/hooks/use-push";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    await removePushBeforeSignOut(); // this device stops getting my notifications (Section 17)
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      Sign out
    </Button>
  );
}
