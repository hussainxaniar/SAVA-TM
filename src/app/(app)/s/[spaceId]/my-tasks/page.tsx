import { notFound } from "next/navigation";
import { MyTasksView } from "@/components/my-tasks/my-tasks-view";
import { getSessionUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getMyTasks } from "@/server/services/tasks";

// Section 9.5 My Tasks. First paint is server-rendered; MyTasksView hydrates it into TanStack
// Query (['my-tasks', spaceId]). Rows open the same task dialog (?task=).
export default async function MyTasksPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const data = await getMyTasks({ userId: user.id }, { spaceId }).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  return <MyTasksView spaceId={spaceId} initialData={data} />;
}
