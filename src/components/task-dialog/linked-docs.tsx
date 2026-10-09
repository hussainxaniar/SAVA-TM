"use client";

import Link from "next/link";
import { IconFileText } from "@tabler/icons-react";
import type { TaskDetailDTO } from "@/server/services/types";

/**
 * The dialog's Documents section (11.4): pages that link this task via `task:ID`.
 * Rendered only when the task is linked from at least one page.
 */
export function LinkedDocs({ task }: { task: TaskDetailDTO }) {
  if (task.linkedDocs.length === 0) return null;

  return (
    <section className="ml-10 mt-7">
      <div className="flex h-8 items-center gap-2.5">
        <h3 className="text-sm font-semibold">Documents</h3>
        <span className="text-[13px] text-muted-foreground">{task.linkedDocs.length}</span>
      </div>
      <ul>
        {task.linkedDocs.map((doc) => (
          <li key={doc.pageId}>
            <Link
              href={`/s/${task.spaceId}/p/${doc.projectId}/d/${doc.docId}/${doc.pageId}`}
              className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent"
            >
              <IconFileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {doc.docTitle}
                {doc.pageTitle !== doc.docTitle && (
                  <span className="text-muted-foreground"> / {doc.pageTitle}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
