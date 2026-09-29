import { notFound } from "next/navigation";
import { ListsEditor } from "@/components/project-settings/lists-editor";
import { ProjectDetailsForm } from "@/components/project-settings/project-details-form";
import { StatusesEditor } from "@/components/project-settings/statuses-editor";
import { getSessionUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { can } from "@/server/guards";
import { getProjectSettings } from "@/server/services/projects";
import { listMySpaces } from "@/server/services/spaces";

// Section 9.6 — Project settings. Permissions come from the viewer's role (7.3):
// statuses are Admin-only, lists are editable by everyone except deletion (Admin).
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string; projectId: string }>;
}) {
  const { spaceId, projectId } = await params;
  const user = await getSessionUser();
  const ctx = { userId: user.id };
  const settings = await getProjectSettings(ctx, { projectId }).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (settings.project.spaceId !== spaceId) notFound();
  const role = (await listMySpaces(ctx)).find((s) => s.id === spaceId)!.role;

  return (
    <div className="mx-auto max-w-[880px] space-y-10 px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Project settings</h1>
      <ProjectDetailsForm projectId={projectId} name={settings.project.name} color={settings.project.color} />
      <StatusesEditor projectId={projectId} statuses={settings.statuses} canEdit={can(role, "editStatuses")} />
      <ListsEditor
        spaceId={spaceId}
        projectId={projectId}
        lists={settings.lists}
        canDelete={can(role, "deleteList")}
      />
    </div>
  );
}
