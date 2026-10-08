import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getOptionalSessionUser, googleSignInEnabled } from "@/server/auth";
import { safeNext } from "@/lib/safe-next";

type Props = { searchParams: Promise<{ next?: string | string[]; error?: string | string[] }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next: rawNext, error: rawError } = await searchParams;
  const callbackError = Array.isArray(rawError) ? rawError[0] : rawError;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  if (await getOptionalSessionUser()) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
        </div>
        <AuthForm mode="sign-in" next={next} googleEnabled={googleSignInEnabled} callbackError={callbackError} />
      </div>
    </main>
  );
}
