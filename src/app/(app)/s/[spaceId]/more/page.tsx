import { notFound } from "next/navigation";
import { MoreView } from "@/components/mobile/more-view";
import { getSessionUser } from "@/server/auth";
import { listMySpaces } from "@/server/services/spaces";

// The mobile "More" tab (M-06): space switcher, notifications, settings, theme,
// integrations and the profile card. Membership is decided here (7.3); MoreView
// is presentational.
export default async function MorePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const spaces = await listMySpaces({ userId: user.id });
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) notFound();

  return (
    <MoreView
      spaceId={spaceId}
      space={space}
      spaces={spaces}
      user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
    />
  );
}
