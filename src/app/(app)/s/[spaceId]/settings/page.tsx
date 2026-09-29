import { notFound } from "next/navigation";
import { InviteLinks } from "@/components/settings/invite-links";
import { LeaveSpace } from "@/components/settings/leave-space";
import { MembersTable, type MemberRow } from "@/components/settings/members-table";
import { SpaceNameForm } from "@/components/settings/space-name-form";
import { can } from "@/server/guards";
import { getSessionUser } from "@/server/auth";
import { listInvites, listMembers, listMySpaces } from "@/server/services/spaces";

// Section 9.6 — Space settings. Every permission is decided here (from 7.3) and passed
// down as booleans; the services re-check everything anyway.
export default async function SpaceSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const user = await getSessionUser();
  const ctx = { userId: user.id };
  const [spaces, members] = await Promise.all([listMySpaces(ctx), listMembers(ctx, { spaceId })]);
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) notFound();

  const viewerRole = space.role;
  const canManageInvites = can(viewerRole, "manageInvites");
  const invites = canManageInvites ? await listInvites(ctx, { spaceId }) : [];

  const rows: MemberRow[] = members.map((m) => ({
    ...m,
    isViewer: m.id === user.id,
    canChangeRole: can(viewerRole, "changeRoles"),
    canRemove:
      m.id !== user.id &&
      can(viewerRole, "removeMember") &&
      (m.role === "MEMBER" || can(viewerRole, "removeAdmin")),
  }));

  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Space settings</h1>
      <SpaceNameForm spaceId={spaceId} name={space.name} canRename={can(viewerRole, "renameSpace")} />
      <MembersTable spaceId={spaceId} members={rows} />
      {canManageInvites && <InviteLinks spaceId={spaceId} invites={invites} />}
      <LeaveSpace spaceId={spaceId} spaceName={space.name} />
    </div>
  );
}
