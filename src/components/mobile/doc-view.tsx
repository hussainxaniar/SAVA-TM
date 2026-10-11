"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconFileText, IconListTree, IconPlus } from "@tabler/icons-react";
import { DocTitle } from "@/components/docs/doc-title";
import { PageEditor } from "@/components/docs/page-editor";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { HeaderIconButton } from "@/components/mobile/screen-header";
import { useCreatePage } from "@/hooks/use-doc";
import { flattenTree } from "@/lib/page-tree";
import { cn } from "@/lib/utils";
import type { DocViewDTO, PageTreeNodeDTO, UserLite } from "@/server/services/types";

/*
 * The doc on a phone (M-07, docs/design/mobile/08): a navigation bar ("All tasks" back link and
 * the Pages button), the project line and doc title, then the page editor. The page tree is a
 * bottom sheet over the editor, so the URL scheme …/d/{docId}/{pageId} stays unchanged.
 */

export function MobileDocView({
  initialData,
  me,
  tree,
}: {
  initialData: DocViewDTO;
  me: UserLite;
  tree: PageTreeNodeDTO[];
}) {
  const { doc, page } = initialData;
  const router = useRouter();
  const createPage = useCreatePage(doc.id);
  const [pagesOpen, setPagesOpen] = useState(false);
  const rows = flattenTree(tree);

  async function addPage() {
    try {
      const { pageId } = await createPage.mutateAsync({ parentId: null });
      setPagesOpen(false);
      router.push(`/s/${doc.spaceId}/p/${doc.projectId}/d/${doc.id}/${pageId}`);
    } catch {
      // the hook toasted the server's message
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <nav className="flex h-11 items-center px-1">
        <Link
          href={`/s/${doc.spaceId}/all`}
          className="flex h-11 items-center gap-0.5 pl-1.5 pr-2 text-base text-primary"
        >
          <IconChevronLeft className="size-6" />
          All tasks
        </Link>
        <div className="flex-1" />
        <HeaderIconButton label="Pages" onClick={() => setPagesOpen(true)}>
          <IconListTree className="size-6 text-foreground" />
        </HeaderIconButton>
      </nav>
      <div className="border-b border-border px-4 pb-2 pt-1">
        <div className="flex h-5 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: doc.projectColor }}
          />
          <p className="text-[13px] text-muted-foreground">{doc.projectName}</p>
        </div>
        <div className="mt-1 flex items-center">
          <DocTitle docId={doc.id} title={doc.title} />
        </div>
      </div>
      <PageEditor key={page.id} docId={doc.id} spaceId={doc.spaceId} page={page} me={me} />
      <BottomSheet open={pagesOpen} onOpenChange={setPagesOpen} title={doc.title}>
        <div className="pb-2 pt-1">
          {rows.map((row) => {
            const current = row.node.id === page.id;
            const title = row.node.title.trim() || "Untitled";
            return (
              <Link
                key={row.node.id}
                href={`/s/${doc.spaceId}/p/${doc.projectId}/d/${doc.id}/${row.node.id}`}
                onClick={() => setPagesOpen(false)}
                style={{ paddingLeft: 16 + row.depth * 28 }}
                className={cn(
                  "flex h-12 items-center gap-2 pr-4 text-base text-foreground",
                  current && "bg-selected font-medium text-selected-foreground",
                )}
              >
                <IconFileText
                  className={cn("size-5 shrink-0", current ? "text-selected-foreground" : "text-muted-foreground")}
                  stroke={1.8}
                />
                <span className="min-w-0 flex-1 truncate">{title}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void addPage()}
            disabled={createPage.isPending}
            className="flex h-12 w-full items-center gap-2 pl-4 pr-4 text-base text-muted-foreground"
          >
            <IconPlus className="size-5 shrink-0 text-primary" />
            New page
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}