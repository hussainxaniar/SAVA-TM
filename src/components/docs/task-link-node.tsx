"use client";

import { Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { IconLinkOff } from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { StatusGlyph } from "@/components/tasks/status-icon";
import { useTaskLabel } from "@/hooks/use-task-links";
import { cn } from "@/lib/utils";

/*
 * Task links (Section 11.4): an inline atom node pointing at a task, rendered as a chip with the
 * task's live status and title (struck through when done). Clicking opens the task dialog on the
 * same page via ?task=<id>; a task that was deleted or cannot be read shows "Task not found" and
 * does nothing on click. The `title` attribute is the snapshot used for text exports and while
 * the live label loads.
 */

function TaskLinkView({ node, selected }: NodeViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const taskId = node.attrs.taskId as string;
  const { data: label, isLoading } = useTaskLabel(taskId);

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <button
        type="button"
        contentEditable={false}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!label) return;
          router.push(`${pathname}?task=${taskId}`, { scroll: false });
        }}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-pill px-1.5 py-px text-[0.92em] leading-5 text-foreground hover:bg-accent",
          selected && "ring-1 ring-primary/50",
        )}
      >
        {label ? (
          <>
            <StatusGlyph status={label.status} statuses={[label.status]} size={13} />
            <span className={cn("truncate", label.completed && "line-through text-muted-foreground")}>
              {label.title}
            </span>
          </>
        ) : isLoading ? (
          <span className="truncate text-muted-foreground">{node.attrs.title}</span>
        ) : (
          <>
            <IconLinkOff size={13} className="shrink-0 text-muted-foreground" />
            <span className="truncate text-muted-foreground">Task not found</span>
          </>
        )}
      </button>
    </NodeViewWrapper>
  );
}

export const TaskLink = Node.create({
  name: "taskLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      taskId: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-task-link") ?? "",
      },
      title: {
        default: "",
        parseHTML: (element: HTMLElement) => element.textContent ?? "",
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-task-link]" }];
  },
  renderHTML({ node }) {
    return ["span", { "data-task-link": node.attrs.taskId }, node.attrs.title];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TaskLinkView);
  },
});
