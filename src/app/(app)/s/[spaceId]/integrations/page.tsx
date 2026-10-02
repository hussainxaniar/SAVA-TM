import { GoogleCalendarCard } from "@/components/integrations/google-calendar-card";
import { getSessionUser } from "@/server/auth";
import { getGoogleConnection } from "@/server/services/google-calendar";

// Section 9.6 "User → Integrations" (T-18). Per user, shown inside the current space's shell; the
// Google callback returns here with ?google=connected|cancelled|error&message=….
export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams: Promise<{ google?: string; message?: string }>;
}) {
  const [{ spaceId }, { google, message }] = await Promise.all([params, searchParams]);
  const user = await getSessionUser();
  const connection = await getGoogleConnection({ userId: user.id });
  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-4 py-8 md:px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connections for your account. Other members connect their own.</p>
      </div>
      <GoogleCalendarCard spaceId={spaceId} connection={connection} outcome={google ?? null} message={message ?? null} />
    </div>
  );
}
