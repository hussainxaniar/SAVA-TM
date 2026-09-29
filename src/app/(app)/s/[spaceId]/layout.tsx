import { notFound } from "next/navigation";
import { SpaceSwitcher } from "@/components/sidebar/space-switcher";
import { getSessionUser } from "@/server/auth";
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
  const spaces = await listMySpaces({ userId: user.id });
  const current = spaces.find((s) => s.id === spaceId);
  if (!current) notFound(); // not a member, or no such space — indistinguishable (7.4)

  return (
    <div className="flex h-full">
      <aside className="flex w-[260px] shrink-0 flex-col border-r bg-muted/30">
        <div className="p-2">
          <SpaceSwitcher current={current} spaces={spaces} />
        </div>
        {/* TODO (T-06): My Tasks, Calendar, Projects tree, footer */}
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
      {/* TODO (T-11): Task panel host */}
    </div>
  );
}
