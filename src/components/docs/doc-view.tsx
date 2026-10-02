"use client";

import Link from "next/link";
import { PageEditor } from "@/components/docs/page-editor";
import { PageTree } from "@/components/docs/page-tree";
import { usePageTree } from "@/hooks/use-doc";
import type { DocViewDTO, UserLite } from "@/server/services/types";

export type DocViewProps = {
  initialData: DocViewDTO;
  me: UserLite;
};

/**
 * Section 11.1 doc view: the header band (project breadcrumb line, then the 28px doc title),
 * the 220px page tree on the left and the editor filling the rest. First paint is
 * server-rendered; the tree hydrates into ['doc', docId, 'tree'].
 */
export function DocView(props: DocViewProps) {
  const { initialData, me } = props;
  const { doc, page } = initialData;
  const { data: tree } = usePageTree(doc.id, initialData.tree);

  return (
    <div className="flex h-full flex-col">
      <header className="w-full shrink-0 border-b border-border bg-sidebar/50 pb-4">
        <div className="mx-auto w-full max-w-[880px] px-6 pt-5">
          <div className="flex h-5 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: doc.projectColor }}
            />
            <Link
              href={`/s/${doc.spaceId}/p/${doc.projectId}`}
              className="text-[13px] text-muted-foreground hover:underline"
            >
              {doc.projectName}
            </Link>
          </div>
          <div className="mt-2 flex h-11 items-center">
            <h1 className="truncate text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-foreground">
              {doc.title}
            </h1>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <PageTree
          docId={doc.id}
          spaceId={doc.spaceId}
          projectId={doc.projectId}
          tree={tree}
          currentPageId={page.id}
        />
        <div className="min-w-0 flex-1 overflow-y-auto">
          <PageEditor key={page.id} docId={doc.id} spaceId={doc.spaceId} page={page} me={me} />
        </div>
      </div>
    </div>
  );
}
