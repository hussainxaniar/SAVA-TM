import { notFound } from "next/navigation";
import { ListView } from "@/components/tasks/list-view";
import { getSessionUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { can } from "@/server/guards";
import { listMySpaces } from "@/server/services/spaces";
import { getListView } from "@/server/services/tasks";

// Section 9.2 list view (design: docs/design/list-view-*.png). First paint is server-rendered;
// ListView hydrates it into TanStack Query (['tasks', listId]) for optimistic updates.
export default async function ListPage({
  params,
}: {
  params: Promise<{ spaceId: string; projectId: string; listId: string }>;
}) {
  const { spaceId, projectId, listId } = await params;
  const user = await getSessionUser();
  const ctx = { userId: user.id };
  const data = await getListView(ctx, { listId }).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (data.list.projectId !== projectId || data.project.spaceId !== spaceId) notFound();
  const role = (await listMySpaces(ctx)).find((s) => s.id === spaceId)!.role;

  return <ListView initialData={data} spaceId={spaceId} canDeleteLists={can(role, "deleteList")} />;
}
