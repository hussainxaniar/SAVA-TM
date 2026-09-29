import { redirect } from "next/navigation";
import { InviteCard } from "@/components/invite/invite-card";
import { getOptionalSessionUser } from "@/server/auth";
import { getInvite, INVITE_MESSAGES } from "@/server/services/spaces";

// Section 7.2.3–7.2.4. Signed-out visitors see the invite and sign in/up, coming back here
// via ?next=; signed-in visitors confirm "Join"; existing members are redirected.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getOptionalSessionUser();
  const info = await getInvite(user ? { userId: user.id } : null, { token });
  if (info.memberSpaceId) redirect(`/s/${info.memberSpaceId}`);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <InviteCard
        token={token}
        spaceName={info.spaceName}
        role={info.valid ? info.role : null}
        problem={info.valid ? null : INVITE_MESSAGES[info.reason]}
        signedInAs={user?.email ?? null}
      />
    </main>
  );
}
