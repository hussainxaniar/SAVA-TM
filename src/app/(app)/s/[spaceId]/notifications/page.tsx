import { NotificationsView } from "@/components/mobile/notifications-view";

// The notifications screen (M-06): a full page, opened from the More tab or the My tasks
// bell. Membership is guarded by the space layout; the list is fetched client-side.
export default async function NotificationsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  return <NotificationsView spaceId={spaceId} />;
}
