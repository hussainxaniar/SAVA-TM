import type { SpaceRole } from "@prisma/client";

// Section 8: every service takes `ctx` first.
export type Ctx = { userId: string };

export type SpaceSummaryDTO = { id: string; name: string; icon: string | null; role: SpaceRole };

export type UserLite = { id: string; name: string; image: string | null };

export type MemberDTO = UserLite & { email: string; role: SpaceRole; joinedAt: string };

export type InviteRole = Exclude<SpaceRole, "OWNER">;

export type InviteStatus = "ACTIVE" | "EXPIRED" | "USED_UP";

/** Invites shown in Space settings (revoked ones are hidden). */
export type InviteDTO = {
  id: string;
  url: string;
  role: InviteRole;
  expiresAt: string;
  uses: number;
  maxUses: number | null;
  createdAt: string;
  status: InviteStatus;
};

export type InviteProblem = "NOT_FOUND" | "EXPIRED" | "REVOKED" | "USED_UP";

/**
 * What /invite/[token] shows. `memberSpaceId` is set only when the caller already belongs
 * to the space (7.2.4 → redirect); non-members never learn the space id.
 */
export type InviteInfoDTO =
  | { valid: true; spaceName: string; role: InviteRole; memberSpaceId: string | null }
  | { valid: false; reason: InviteProblem; spaceName: string | null; memberSpaceId: string | null };

/** Section 8.3 getSidebar. Archived projects, lists and docs are excluded; all in position order. */
export type SidebarDTO = {
  projects: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    lists: { id: string; name: string }[];
    /** firstPageId: the doc's first root page, so the sidebar can link straight to it. */
    docs: { id: string; title: string; firstPageId: string | null }[];
  }[];
};

export type StatusCategoryName = "TODO" | "ACTIVE" | "DONE";

/** Section 8.1. */
export type StatusDTO = { id: string; name: string; color: string; category: StatusCategoryName; position: string };

/** Project settings (9.6): statuses and active lists, with how many live tasks each holds. */
export type ProjectSettingsDTO = {
  project: { id: string; spaceId: string; name: string; color: string; icon: string | null };
  statuses: (StatusDTO & { taskCount: number })[];
  lists: { id: string; name: string; subtaskDisplay: "NESTED" | "SEPARATE"; taskCount: number }[];
};

// ---------- Tasks (Section 8.1 / 8.4) ----------

export type Priority = 1 | 2 | 3 | 4;

export type TaskRowDTO = {
  id: string;
  title: string;
  priority: Priority;
  status: StatusDTO;
  completedAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  dueHasTime: boolean;
  assignees: UserLite[];
  parentId: string | null;
  parentTitle: string | null;
  depth: number;
  homeListId: string;
  /** True when the row is in this list only through a TaskListLink (6.6). */
  isLinkedHere: boolean;
  /** Direct, non-deleted subtasks. */
  subtaskCount: number;
  openSubtaskCount: number;
  commentCount: number;
  /** Home position, or the link's position when isLinkedHere. */
  position: string;
};

export type TaskDetailDTO = TaskRowDTO & {
  description: unknown | null; // Tiptap JSON
  projectId: string;
  spaceId: string;
  homeList: { id: string; name: string };
  linkedLists: { id: string; name: string }[];
  /** Ancestors, root first. */
  breadcrumb: { id: string; title: string }[];
  /** Direct, non-deleted subtasks in position order. */
  subtasks: TaskRowDTO[];
  timeBlocks: { id: string; start: string; end: string; syncState: string }[];
  createdBy: UserLite;
  createdAt: string;
  updatedAt: string;
};

/** Section 8.4 getListView: Visible(L) (6.7), completed included; the client renders and sorts. */
export type ListViewDTO = {
  list: { id: string; name: string; subtaskDisplay: "NESTED" | "SEPARATE"; projectId: string };
  statuses: StatusDTO[];
  tasks: TaskRowDTO[];
};

/** Section 9.5 My Tasks rows show where each task lives. */
export type MyTaskDTO = TaskRowDTO & {
  projectId: string;
  projectName: string;
  projectColor: string;
  listName: string;
};
