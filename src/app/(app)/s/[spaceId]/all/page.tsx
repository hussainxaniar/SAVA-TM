import { notFound } from "next/navigation";
import { AllTasksView } from "@/components/mobile/all-tasks-view";
import { getSessionUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getSidebar } from "@/server/services/projects";
import { listMySpaces } from "@/server/services/spaces";

// The mobile "All tasks" tab (M-01): every project with its lists and docs.
export default async function AllTasksPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const ctx = { userId: user.id };
  const [{ projects }, spaces] = await Promise.all([
    getSidebar(ctx, { spaceId }).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    listMySpaces(ctx),
  ]);
  const spaceName = spaces.find((s) => s.id === spaceId)?.name ?? "";
  return <AllTasksView spaceId={spaceId} spaceName={spaceName} projects={projects} />;
}
