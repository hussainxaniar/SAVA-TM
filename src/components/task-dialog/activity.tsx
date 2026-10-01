"use client";

import { useState } from "react";
import { IconDots } from "@tabler/icons-react";
import { EditorContent, useEditor, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useAddComment, useDeleteComment, useEditComment, useFeed } from "@/hooks/use-feed";
import { formatActivity, relativeTime } from "@/lib/activity-format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/tasks/avatar-stack";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FeedItemDTO, UserLite } from "@/server/services/types";
import { CommentEditor } from "./comment-editor";

type ActivityItem = Extract<FeedItemDTO, { kind: "activity" }>;
type CommentItem = Extract<FeedItemDTO, { kind: "comment" }>;

/** First word of a name ("Maryam Reyes" → "Maryam"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The dialog's Activity section (9.4.5, T-15): header with an All / Comments toggle, feed entries
 * oldest first (activity sentences, comments with hover Edit/Delete) and the comment composer.
 * The toggle filters on the client; task edits refresh the feed through ['task', taskId].
 */
export function ActivitySection({ taskId, me }: { taskId: string; me: UserLite }) {
  const { data: feed } = useFeed(taskId);
  const addComment = useAddComment(taskId, me);
  const [filter, setFilter] = useState<"all" | "comments">("all");

  const items = feed ?? [];
  const shown = filter === "all" ? items : items.filter((i) => i.kind === "comment");

  return (
    <section className="-mx-6 border-t border-border py-6 pl-16 pr-6">
      <div className="flex flex-col gap-3">
        <div className="flex h-7 items-center gap-2.5">
          <h3 className="grow text-sm font-semibold">Activity</h3>
          <div className="flex shrink-0 rounded-md bg-pill p-0.5">
            <FilterButton label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterButton
              label="Comments"
              active={filter === "comments"}
              onClick={() => setFilter("comments")}
            />
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {shown.map((item) =>
            item.kind === "activity" ? (
              <ActivityRow key={item.id} item={item} />
            ) : (
              <CommentRow key={item.id} taskId={taskId} comment={item} />
            ),
          )}
          {filter === "comments" && shown.length === 0 && (
            <li className="text-[13px] text-muted-foreground">No comments yet.</li>
          )}
        </ul>
        <div className="flex items-start gap-3">
          <Avatar user={me} className="size-11 text-[11px]" />
          <div className="min-w-0 grow">
            <CommentEditor
              onSubmit={(body) => addComment.mutate({ body, tempId: `temp-${crypto.randomUUID()}` })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-3 py-[3px] text-xs leading-4",
        active ? "bg-background font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ---------- Entries ----------

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex items-start gap-2.5">
      <Avatar user={item.actor} />
      <p className="text-[13px] leading-[18px] text-foreground/75">
        {firstName(item.actor.name)} {formatActivity(item)} · {relativeTime(item.createdAt)}
      </p>
    </li>
  );
}

function CommentRow({ taskId, comment }: { taskId: string; comment: CommentItem }) {
  const editComment = useEditComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <li className="group/comment flex items-start gap-2.5">
      <Avatar user={comment.author} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        {editing ? (
          <CommentEditor
            initial={comment.body}
            submitLabel="Save"
            onSubmit={(body) => {
              editComment.mutate({ commentId: comment.id, body });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="text-[13px] leading-[18px] text-foreground/75">
              {firstName(comment.author.name)} · {relativeTime(comment.createdAt)}
              {comment.editedAt && " · edited"}
            </p>
            {comment.deleted ? (
              <p className="text-sm italic text-muted-foreground">Comment deleted</p>
            ) : (
              // Keyed by the edit time: the read-only editor takes its content once, so an edit remounts it.
              <ReadOnlyBody key={comment.editedAt ?? "original"} body={comment.body} />
            )}
          </>
        )}
      </div>
      {(comment.canEdit || comment.canDelete) && !comment.deleted && !editing && (
        <div
          className={cn(
            "shrink-0",
            !menuOpen && "opacity-0 group-focus-within/comment:opacity-100 group-hover/comment:opacity-100",
          )}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label="Comment actions" />}
            >
              <IconDots aria-hidden className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {comment.canEdit && (
                  <DropdownMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(true);
                    }}
                  >
                    Edit
                  </DropdownMenuItem>
                )}
                {comment.canDelete && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                deleteComment.mutate({ commentId: comment.id });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** A comment body, read-only, with the composer's extensions so rendering matches. */
function ReadOnlyBody({ body }: { body: unknown }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Comment" }),
    ],
    content: (body ?? "") as Content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "rich-text leading-5" } },
  });
  return <EditorContent editor={editor} />;
}