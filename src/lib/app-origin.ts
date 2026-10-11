/**
 * The public origin to build redirects from. Behind a reverse proxy the request's own origin can be the
 * internal address (http://localhost:3000), so redirects (Google's callback, the sign-in redirect) use the
 * deployment's configured `APP_URL` and only fall back to the request's origin when it is not set
 * (local development, tests). A malformed APP_URL is ignored.
 */
export function appOrigin(requestOrigin: string, appUrl: string | undefined = process.env.APP_URL): string {
  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // fall through to the request's origin
    }
  }
  return requestOrigin;
}
