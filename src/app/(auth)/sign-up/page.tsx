import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getOptionalSessionUser, googleSignInEnabled } from "@/server/auth";
import { safeNext } from "@/lib/safe-next";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  if (await getOptionalSessionUser()) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">Start organising your team&apos;s work</p>
        </div>
        <AuthForm mode="sign-up" next={next} googleEnabled={googleSignInEnabled} />
      </div>
    </main>
  );
}
