// Errors Better Auth sends back to `errorCallbackURL` as `?error=<code>` after a failed social sign-in.

export type AuthNotice = { title: string; description: string };

const NOTICES: Record<string, AuthNotice> = {
  account_not_linked: {
    title: "This email already has an account",
    description:
      "An account with the email address of your Google account already exists, and it was created with a password. " +
      "Sign in with that email and password instead.",
  },
  access_denied: {
    title: "Google sign-in was cancelled",
    description: "You didn't allow access to your Google account. Try again, or sign in with your email and password.",
  },
  invite_only: {
    title: "Sava TM is invite only",
    description:
      "There is no account for this Google address yet. Open the invite link a teammate sent you, then continue with Google there.",
  },
  signup_disabled: {
    title: "Sign-up with Google is unavailable",
    description: "Create an account with your email and password instead.",
  },
};

const FALLBACK: AuthNotice = {
  title: "Google sign-in failed",
  description: "Something went wrong while signing in with Google. Try again, or use your email and password.",
};

/** Notice for an `error` query value, or null when there is no error. */
export function authNoticeFor(code: string | null | undefined): AuthNotice | null {
  if (!code) return null;
  return NOTICES[code] ?? FALLBACK;
}
