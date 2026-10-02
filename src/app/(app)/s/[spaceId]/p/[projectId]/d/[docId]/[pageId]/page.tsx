import { notFound } from "next/navigation";
import { DocView } from "@/components/docs/doc-view";
import { getSessionUser } from "@/server/auth";
import { AppError } from "@/server/errors";
import { getDocView } from "@/server/services/docs";

// Section 11.1 doc view: the page tree on the left, the editor on the right. First paint is
// server-rendered; DocView hydrates it into TanStack Query (['doc', docId, …]).
export default async function DocPageRoute({
  params,
}: {
  params: Promise<{ spaceId: string; projectId: string; docId: string; pageId: string }>;
}) {
  const { spaceId, projectId, docId, pageId } = await params;
  const user = await getSessionUser();
  const data = await getDocView({ userId: user.id }, { docId, pageId }).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  if (data.doc.spaceId !== spaceId || data.doc.projectId !== projectId) notFound();
  return <DocView initialData={data} me={{ id: user.id, name: user.name, image: user.image }} />;
}
