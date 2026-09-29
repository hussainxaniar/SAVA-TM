import { notFound } from "next/navigation";
import { Sidebar } from "@/components/sidebar/sidebar";
import { can } from "@/server/guards";
import { getSessionUser } from "@/server/auth";
import { getSidebar } from "@/server/services/projects";
import { listMySpaces } from "@/server/services/spaces";

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
  const { projects } = await getSidebar(ctx, { spaceId });

  return (
    <div className="flex h-full">
      <Sidebar
        space={current}
        spaces={spaces}
        projects={projects}
        user={{ name: user.name, email: user.email, image: user.image }}
        canArchiveProjects={can(current.role, "archiveProject")}
      />
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
      {/* TODO (T-11): Task panel host */}
    </div>
  );
}
