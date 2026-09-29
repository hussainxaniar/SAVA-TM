import { SignOutButton } from "@/components/auth/sign-out-button";
import { getSessionUser } from "@/server/auth";

export default async function AppPage() {
  // TODO (T-04): redirect to last space, or "Create your space" when there is none.
  const user = await getSessionUser();

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Sava TM</h1>
      <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      <SignOutButton />
    </div>
  );
}
