import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getSpaceLanding } from "@/server/services/spaces";

// Opening a space lands in its first project's first list (or My Tasks if it has none).
export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const landing = await getSpaceLanding({ userId: user.id }, { spaceId });
  redirect(
    landing ? `/s/${spaceId}/p/${landing.projectId}/l/${landing.listId}` : `/s/${spaceId}/my-tasks`,
  );
}
