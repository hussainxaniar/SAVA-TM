import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CreateSpaceForm } from "@/components/onboarding/create-space-form";
import { LAST_SPACE_COOKIE } from "@/lib/last-space";
import { getSessionUser } from "@/server/auth";
import { listMySpaces } from "@/server/services/spaces";

// Section 7.2.1: no memberships → "Create your space"; otherwise open the last space
// (cookie, if still a member) or the oldest membership.
export default async function AppHomePage() {
  const user = await getSessionUser();
  const spaces = await listMySpaces({ userId: user.id });

  if (spaces.length > 0) {
    const last = (await cookies()).get(LAST_SPACE_COOKIE)?.value;
    const target = spaces.find((s) => s.id === last) ?? spaces[0];
    redirect(`/s/${target.id}`);
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create your space</h1>
          <p className="text-sm text-muted-foreground">
            A space holds your team&apos;s projects. You can invite people once it&apos;s set up.
          </p>
        </div>
        <CreateSpaceForm />
      </div>
    </div>
  );
}
