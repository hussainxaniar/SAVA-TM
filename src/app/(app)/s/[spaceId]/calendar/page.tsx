import { CalendarView } from "@/components/calendar/calendar-view";

// Section 10.1 calendar (local half, T-17). Everything loads client-side for the visible date
// range (TanStack Query, ['calendar', spaceId, …]); the user's browser time zone is used.
export default async function CalendarPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  return <CalendarView spaceId={spaceId} />;
}
