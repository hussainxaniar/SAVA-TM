import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { getProjectLanding } from "@/server/services/projects";

// Opening a project lands in its first list (6.3.1: a project always has one).
export default async function ProjectPage({ params }: { params: Promise<{ spaceId: string; projectId: string }> }) {
  const { spaceId, projectId } = await params;
  const user = await getSessionUser();
  const landing = await getProjectLanding({ userId: user.id }, { projectId });
  redirect(landing ? `/s/${spaceId}/p/${projectId}/l/${landing.listId}` : `/s/${spaceId}`);
}
