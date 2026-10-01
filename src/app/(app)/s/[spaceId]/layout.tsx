import { Suspense } from "react";
import { notFound } from "next/navigation";
import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog";
import { Sidebar } from "@/components/sidebar/sidebar";
import { TaskDialogHost } from "@/components/task-dialog/task-dialog-host";
import { can } from "@/server/guards";
import { getSessionUser } from "@/server/auth";
import { getSidebar } from "@/server/services/projects";
import { listMembers, listMySpaces } from "@/server/services/spaces";

// Space shell: sidebar (Section 9.1) + main view. Lives here rather than in (app)/layout
// because the sidebar is space-scoped and only this segment knows `spaceId`.
export default async function SpaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const ctx = { userId: user.id };
  const spaces = await listMySpaces(ctx);
  const current = spaces.find((s) => s.id === spaceId);
  if (!current) notFound(); // not a member, or no such space — indistinguishable (7.4)
  const [{ projects }, members] = await Promise.all([getSidebar(ctx, { spaceId }), listMembers(ctx, { spaceId })]);
  // Quick add's @ autocomplete and the task dialog's assignee picker (current members only, 6.8).
  const memberList = members.map(({ id, name, image }) => ({ id, name, image }));

  return (
    <div className="flex h-full">
      <Sidebar
        space={current}
        spaces={spaces}
        projects={projects}
        user={{ id: user.id, name: user.name, email: user.email, image: user.image }}
        canArchiveProjects={can(current.role, "archiveProject")}
      />
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
      {/* Reads ?task= (useSearchParams), so it sits in its own Suspense boundary. */}
      <Suspense fallback={null}>
        <TaskDialogHost
          spaceId={spaceId}
          members={memberList}
          me={{ id: user.id, name: user.name, image: user.image }}
        />
      </Suspense>
      <QuickAddDialog spaceId={spaceId} projects={projects} members={memberList} />
    </div>
  );
}
