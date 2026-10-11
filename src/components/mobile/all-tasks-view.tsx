"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconFileText,
  IconPlus,
} from "@tabler/icons-react";
import { ScreenHeader, HeaderIconButton } from "@/components/mobile/screen-header";
import { ListIcon } from "@/components/list-icon";
import { NewProjectDialog } from "@/components/sidebar/new-project-dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { SidebarDTO } from "@/server/services/types";

type Project = SidebarDTO["projects"][number];

const projectRow = "flex min-w-0 flex-1 items-center gap-2";
const childRow = "flex h-12 items-center gap-3 pl-10 pr-4";

function plural(n: number, one: string) {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** The All tasks tab (M-01): every project with its lists and docs; projects fold, per browser. */
export function AllTasksView({
  spaceId,
  spaceName,
  projects,
}: {
  spaceId: string;
  spaceName: string;
  projects: Project[];
}) {
  const [closed, setClosed] = useLocalStorage(
    "sava.mobile.allTasks.closed",
    [] as string[],
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  function toggleClosed(projectId: string) {
    setClosed(
      closed.includes(projectId)
        ? closed.filter((id) => id !== projectId)
        : [...closed, projectId],
    );
  }

  return (
    <div className="pb-6">
      <ScreenHeader
        title="All tasks"
        subtitle={`${plural(projects.length, "project")} · ${spaceName}`}
        actions={
          <HeaderIconButton label="New project" onClick={() => setDialogOpen(true)}>
            <IconPlus className="size-6" stroke={1.8} />
          </HeaderIconButton>
        }
      />

      {projects.length === 0 && (
        <p className="px-4 py-6 text-center text-[15px] text-muted-foreground">
          No projects yet.
        </p>
      )}

      {projects.map((project) => {
        const open = !closed.includes(project.id);
        const docs = project.docs.filter((doc) => doc.firstPageId !== null);
        return (
          <section key={project.id}>
            <div className="flex items-center border-t border-border pl-3 pr-1">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleClosed(project.id)}
                className={`${projectRow} h-[52px] w-full`}
              >
                {open ? (
                  <IconChevronDown className="size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <IconChevronRight className="size-5 shrink-0 text-muted-foreground" />
                )}
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: project.color }}
                />
                <span className="min-w-0 flex-1 truncate text-left text-base font-semibold text-foreground">
                  {project.name}
                </span>
                {!open && (
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    {plural(project.lists.length, "list")}
                    {docs.length > 0 && ` · ${plural(docs.length, "doc")}`}
                  </span>
                )}
              </button>
              <Link
                href={`/s/${spaceId}/p/${project.id}/settings`}
                aria-label="Project settings"
                className="flex size-11 shrink-0 items-center justify-center text-muted-foreground"
              >
                <IconDots className="size-[22px]" />
              </Link>
            </div>

            {open && (
              <>
                {project.lists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/s/${spaceId}/p/${project.id}/l/${list.id}`}
                    className={childRow}
                  >
                    <ListIcon
                      icon={list.icon}
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate text-base text-foreground">
                      {list.name}
                    </span>
                    {list.openTaskCount > 0 && (
                      <span className="shrink-0 text-[13px] text-muted-foreground">
                        {list.openTaskCount}
                      </span>
                    )}
                  </Link>
                ))}
                {docs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/s/${spaceId}/p/${project.id}/d/${doc.id}/${doc.firstPageId}`}
                    className={childRow}
                  >
                    <IconFileText
                      className="size-5 shrink-0 text-muted-foreground"
                      stroke={1.8}
                    />
                    <span className="min-w-0 flex-1 truncate text-base text-foreground">
                      {doc.title}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="flex h-[52px] w-full items-center gap-2 border-t border-border pl-3 pr-4 text-base font-medium text-primary"
      >
        <IconPlus className="size-5 shrink-0" />
        New project
      </button>

      <NewProjectDialog
        spaceId={spaceId}
        projects={projects.map(({ id, name }) => ({ id, name }))}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
