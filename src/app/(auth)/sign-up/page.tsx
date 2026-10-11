import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getOptionalSessionUser, googleSignInEnabled } from "@/server/auth";
import { INVITE_ONLY_MESSAGE, signUpAllowed } from "@/server/services/spaces";
import { INVITE_COOKIE, inviteTokenFromPath } from "@/lib/invite-cookie";
import { safeNext } from "@/lib/safe-next";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

// Section 7.2.6: sign-up is invite-only. Without a usable invite (from ?next=/invite/<token> or the
// invite cookie) the page explains that instead of showing the form; the server enforces it anyway.
export default async function SignUpPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  if (await getOptionalSessionUser()) redirect(next);

  const inviteToken = inviteTokenFromPath(next) ?? (await cookies()).get(INVITE_COOKIE)?.value ?? null;
  const allowed = await signUpAllowed(inviteToken);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        {allowed ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
              <p className="text-sm text-muted-foreground">Start organising your team&apos;s work</p>
            </div>
            <AuthForm mode="sign-up" next={next} googleEnabled={googleSignInEnabled} />
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Invite only</h1>
              <p className="text-sm text-muted-foreground">{INVITE_ONLY_MESSAGE}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
