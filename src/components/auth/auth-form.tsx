"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authNoticeFor } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  mode: "sign-in" | "sign-up";
  next: string;
  googleEnabled: boolean;
  /** `error` code Better Auth redirected back with after a failed Google sign-in. */
  callbackError?: string | null;
};

export function AuthForm({ mode, next, googleEnabled, callbackError }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(() => authNoticeFor(callbackError));
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    setNotice(null);
    const { error } = isSignUp
      ? await authClient.signUp.email({ name: String(form.get("name") ?? ""), email, password })
      : await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function onGoogle() {
    setPending(true);
    setError(null);
    setNotice(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      // Failed sign-ins come back to the sign-in page with `?error=<code>`.
      errorCallbackURL: `/sign-in${nextQuery}`,
    });
    if (error) {
      setError(error.message ?? "Google sign-in failed. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">{notice.title}</p>
          <p className="text-sm text-muted-foreground">{notice.description}</p>
        </div>
      )}
      {/* method="post": if submitted before hydration, credentials must never land in the URL. */}
      <form method="post" onSubmit={onSubmit} className="space-y-3">
        {isSignUp && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          {isSignUp && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      {googleEnabled && (
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={onGoogle}>
          Continue with Google
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New to Sava TM? "}
        <Link
          href={`${isSignUp ? "/sign-in" : "/sign-up"}${nextQuery}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
